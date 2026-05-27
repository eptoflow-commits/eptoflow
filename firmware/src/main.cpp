/**
 * Eptoflow ESP32 Firmware v2.0.0
 * ================================
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
 * IDE: Arduino ESP32 core or PlatformIO
 *
 * Dependencies (platform.ini / board manager):
 *   - ArduinoJson@^6
 *   - WiFi (built-in)
 *   - HTTPClient (built-in)
 *   - Preferences (built-in NVS)
 *   - esp_task_wdt (built-in)
 */

#include <Arduino.h>
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
RelayManager    Relays;
ModbusSensor    Sensor;
AutomationEngine AutoEngine;
CloudClient     Cloud;

// ── WiFi credentials ─────────────────────────────────────────────────────────
// Hardcoded fallback — used when NVS has no stored credentials.
#define DEFAULT_WIFI_SSID     "eptosi"
#define DEFAULT_WIFI_PASSWORD "eptosi332"

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

// ── WiFi state ────────────────────────────────────────────────────────────────
static bool g_wifiWasConnected = false;

// ─────────────────────────────────────────────────────────────────────────────
void loadProvisioning() {
  Preferences p;
  p.begin(NVS_NS_DEVICE, true);
  g_ssid         = p.getString("ssid",       DEFAULT_WIFI_SSID);
  g_password     = p.getString("password",   DEFAULT_WIFI_PASSWORD);
  g_deviceUid    = p.getString("device_uid", "");
  g_deviceSecret = p.getString("device_sec", "");
  g_cloudUrl     = p.getString("cloud_url",  "https://api.eptoflow.com");
  p.end();
  Serial.printf("[prov] uid=%s url=%s\n", g_deviceUid.c_str(), g_cloudUrl.c_str());
}

// ─────────────────────────────────────────────────────────────────────────────
void connectWifi() {
  if (g_ssid.isEmpty()) {
    Serial.println("[wifi] no credentials — entering provisioning mode (not implemented here)");
    return;
  }
  Serial.printf("[wifi] connecting to %s\n", g_ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(g_ssid.c_str(), g_password.c_str());

  // Wait up to 15 s
  uint32_t t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) {
    delay(500); Serial.print(".");
  }

  bool connected = WiFi.status() == WL_CONNECTED;
  Serial.println();
  if (connected) {
    Serial.printf("[wifi] connected, IP: %s\n", WiFi.localIP().toString().c_str());
    configTime(0, 0, "pool.ntp.org"); // sync NTP
  } else {
    Serial.println("[wifi] connection failed — running offline");
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

  // Watchdog — reset if stuck for WDT_TIMEOUT_S seconds
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
  esp_task_wdt_add(NULL);

  // Load provisioning data from NVS
  loadProvisioning();

  // Initialise hardware
  Relays.begin();
  Sensor.begin();
  AutoEngine.begin();

  // Connect to WiFi
  connectWifi();

  if (WiFi.status() == WL_CONNECTED) {
    Cloud.begin(g_cloudUrl.c_str(), g_deviceUid.c_str(), g_deviceSecret.c_str());

    // Authenticate and fetch config on boot
    if (Cloud.authenticate()) {
      Cloud.fetchConfig();
    }
  }

  // Seed timers so first polls happen quickly
  t_sensor = t_sensorPush = t_cmdPoll = t_heartbeat = t_auto = millis();
  t_config  = t_ota = millis();

  Serial.println("[boot] setup complete");
}

// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  esp_task_wdt_reset(); // pat the watchdog

  uint32_t now = millis();

  // ── WiFi auto-reconnect ──────────────────────────────────────────────────
  if (now - t_wifiCheck >= 10000) {
    t_wifiCheck = now;
    bool connected = (WiFi.status() == WL_CONNECTED);
    if (!connected && g_wifiWasConnected) {
      Serial.println("[wifi] disconnected — reconnecting…");
      Relays.setWifiStatus(false);
      WiFi.reconnect();
      g_wifiWasConnected = false;
    } else if (connected && !g_wifiWasConnected) {
      Serial.println("[wifi] reconnected ✓");
      Relays.setWifiStatus(true);
      g_wifiWasConnected = true;
      if (!Cloud.isAuthenticated()) Cloud.authenticate();
    }
  }

  // ── Relay auto-off tick ──────────────────────────────────────────────────
  Relays.tick();

  // ── Sensor reading (non-blocking interval) ───────────────────────────────
  if (now - t_sensor >= SENSOR_READ_INTERVAL_MS) {
    t_sensor = now;
    Sensor.read();
    if (Sensor.latest().valid) {
      Serial.printf("[sensor] M=%.1f%%  T=%.1f°C\n",
        Sensor.latest().moisture_pct, Sensor.latest().temp_c);
    }
  }

  // ── Automation engine ────────────────────────────────────────────────────
  if (now - t_auto >= AUTO_ENGINE_INTERVAL_MS) {
    t_auto = now;
    AutoEngine.tick(Sensor.latest(), utcTimeHHMM());
  }

  // ── Cloud tasks (only when online) ───────────────────────────────────────
  if (WiFi.status() == WL_CONNECTED && Cloud.isAuthenticated()) {

    // Command poll
    if (now - t_cmdPoll >= CMD_POLL_INTERVAL_MS) {
      t_cmdPoll = now;
      Cloud.pollCommand();
    }

    // Sensor push
    if (now - t_sensorPush >= SENSOR_PUSH_INTERVAL_MS) {
      t_sensorPush = now;
      Cloud.pushSensor(Sensor.toJson());
    }

    // Heartbeat
    if (now - t_heartbeat >= HEARTBEAT_INTERVAL_MS) {
      t_heartbeat = now;
      Cloud.heartbeat(Relays.stateJson());
    }

    // Config re-fetch
    if (now - t_config >= CONFIG_FETCH_INTERVAL_MS) {
      t_config = now;
      Cloud.fetchConfig();
    }

    // OTA check
    if (now - t_ota >= OTA_CHECK_INTERVAL_MS) {
      t_ota = now;
      Cloud.checkOta();
    }

  } else if (WiFi.status() == WL_CONNECTED && !Cloud.isAuthenticated()) {
    // Re-authenticate if we have WiFi but lost token
    if (now - t_cmdPoll >= 30000) {
      t_cmdPoll = now;
      Cloud.authenticate();
    }
  }

  // Small yield to prevent watchdog issues under heavy HTTP use
  delay(10);
}
