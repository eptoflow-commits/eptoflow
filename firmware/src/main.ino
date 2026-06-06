/**
 * Eptoflow ESP32 Firmware v2.0.0
 * ================================
 * Arduino IDE sketch — open the "main" folder in Arduino IDE.
 *
 * Board:  ESP32 Dev Module  (Tools → Board → esp32 → ESP32 Dev Module)
 * Library required: ArduinoJson by Benoit Blanchon v6.x  (Tools → Manage Libraries)
 *
 * Non-blocking FreeRTOS architecture with:
 *   - RS485 Modbus soil moisture + temperature sensor
 *   - 8-channel relay control (valve1-3, motor, WiFi indicator, premium add-ons)
 *   - Per-valve automation engine with threshold rules
 *   - WiFi auto-reconnect with status relay (relay5)
 *   - Cloud command polling + sensor push
 *   - Premium relay licensing via NVS
 *   - OTA firmware update
 *   - Local automation fallback when offline
 *   - Watchdog timer
 *
 * Hardware: ESP32 + RS485 MAX485 + 8CH Relay Module
 */

#include <WiFi.h>
#include <Preferences.h>
#include <esp_task_wdt.h>
#include <time.h>
#include "config.h"
#include "RelayManager.h"
#include "ModbusSensor.h"
#include "AutomationEngine.h"
#include "CloudClient.h"

// ── Global singletons ────────────────────────────────────────────────────────
RelayManager     Relays;
ModbusSensor     Sensor;
AutomationEngine AutoEngine;
CloudClient      Cloud;

// ── Hardcoded fallback credentials ───────────────────────────────────────────
// Used when NVS has no stored credentials.
// Replace device_uid / device_secret with values from your Eptoflow dashboard.
#define DEFAULT_WIFI_SSID      "eptosi"
#define DEFAULT_WIFI_PASSWORD  "eptosi332"
#define DEFAULT_DEVICE_UID     "EPT-251877-B3C300"
#define DEFAULT_DEVICE_SECRET  "62959208373acc92caefb55894c10e073f13b89986e148cd"
#define DEFAULT_CLOUD_URL      "https://eptoflow-api.onrender.com"

static String g_ssid;
static String g_password;
static String g_deviceUid;
static String g_deviceSecret;
static String g_cloudUrl;

// ── Task timers (millis-based, non-blocking) ──────────────────────────────────
static uint32_t t_sensor     = 0;
static uint32_t t_sensorPush = 0;
static uint32_t t_cmdPoll    = 0;
static uint32_t t_heartbeat  = 0;
static uint32_t t_config     = 0;
static uint32_t t_auto       = 0;
static uint32_t t_ota        = 0;
static uint32_t t_wifiCheck  = 0;
static uint32_t t_statusLog  = 0;  // periodic relay status to serial

static bool g_wifiWasConnected = false;

// ─────────────────────────────────────────────────────────────────────────────
void loadProvisioning() {
  // Always use hardcoded UID/secret — clear any stale cached token
  g_deviceUid    = DEFAULT_DEVICE_UID;
  g_deviceSecret = DEFAULT_DEVICE_SECRET;
  g_cloudUrl     = DEFAULT_CLOUD_URL;

  Preferences p;
  // WiFi credentials from NVS (fallback to hardcoded)
  p.begin(NVS_NS_DEVICE, true);
  g_ssid     = p.getString("ssid",     DEFAULT_WIFI_SSID);
  g_password = p.getString("password", DEFAULT_WIFI_PASSWORD);
  p.end();

  // If NVS has credentials, show source clearly for debugging
  bool nvsSsid = (g_ssid != DEFAULT_WIFI_SSID || g_password != DEFAULT_WIFI_PASSWORD);
  Serial.printf("[prov] WiFi source = %s\n", nvsSsid ? "NVS" : "hardcoded");

  // Clear cached JWT so device re-authenticates fresh
  p.begin(NVS_NS_DEVICE, false);
  p.remove("token");
  p.end();

  Serial.printf("[prov] uid=%s url=%s\n", g_deviceUid.c_str(), g_cloudUrl.c_str());
}

// ─────────────────────────────────────────────────────────────────────────────
void connectWifi() {
  if (g_ssid.isEmpty()) {
    Serial.println("[wifi] no credentials — set SSID/password");
    return;
  }

  Serial.printf("[wifi] SSID     = \"%s\"\n", g_ssid.c_str());
  Serial.printf("[wifi] PASSWORD = \"%s\"\n", g_password.c_str());

  // Full reset before connecting — avoids stale state causing failures
  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false); // we handle reconnect manually
  WiFi.begin(g_ssid.c_str(), g_password.c_str());

  Serial.print("[wifi] connecting");
  uint32_t t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset();
  }
  Serial.println();

  bool connected = (WiFi.status() == WL_CONNECTED);
  if (connected) {
    Serial.printf("[wifi] connected ✓  IP: %s\n", WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org");
  } else {
    Serial.printf("[wifi] FAILED (status=%d) — running offline\n", WiFi.status());
    Serial.println("[wifi] check SSID/password and signal strength");
  }
  Relays.setWifiStatus(connected);
  g_wifiWasConnected = connected;
}

