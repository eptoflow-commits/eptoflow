/**
 * Eptoflow — ESP32 firmware (Arduino IDE)
 *
 * - Connects to Wi-Fi (auto reconnect)
 * - Authenticates with backend using device_uid + device_secret
 * - Sends heartbeat + state every EPF_HEARTBEAT_MS
 * - Polls /api/device/next for pending commands and executes them
 * - Sends ack back to /api/device/ack/:cmdId
 *
 * Fail-safe behavior:
 *   - If backend reports `subscription_active=false`, all outputs are turned OFF
 *     and no new commands are executed until activation resumes.
 *   - Every output is protected by a max-on timer and a cooldown.
 *
 * Required libraries (install from Arduino Library Manager):
 *   - ArduinoJson (>= 6.x)
 * (WiFi.h and HTTPClient.h ship with the ESP32 board package)
 *
 * Board: any ESP32 dev board.
 */

#include <Arduino.h>
#include <ArduinoJson.h>

#include "config.h"
#include "Net.h"
#include "Outputs.h"

static bool     g_authed = false;
static bool     g_subActive = true;
static String   g_planBound = "basic";  // "basic" | "premium"
static unsigned long g_nextHeartbeatAt = 0;
static unsigned long g_nextPollAt = 0;
static unsigned long g_nextMoistureAt = 0;
static int            g_lastMoisture = -1;
static unsigned long g_nextAuthAt = 0;   // backoff when auth fails

// ---------- helpers ----------
static bool planAllows(const String& target) {
  if (g_planBound == "premium") return true;
  // basic plan: only valve1 + relay1
  return target == "valve1" || target == "relay1";
}

// Apply a command received from backend.
static bool executeCommand(const String& type, JsonVariant payload, String& err) {
  String target = payload["target"] | "";
  long duration = payload["duration"] | 0L;

  if (type == "stop_all") {
    Outputs::stopAll();
    return true;
  }
  if (target.length() == 0 && (type == "valve_on" || type == "valve_off" || type == "water_for")) {
    err = "missing target"; return false;
  }
  if (type == "relay_on" || type == "relay_off") target = "relay1";

  if (!planAllows(target)) { err = "plan_restricted"; return false; }
  if (!g_subActive)         { err = "subscription_inactive"; return false; }

  Outputs::Id id = Outputs::fromName(target);
  if ((int)id < 0) { err = "bad_target"; return false; }

  if (type == "valve_on" || type == "relay_on")  return Outputs::turnOn(id, 0);
  if (type == "valve_off" || type == "relay_off") return Outputs::turnOff(id);
  if (type == "water_for") {
    if (duration <= 0) { err = "bad_duration"; return false; }
    return Outputs::turnOn(id, (uint32_t)duration * 1000UL);
  }
  err = "unknown_command";
  return false;
}

// ---------- backend integration ----------
static bool tryAuth() {
  StaticJsonDocument<384> body;
  body["device_uid"]       = EPF_DEVICE_UID;
  body["device_secret"]    = EPF_DEVICE_SECRET;
  body["firmware_version"] = EPF_FIRMWARE_VERSION;

  StaticJsonDocument<512> resp;
  int code = Net::httpPostJson("/api/device/auth", body, &resp, nullptr, /*useAuth*/ false);
  if (code == 200 && resp["token"].is<const char*>()) {
    Net::setToken(resp["token"].as<const char*>());
    g_planBound = resp["device"]["plan_bound"] | "basic";
    g_authed = true;
    Serial.printf("[auth] OK, plan=%s\n", g_planBound.c_str());
    return true;
  }
  Serial.printf("[auth] failed code=%d\n", code);
  Net::clearToken();
  g_authed = false;
  return false;
}

static void sendHeartbeat() {
  StaticJsonDocument<512> body;
  body["relay1_state"]   = Outputs::isOn(Outputs::RELAY1);
  body["valve1_state"]   = Outputs::isOn(Outputs::VALVE1);
  body["valve2_state"]   = Outputs::isOn(Outputs::VALVE2);
  body["valve3_state"]   = Outputs::isOn(Outputs::VALVE3);
  if (g_lastMoisture >= 0) body["moisture_value"] = g_lastMoisture;
  body["wifi_rssi"]      = WiFi.RSSI();
  body["ip"]             = WiFi.localIP().toString();
  body["uptime_ms"]      = (long)millis();

  StaticJsonDocument<384> resp;
  int code = Net::httpPostJson("/api/device/heartbeat", body, &resp);
  if (code == 200) {
    g_subActive = resp["subscription_active"] | false;
    g_planBound = resp["plan_bound"] | g_planBound;
    if (!g_subActive) {
      Serial.println("[hb] subscription inactive -> stopping all outputs");
      Outputs::stopAll();
    }
  } else if (code == 401) {
    Serial.println("[hb] 401 -> re-auth next cycle");
    g_authed = false;
  } else {
    Serial.printf("[hb] code=%d\n", code);
  }
}

static void pollCommand() {
  StaticJsonDocument<768> resp;
  int code = Net::httpGetJson("/api/device/next", &resp);
  if (code == 401) { g_authed = false; return; }
  if (code != 200) return;

  g_subActive = resp["subscription_active"] | true;
  if (!g_subActive) { Outputs::stopAll(); return; }

  JsonObject cmd = resp["command"].as<JsonObject>();
  if (cmd.isNull()) return;

  String id   = cmd["id"] | "";
  String type = cmd["command_type"] | "";
  JsonVariant payload = cmd["payload"];
  Serial.printf("[cmd] received %s (%s)\n", type.c_str(), id.c_str());

  String err;
  bool ok = executeCommand(type, payload, err);

  StaticJsonDocument<192> ack;
  ack["status"] = ok ? "executed" : "failed";
  if (!ok) ack["error"] = err;
  StaticJsonDocument<192> ackResp;
  int ackCode = Net::httpPostJson("/api/device/ack/" + id, ack, &ackResp);
  Serial.printf("[ack] %s code=%d err=%s\n", ok ? "OK" : "FAIL", ackCode, err.c_str());
}

static void readMoisture() {
  if (g_planBound != "premium") return;  // only premium boards wire the sensor
  int raw = analogRead(EPF_MOISTURE_PIN);
  // Invert: most capacitive sensors report HIGH when dry. Normalize to 0..100 (moist%).
  int percent = constrain(map(raw, 3200, 1200, 0, 100), 0, 100);
  g_lastMoisture = percent;
}

// ---------- Arduino ----------
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.printf("Eptoflow firmware v%s starting...\n", EPF_FIRMWARE_VERSION);
  Outputs::setup();
  Net::wifiBegin();
  analogReadResolution(12);
}

void loop() {
  Net::loop();
  Outputs::loop();
  unsigned long now = millis();

  if (!Net::isConnected()) return;

  if (!g_authed) {
    if (now >= g_nextAuthAt) {
      if (!tryAuth()) g_nextAuthAt = now + 5000;  // backoff 5 s
      else            g_nextHeartbeatAt = now;    // trigger immediate heartbeat
    }
    return;
  }

  if (now >= g_nextMoistureAt) { readMoisture(); g_nextMoistureAt = now + EPF_MOISTURE_READ_MS; }
  if (now >= g_nextHeartbeatAt) { sendHeartbeat(); g_nextHeartbeatAt = now + EPF_HEARTBEAT_MS; }
  if (now >= g_nextPollAt)     { pollCommand();   g_nextPollAt      = now + EPF_POLL_COMMANDS_MS; }
}
