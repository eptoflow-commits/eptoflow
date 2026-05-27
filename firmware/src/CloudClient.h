#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <Update.h>
#include "config.h"
#include "RelayManager.h"
#include "AutomationEngine.h"

// ============================================================================
// CloudClient — handles all HTTP communication with the Eptoflow backend
//
// Non-blocking: each method returns quickly; long-running requests use
// the built-in HTTPClient timeout.
//
// Responsibilities:
//   - Device authentication & JWT refresh
//   - Poll for pending commands (GET /api/device/next)
//   - ACK commands (POST /api/device/ack/:id)
//   - Push sensor readings (POST /api/device/sensor)
//   - Heartbeat (POST /api/device/heartbeat)
//   - Fetch full config on boot (GET /api/device/config)
//   - OTA update check (GET /api/device/ota)
// ============================================================================

class CloudClient {
public:
  void begin(const char* baseUrl, const char* deviceUid, const char* deviceSecret) {
    _baseUrl      = baseUrl;
    _deviceUid    = deviceUid;
    _deviceSecret = deviceSecret;
    loadToken();
    Serial.println("[cloud] client ready");
  }

  bool authenticate() {
    HTTPClient http;
    String url = _baseUrl + "/api/device/auth";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    DynamicJsonDocument req(256);
    req["device_uid"]      = _deviceUid;
    req["device_secret"]   = _deviceSecret;
    req["firmware_version"]= FIRMWARE_VERSION;
    String body; serializeJson(req, body);

    int code = http.POST(body);
    if (code == 200) {
      DynamicJsonDocument res(512);
      deserializeJson(res, http.getString());
      const char* tok = res["token"];
      if (tok) {
        _token = String(tok);
        saveToken();
        Serial.println("[cloud] authenticated ✓");
        http.end(); return true;
      }
    }
    Serial.printf("[cloud] auth failed HTTP %d\n", code);
    http.end(); return false;
  }

  // ── Fetch & execute next command ─────────────────────────────────────────
  bool pollCommand() {
    if (_token.isEmpty()) return false;
    HTTPClient http;
    http.begin(_baseUrl + "/api/device/next");
    http.addHeader("Authorization", "Bearer " + _token);
    int code = http.GET();
    if (code == 401) { _token = ""; return false; } // re-auth needed
    if (code != 200) { http.end(); return false; }

    DynamicJsonDocument res(1024);
    deserializeJson(res, http.getString());
    http.end();

    if (res["command"].isNull()) return false;

    JsonObject cmd     = res["command"];
    const char* cmdId  = cmd["id"];
    const char* type   = cmd["command_type"];
    JsonObject  payload= cmd["payload"];

    Serial.printf("[cloud] command: %s\n", type);
    bool ok = executeCommand(type, payload);
    ack(cmdId, ok ? "executed" : "failed");
    return true;
  }