// ─────────────────────────────────────────────────────────────────────────────
String utcTimeHHMM() {
  struct tm ti;
  if (!getLocalTime(&ti, 0)) return "00:00";
  char buf[6];
  snprintf(buf, sizeof(buf), "%02d:%02d", ti.tm_hour, ti.tm_min);
  return String(buf);
}

// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n[boot] Eptoflow v" FIRMWARE_VERSION);

  // Watchdog — ESP32 Arduino core v3.x uses a config struct
  const esp_task_wdt_config_t wdt_cfg = {
    .timeout_ms     = WDT_TIMEOUT_S * 1000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic  = true,
  };
  esp_task_wdt_reconfigure(&wdt_cfg);
  esp_task_wdt_add(NULL);

  loadProvisioning();

  Relays.begin();
  Sensor.begin();
  AutoEngine.begin();

  connectWifi();

  if (WiFi.status() == WL_CONNECTED) {
    Cloud.begin(g_cloudUrl.c_str(), g_deviceUid.c_str(), g_deviceSecret.c_str());
    if (Cloud.authenticate()) {
      Cloud.fetchConfig();
    }
  }

  t_sensor = t_sensorPush = t_cmdPoll = t_heartbeat = t_auto = millis();
  t_config  = t_ota = t_statusLog = millis();

  Serial.println("[boot] setup complete");
}

// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  esp_task_wdt_reset();

  uint32_t now = millis();

  // ── WiFi auto-reconnect ──────────────────────────────────────────────────
  if (now - t_wifiCheck >= 10000) {
    t_wifiCheck = now;
    bool connected = (WiFi.status() == WL_CONNECTED);
    if (!connected) {
      if (g_wifiWasConnected) {
        Serial.println("[wifi] disconnected — will reconnect");
        Relays.setWifiStatus(false);
        g_wifiWasConnected = false;
      }
      // Full reconnect every 30 s when offline
      static uint32_t t_reconnect = 0;
      if (now - t_reconnect >= 30000) {
        t_reconnect = now;
        Serial.println("[wifi] attempting reconnect…");
        connectWifi();
        if (WiFi.status() == WL_CONNECTED && !Cloud.isAuthenticated()) {
          Cloud.authenticate();
        }
      }
    } else if (!g_wifiWasConnected) {
      Serial.printf("[wifi] back online — IP: %s\n", WiFi.localIP().toString().c_str());
      Relays.setWifiStatus(true);
      g_wifiWasConnected = true;
      if (!Cloud.isAuthenticated()) Cloud.authenticate();
    }
  }

  // ── Relay auto-off tick ──────────────────────────────────────────────────
  Relays.tick();

  // ── Periodic relay status log (every 30 s) ───────────────────────────────
  if (now - t_statusLog >= 30000) {
    t_statusLog = now;
    Relays.printStatus("periodic");
  }

  // ── Sensor reading ───────────────────────────────────────────────────────
  if (now - t_sensor >= SENSOR_READ_INTERVAL_MS) {
    t_sensor = now;
    Sensor.read();
    if (Sensor.latest().valid) {
      Serial.printf("[sensor] Moisture=%.1f%%  Temp=%.1fC\n",
        Sensor.latest().moisture_pct, Sensor.latest().temp_c);
    } else {
      Serial.println("[sensor] read failed");
    }
  }

  // ── Automation engine ────────────────────────────────────────────────────
  if (now - t_auto >= AUTO_ENGINE_INTERVAL_MS) {
    t_auto = now;
    AutoEngine.tick(Sensor.latest(), utcTimeHHMM());
  }

  // ── Cloud tasks (only when online) ───────────────────────────────────────
  if (WiFi.status() == WL_CONNECTED && Cloud.isAuthenticated()) {

    if (now - t_cmdPoll >= CMD_POLL_INTERVAL_MS) {
      t_cmdPoll = now;
      Cloud.pollCommand();
    }

    if (now - t_sensorPush >= SENSOR_PUSH_INTERVAL_MS) {
      t_sensorPush = now;
      Cloud.pushSensor(Sensor.toJson());
    }

    if (now - t_heartbeat >= HEARTBEAT_INTERVAL_MS) {
      t_heartbeat = now;
      Cloud.heartbeat(Relays.stateJson());
    }

    if (now - t_config >= CONFIG_FETCH_INTERVAL_MS) {
      t_config = now;
      Cloud.fetchConfig();
    }

    if (now - t_ota >= OTA_CHECK_INTERVAL_MS) {
      t_ota = now;
      Cloud.checkOta();
    }

  } else if (WiFi.status() == WL_CONNECTED && !Cloud.isAuthenticated()) {
    if (now - t_cmdPoll >= 30000) {
      t_cmdPoll = now;
      Cloud.authenticate();
    }
  }

  delay(10);
}
