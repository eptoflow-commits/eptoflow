#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "config.h"
#include "RelayManager.h"
#include "ModbusSensor.h"

// ============================================================================
// AutomationEngine — per-valve rule evaluation
//
// Each rule can trigger a valve ON/OFF based on:
//   - Soil moisture threshold (moisture < X → ON, moisture > Y → OFF)
//   - Temperature threshold   (temp > X → ON, temp < Y → OFF)
//   - Combined with AND / OR logic
//   - Optional time window (schedule_start / schedule_end in HH:MM UTC)
//
// Rules are stored in NVS as a JSON blob and synced from the cloud
// so the device can operate autonomously when internet is unavailable.
// ============================================================================

struct AutoRule {
  char    valve_key[12]  = {};
  bool    enabled        = true;
  bool    isAuto         = true;   // false = manual mode, skip automation
  float   on_moisture_lt = -1;     // -1 = not set
  float   on_temp_gt     = -1;
  bool    on_and_logic   = true;   // true=AND, false=OR
  float   off_moisture_gt= -1;
  float   off_temp_lt    = -1;
  bool    off_and_logic  = true;
  char    schedule_start[6] = {};  // "HH:MM", empty = no window
  char    schedule_end[6]   = {};
  uint32_t max_duration_s   = MAX_VALVE_DURATION_S;
  uint32_t run_start_ms     = 0;   // when this valve last turned ON (runtime state)
  bool     running          = false;
};

class AutomationEngine {
public:
  static const int MAX_RULES = 8;

  void begin() {
    loadFromNvs();
    Serial.printf("[auto] engine ready (%d rules)\n", _ruleCount);
  }

  // ── Load / save rules ───────────────────────────────────────────────────
  void loadFromJson(const char* json) {
    DynamicJsonDocument doc(4096);
    if (deserializeJson(doc, json) != DeserializationError::Ok) {
      Serial.println("[auto] bad JSON"); return;
    }
    _ruleCount = 0;
    JsonArray arr = doc.as<JsonArray>();
    for (JsonObject obj : arr) {
      if (_ruleCount >= MAX_RULES) break;
      AutoRule& r = _rules[_ruleCount++];
      strlcpy(r.valve_key,      obj["valve_key"]  | "",    sizeof(r.valve_key));
      r.enabled        = obj["enabled"]        | true;
      r.isAuto         = strcmp(obj["mode"] | "auto", "auto") == 0;
      r.on_moisture_lt = obj["on_moisture_lt"] | -1.0f;
      r.on_temp_gt     = obj["on_temp_gt"]     | -1.0f;
      r.on_and_logic   = strcmp(obj["on_logic"] | "AND", "AND") == 0;
      r.off_moisture_gt= obj["off_moisture_gt"]| -1.0f;
      r.off_temp_lt    = obj["off_temp_lt"]    | -1.0f;
      r.off_and_logic  = strcmp(obj["off_logic"] | "AND", "AND") == 0;
      strlcpy(r.schedule_start, obj["schedule_start"] | "", sizeof(r.schedule_start));
      strlcpy(r.schedule_end,   obj["schedule_end"]   | "", sizeof(r.schedule_end));
      r.max_duration_s = obj["max_duration_s"]  | (uint32_t)MAX_VALVE_DURATION_S;
    }
    saveToNvs();
    Serial.printf("[auto] loaded %d rules from JSON\n", _ruleCount);
  }

  void updateRule(const char* valveKey, const char* json) {
    // Merge single rule JSON into existing rules
    DynamicJsonDocument doc(512);
    if (deserializeJson(doc, json) != DeserializationError::Ok) return;
    for (int i = 0; i < _ruleCount; i++) {
      if (strcmp(_rules[i].valve_key, valveKey) == 0) {
        applyJsonToRule(_rules[i], doc.as<JsonObject>());
        saveToNvs();
        return;
      }
    }
    // New rule
    if (_ruleCount < MAX_RULES) {
      AutoRule& r = _rules[_ruleCount++];
      strlcpy(r.valve_key, valveKey, sizeof(r.valve_key));
      applyJsonToRule(r, doc.as<JsonObject>());
      saveToNvs();
    }
  }

  // ── Tick — call every AUTO_ENGINE_INTERVAL_MS ───────────────────────────
  void tick(const SensorReading& sensor, const String& utcTime) {
    if (!sensor.valid) return; // no sensor data — can't evaluate rules

    for (int i = 0; i < _ruleCount; i++) {
      AutoRule& r = _rules[i];
      if (!r.enabled || !r.isAuto) continue;
      if (!Relays.isActivated(r.valve_key)) continue;

      // Time window check
      if (strlen(r.schedule_start) > 0 && strlen(r.schedule_end) > 0) {
        if (!inWindow(utcTime.c_str(), r.schedule_start, r.schedule_end)) {
          // Outside window — force off if running
          if (r.running) { Relays.turnOff(r.valve_key); r.running = false; }
          continue;
        }
      }

      bool valveOn = Relays.isOn(r.valve_key);

      // ── Max duration safety ───────────────────────────────────────────
      if (valveOn && r.running) {
        uint32_t elapsed = (millis() - r.run_start_ms) / 1000;
        if (elapsed >= r.max_duration_s) {
          Serial.printf("[auto] %s max duration reached → OFF\n", r.valve_key);
          Relays.turnOff(r.valve_key);
          r.running = false;
          continue;
        }
      }

      // ── Evaluate OFF condition ────────────────────────────────────────
      if (valveOn) {
        bool off = evalCondition(
          r.off_moisture_gt, r.off_temp_lt,
          sensor.moisture_pct, sensor.temp_c,
          r.off_and_logic,
          false /* off = greater-than for moisture, less-than for temp */
        );
        if (off) {
          Serial.printf("[auto] %s OFF by rule (M=%.1f%% T=%.1f°C)\n",
            r.valve_key, sensor.moisture_pct, sensor.temp_c);
          Relays.turnOff(r.valve_key);
          r.running = false;
        }
        continue; // don't re-evaluate ON while running
      }

      // ── Evaluate ON condition ─────────────────────────────────────────
      bool on = evalCondition(
        r.on_moisture_lt, r.on_temp_gt,
        sensor.moisture_pct, sensor.temp_c,
        r.on_and_logic,
        true /* on = less-than for moisture, greater-than for temp */
      );
      if (on) {
        Serial.printf("[auto] %s ON by rule (M=%.1f%% T=%.1f°C)\n",
          r.valve_key, sensor.moisture_pct, sensor.temp_c);
        Relays.turnOn(r.valve_key, r.max_duration_s * 1000UL);
        r.running     = true;
        r.run_start_ms = millis();
      }
    }
  }