  // ── Send sensor reading ───────────────────────────────────────────────────
  bool pushSensor(const String& sensorJson) {
    if (_token.isEmpty()) return false;
    HTTPClient http;
    http.begin(_baseUrl + "/api/device/sensor");
    http.addHeader("Authorization", "Bearer " + _token);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(sensorJson);
    http.end();
    return code == 200;
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  bool heartbeat(const String& stateJson) {
    if (_token.isEmpty()) return false;
    HTTPClient http;
    http.begin(_baseUrl + "/api/device/heartbeat");
    http.addHeader("Authorization", "Bearer " + _token);
    http.addHeader("Content-Type", "application/json");
    String body = "{\"relay_state\":" + stateJson + ",\"firmware\":\"" FIRMWARE_VERSION "\"}";
    int code = http.POST(body);
    http.end();
    if (code == 401) { _token = ""; }
    return code == 200;
  }

  // ── Fetch config (automation rules, relay licenses) ───────────────────────
  bool fetchConfig() {
    if (_token.isEmpty()) return false;
    HTTPClient http;
    http.begin(_baseUrl + "/api/device/config");
    http.addHeader("Authorization", "Bearer " + _token);
    int code = http.GET();
    if (code != 200) { http.end(); return false; }

    DynamicJsonDocument doc(4096);
    deserializeJson(doc, http.getString());
    http.end();

    // Apply relay licenses
    for (JsonObject lic : doc["relay_licenses"].as<JsonArray>()) {
      const char* key  = lic["relay_key"];
      bool        act  = lic["activated"];
      if (key) Relays.setActivated(key, act);
    }

    // Apply automation rules
    String rulesJson;
    serializeJson(doc["automation_rules"], rulesJson);
    AutoEngine.loadFromJson(rulesJson.c_str());

    Serial.println("[cloud] config applied ✓");
    return true;
  }

  // ── OTA update check ──────────────────────────────────────────────────────
  bool checkOta() {
    if (_token.isEmpty()) return false;
    HTTPClient http;
    http.begin(_baseUrl + "/api/device/ota?firmware=" FIRMWARE_VERSION);
    http.addHeader("Authorization", "Bearer " + _token);
    int code = http.GET();
    if (code != 200) { http.end(); return false; }

    DynamicJsonDocument doc(512);
    deserializeJson(doc, http.getString());
    http.end();

    bool available  = doc["available"] | false;
    const char* url = doc["url"];
    if (!available || !url) return false;

    Serial.printf("[ota] new firmware available: %s\n", doc["version"] | "?");
    return performOta(url);
  }

  bool isAuthenticated() const { return !_token.isEmpty(); }

private:
  String _baseUrl;
  String _deviceUid;
  String _deviceSecret;
  String _token;

  void saveToken() {
    Preferences p; p.begin(NVS_NS_DEVICE, false);
    p.putString("token", _token);
    p.end();
  }

  void loadToken() {
    Preferences p; p.begin(NVS_NS_DEVICE, true);
    _token = p.getString("token", "");
    p.end();
  }

  void ack(const char* cmdId, const char* status) {
    if (!cmdId || _token.isEmpty()) return;
    HTTPClient http;
    http.begin(_baseUrl + "/api/device/ack/" + cmdId);
    http.addHeader("Authorization", "Bearer " + _token);
    http.addHeader("Content-Type", "application/json");
    String body = String("{\"status\":\"") + status + "\"}";
    http.POST(body);
    http.end();
  }

  bool executeCommand(const char* type, JsonObject payload) {
    if (!type) return false;

    if (strcmp(type, "stop_all") == 0) {
      Relays.stopAll();
      return true;
    }
    if (strcmp(type, "water_for") == 0) {
      const char* target  = payload["target"];
      uint32_t    dur     = payload["duration"] | 300;
      return Relays.turnOn(target, dur * 1000UL);
    }
    if (strcmp(type, "valve_on") == 0) {
      return Relays.turnOn(payload["target"]);
    }
    if (strcmp(type, "valve_off") == 0) {
      Relays.turnOff(payload["target"]);
      return true;
    }
    if (strcmp(type, "relay_on") == 0) {
      return Relays.turnOn(payload["target"] | "relay1");
    }
    if (strcmp(type, "relay_off") == 0) {
      Relays.turnOff(payload["target"] | "relay1");
      return true;
    }
    if (strcmp(type, "activate_relay") == 0) {
      const char* key = payload["relay_key"];
      bool        act = payload["activated"] | false;
      Relays.setActivated(key, act);
      return true;
    }
    if (strcmp(type, "sync_automation") == 0) {
      const char* valveKey = payload["valve_key"];
      String ruleJson; serializeJson(payload["rule"], ruleJson);
      AutoEngine.updateRule(valveKey, ruleJson.c_str());
      return true;
    }
    if (strcmp(type, "push_config") == 0) {
      // Full config push from admin
      for (JsonObject lic : payload["licenses"].as<JsonArray>()) {
        Relays.setActivated(lic["relay_key"], (bool)lic["activated"]);
      }
      String rulesJson; serializeJson(payload["rules"], rulesJson);
      AutoEngine.loadFromJson(rulesJson.c_str());
      return true;
    }
    if (strcmp(type, "reboot") == 0) {
      Serial.println("[cloud] reboot command received");
      delay(500); ESP.restart();
      return true;
    }

    Serial.printf("[cloud] unknown command: %s\n", type);
    return false;
  }

  bool performOta(const char* url) {
#ifdef ARDUINO_ARCH_ESP32
    HTTPClient http;
    http.begin(url);
    http.addHeader("Authorization", "Bearer " + _token);
    int code = http.GET();
    if (code != 200) { http.end(); return false; }

    int   total  = http.getSize();
    WiFiClient* stream = http.getStreamPtr();
    if (!Update.begin(total)) {
      Serial.println("[ota] not enough space"); http.end(); return false;
    }
    size_t written = Update.writeStream(*stream);
    http.end();
    if (!Update.end() || !Update.isFinished()) {
      Serial.println("[ota] update failed"); return false;
    }
    Serial.println("[ota] update complete — rebooting");
    delay(1000); ESP.restart();
#endif
    return false;
  }
};

extern CloudClient Cloud;
