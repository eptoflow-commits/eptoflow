#pragma once
#include <Arduino.h>
#include <Preferences.h>
#include "config.h"

// ============================================================================
// RelayManager — abstraction layer over all 8 relays
//
// Responsibilities:
//  - Map logical key (valve1, valve2, valve3, relay1, relay6-8) to GPIO
//  - Enforce premium relay lock (relay6/7/8 require NVS activation)
//  - Auto-OFF after max duration to prevent flooding
//  - WiFi-status relay5 is managed separately (not exposed to user commands)
//  - Persist on/off state for crash recovery
// ============================================================================

struct RelayInfo {
  const char* key;
  uint8_t     pin;
  bool        premiumLocked; // requires activation
  bool        wifiManaged;   // firmware controls, user cannot command
};

static const RelayInfo RELAY_MAP[] = {
  { "valve1", PIN_RELAY1, false, false },
  { "valve2", PIN_RELAY2, false, false },
  { "valve3", PIN_RELAY3, false, false },
  { "relay1", PIN_RELAY4, false, false },
  { "relay5", PIN_RELAY5, false, true  },  // WiFi indicator — firmware-only
  { "relay6", PIN_RELAY6, true,  false },  // Premium
  { "relay7", PIN_RELAY7, true,  false },  // Premium
  { "relay8", PIN_RELAY8, true,  false },  // Premium
};
static const int RELAY_COUNT = sizeof(RELAY_MAP) / sizeof(RELAY_MAP[0]);

class RelayManager {
public:
  struct TimedRun {
    bool     active     = false;
    uint32_t startMs    = 0;
    uint32_t durationMs = 0;
    char     key[12]    = {};
  };

  void begin() {
    // Initialise all relay pins as OUTPUT, default OFF (HIGH = off for active-low)
    for (int i = 0; i < RELAY_COUNT; i++) {
      pinMode(RELAY_MAP[i].pin, OUTPUT);
      digitalWrite(RELAY_MAP[i].pin, HIGH); // OFF
    }
    loadActivations();
    Serial.println("[relay] manager ready");
  }

  // ── Activation (called after admin push) ────────────────────────────────
  void setActivated(const char* key, bool active) {
    for (int i = 0; i < RELAY_COUNT; i++) {
      if (strcmp(RELAY_MAP[i].key, key) == 0 && RELAY_MAP[i].premiumLocked) {
        _activated[i] = active;
        persistActivations();
        Serial.printf("[relay] %s activation → %s\n", key, active ? "ON" : "OFF");
        return;
      }
    }
  }

  bool isActivated(const char* key) const {
    for (int i = 0; i < RELAY_COUNT; i++) {
      if (strcmp(RELAY_MAP[i].key, key) == 0) {
        if (!RELAY_MAP[i].premiumLocked) return true; // non-premium always accessible
        return _activated[i];
      }
    }
    return false;
  }

  // ── On/Off ───────────────────────────────────────────────────────────────
  bool turnOn(const char* key, uint32_t durationMs = 0) {
    int idx = findIndex(key);
    if (idx < 0) { Serial.printf("[relay] unknown key: %s\n", key); return false; }
    if (RELAY_MAP[idx].wifiManaged) { Serial.println("[relay] relay5 is wifi-managed"); return false; }
    if (RELAY_MAP[idx].premiumLocked && !_activated[idx]) {
      Serial.printf("[relay] %s is locked (premium not activated)\n", key);
      return false;
    }
    digitalWrite(RELAY_MAP[idx].pin, LOW); // ON
    _state[idx] = true;

    // Timed auto-off
    uint32_t maxMs = MAX_VALVE_DURATION_S * 1000UL;
    uint32_t actual = (durationMs == 0 || durationMs > maxMs) ? maxMs : durationMs;
    _timedRun[idx] = { true, millis(), actual, {} };
    strncpy(_timedRun[idx].key, key, sizeof(_timedRun[idx].key) - 1);

    Serial.printf("[relay] %s ON for %lus\n", key, actual / 1000);
    return true;
  }

  void turnOff(const char* key) {
    int idx = findIndex(key);
    if (idx < 0) return;
    if (RELAY_MAP[idx].wifiManaged) return;
    digitalWrite(RELAY_MAP[idx].pin, HIGH); // OFF
    _state[idx] = false;
    _timedRun[idx].active = false;
    Serial.printf("[relay] %s OFF\n", key);
  }

  void stopAll() {
    for (int i = 0; i < RELAY_COUNT; i++) {
      if (!RELAY_MAP[i].wifiManaged) {
        digitalWrite(RELAY_MAP[i].pin, HIGH);
        _state[i] = false;
        _timedRun[i].active = false;
      }
    }
    Serial.println("[relay] ALL OFF");
  }

  // ── WiFi status relay (relay5) ───────────────────────────────────────────
  void setWifiStatus(bool connected) {
    int idx = findIndex("relay5");
    if (idx < 0) return;
    digitalWrite(RELAY_MAP[idx].pin, connected ? LOW : HIGH);
    _state[idx] = connected;
  }

  // ── State query ──────────────────────────────────────────────────────────
  bool isOn(const char* key) const {
    int idx = findIndex(key);
    return (idx >= 0) && _state[idx];
  }

  // ── Tick — call from main loop (non-blocking) ────────────────────────────
  void tick() {
    uint32_t now = millis();
    for (int i = 0; i < RELAY_COUNT; i++) {
      if (_timedRun[i].active && _state[i]) {
        if (now - _timedRun[i].startMs >= _timedRun[i].durationMs) {
          Serial.printf("[relay] %s timed-out → OFF\n", _timedRun[i].key);
          digitalWrite(RELAY_MAP[i].pin, HIGH);
          _state[i] = false;
          _timedRun[i].active = false;
        }
      }
    }
  }

  // ── Build JSON state snapshot (for heartbeat / MQTT) ────────────────────
  String stateJson() const {
    String s = "{";
    for (int i = 0; i < RELAY_COUNT; i++) {
      if (i) s += ",";
      s += "\""; s += RELAY_MAP[i].key; s += "\":";
      s += _state[i] ? "true" : "false";
    }
    s += "}";
    return s;
  }

private:
  bool     _state[RELAY_COUNT]      = {};
  bool     _activated[RELAY_COUNT]  = {};
  TimedRun _timedRun[RELAY_COUNT]   = {};

  int findIndex(const char* key) const {
    for (int i = 0; i < RELAY_COUNT; i++) {
      if (strcmp(RELAY_MAP[i].key, key) == 0) return i;
    }
    return -1;
  }

  void persistActivations() {
    Preferences p; p.begin(NVS_NS_RELAYS, false);
    uint8_t mask = 0;
    for (int i = 0; i < RELAY_COUNT; i++) {
      if (RELAY_MAP[i].premiumLocked && _activated[i]) mask |= (1 << i);
    }
    p.putUChar("mask", mask);
    p.end();
  }

  void loadActivations() {
    Preferences p; p.begin(NVS_NS_RELAYS, true);
    uint8_t mask = p.getUChar("mask", 0);
    p.end();
    for (int i = 0; i < RELAY_COUNT; i++) {
      if (RELAY_MAP[i].premiumLocked) _activated[i] = !!(mask & (1 << i));
    }
    Serial.printf("[relay] premium activation mask: 0x%02X\n", mask);
  }
};

extern RelayManager Relays;