  int ruleCount() const { return _ruleCount; }

private:
  AutoRule _rules[MAX_RULES];
  int      _ruleCount = 0;

  // ── Condition evaluator ──────────────────────────────────────────────────
  // onMode=true:  moistureThreshold is "less-than", tempThreshold is "greater-than"
  // onMode=false: moistureThreshold is "greater-than", tempThreshold is "less-than"
  bool evalCondition(float mThresh, float tThresh,
                     float moisture, float temp,
                     bool andLogic, bool onMode) {
    bool mSet = mThresh >= 0;
    bool tSet = tThresh >= 0;
    if (!mSet && !tSet) return false;

    bool mMet = false, tMet = false;
    if (mSet) mMet = onMode ? (moisture < mThresh) : (moisture > mThresh);
    if (tSet) tMet = onMode ? (temp     > tThresh) : (temp     < tThresh);

    if (mSet && tSet) return andLogic ? (mMet && tMet) : (mMet || tMet);
    if (mSet) return mMet;
    return tMet;
  }

  // ── Schedule window ──────────────────────────────────────────────────────
  // utcNow format: "HH:MM"
  bool inWindow(const char* utcNow, const char* start, const char* end) {
    int nowMin   = toMinutes(utcNow);
    int startMin = toMinutes(start);
    int endMin   = toMinutes(end);
    if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
    // Overnight window e.g. 22:00–06:00
    return nowMin >= startMin || nowMin < endMin;
  }

  int toMinutes(const char* hhmm) {
    if (strlen(hhmm) < 5) return 0;
    int h = (hhmm[0]-'0')*10 + (hhmm[1]-'0');
    int m = (hhmm[3]-'0')*10 + (hhmm[4]-'0');
    return h * 60 + m;
  }

  // ── NVS persistence ──────────────────────────────────────────────────────
  void saveToNvs() {
    DynamicJsonDocument doc(4096);
    JsonArray arr = doc.to<JsonArray>();
    for (int i = 0; i < _ruleCount; i++) {
      JsonObject o = arr.createNestedObject();
      const AutoRule& r = _rules[i];
      o["valve_key"]       = r.valve_key;
      o["enabled"]         = r.enabled;
      o["mode"]            = r.isAuto ? "auto" : "manual";
      o["on_moisture_lt"]  = r.on_moisture_lt;
      o["on_temp_gt"]      = r.on_temp_gt;
      o["on_logic"]        = r.on_and_logic ? "AND" : "OR";
      o["off_moisture_gt"] = r.off_moisture_gt;
      o["off_temp_lt"]     = r.off_temp_lt;
      o["off_logic"]       = r.off_and_logic ? "AND" : "OR";
      o["schedule_start"]  = r.schedule_start;
      o["schedule_end"]    = r.schedule_end;
      o["max_duration_s"]  = r.max_duration_s;
    }
    String json; serializeJson(doc, json);
    Preferences p; p.begin(NVS_NS_AUTO, false);
    p.putString("rules", json);
    p.end();
  }

  void loadFromNvs() {
    Preferences p; p.begin(NVS_NS_AUTO, true);
    String json = p.getString("rules", "[]");
    p.end();
    loadFromJson(json.c_str());
  }

  void applyJsonToRule(AutoRule& r, JsonObject obj) {
    r.enabled        = obj["enabled"]        | r.enabled;
    r.isAuto         = strcmp(obj["mode"] | (r.isAuto ? "auto" : "manual"), "auto") == 0;
    r.on_moisture_lt = obj["on_moisture_lt"] | r.on_moisture_lt;
    r.on_temp_gt     = obj["on_temp_gt"]     | r.on_temp_gt;
    r.on_and_logic   = strcmp(obj["on_logic"] | (r.on_and_logic ? "AND" : "OR"), "AND") == 0;
    r.off_moisture_gt= obj["off_moisture_gt"]| r.off_moisture_gt;
    r.off_temp_lt    = obj["off_temp_lt"]    | r.off_temp_lt;
    r.off_and_logic  = strcmp(obj["off_logic"] | (r.off_and_logic ? "AND" : "OR"), "AND") == 0;
    strlcpy(r.schedule_start, obj["schedule_start"] | r.schedule_start, sizeof(r.schedule_start));
    strlcpy(r.schedule_end,   obj["schedule_end"]   | r.schedule_end,   sizeof(r.schedule_end));
    r.max_duration_s = obj["max_duration_s"] | r.max_duration_s;
  }
};

extern AutomationEngine AutoEngine;
