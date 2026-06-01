#pragma once
// ============================================================================
// Eptoflow ESP32 Firmware — Hardware & Compile-time Configuration
// ============================================================================

// ── GPIO pin assignments ────────────────────────────────────────────────────
#define PIN_RS485_RO   21   // RS485 Receive Output  → ESP32 RX  (MAX485 RO)
#define PIN_RS485_DI   18   // RS485 Data Input       ← ESP32 TX  (MAX485 DI)
#define PIN_RS485_DE   22   // RS485 Driver Enable               (MAX485 DE)
#define PIN_RS485_RE   19   // RS485 Receiver Enable             (MAX485 RE)

// Relay GPIOs (active LOW — relay energises when pin is LOW)
#define PIN_RELAY1     13   // Valve 1        (irrigation)
#define PIN_RELAY2     32   // Valve 2        (irrigation) — GPIO32 (user-wired)
#define PIN_RELAY3     14   // Valve 3        (irrigation)
#define PIN_RELAY4     27   // Relay 1 / Motor / Light
#define PIN_RELAY5     26   // WiFi Status indicator  — auto-managed
#define PIN_RELAY6     25   // Premium Add-on Valve 1 — locked by default
#define PIN_RELAY7     33   // Premium Add-on Valve 2 — locked by default
#define PIN_RELAY8     17   // Premium Add-on Valve 3 — locked by default

// ── Relay mapping ───────────────────────────────────────────────────────────
// Logical key   → physical pin
// "valve1"      → PIN_RELAY1
// "valve2"      → PIN_RELAY2
// "valve3"      → PIN_RELAY3
// "relay1"      → PIN_RELAY4   (motor/pump)
// "relay5"      → PIN_RELAY5   (WiFi indicator, firmware-controlled only)
// "relay6"      → PIN_RELAY6   (premium, NVS-activated)
// "relay7"      → PIN_RELAY7   (premium, NVS-activated)
// "relay8"      → PIN_RELAY8   (premium, NVS-activated)

// ── RS485 / Modbus ──────────────────────────────────────────────────────────
#define MODBUS_BAUD        4800   // sensor baud rate (confirmed working)
#define MODBUS_SERIAL      Serial2
#define MODBUS_SLAVE_ADDR  1     // default slave address of sensor
#define MODBUS_TIMEOUT_MS  500
#define MODBUS_RETRIES     3
#define SENSOR_READ_INTERVAL_MS  10000   // read sensor every 10 s
#define SENSOR_PUSH_INTERVAL_MS  30000   // push to cloud every 30 s

// ── Cloud polling ───────────────────────────────────────────────────────────
#define CMD_POLL_INTERVAL_MS     5000    // check for new commands every 5 s
#define HEARTBEAT_INTERVAL_MS    60000   // POST heartbeat every 60 s
#define CONFIG_FETCH_INTERVAL_MS 300000  // re-fetch config every 5 min

// ── Automation safety ───────────────────────────────────────────────────────
#define MAX_VALVE_DURATION_S     1800    // 30-min hard cap per valve run
#define AUTO_ENGINE_INTERVAL_MS  15000   // run automation logic every 15 s

// ── OTA ─────────────────────────────────────────────────────────────────────
#define OTA_CHECK_INTERVAL_MS    3600000 // check for OTA update every hour
#define FIRMWARE_VERSION         "2.0.0"

// ── NVS / Preferences namespace ─────────────────────────────────────────────
#define NVS_NS_WIFI     "wifi"
#define NVS_NS_DEVICE   "device"
#define NVS_NS_RELAYS   "relays"    // stores activated premium relay bitmask
#define NVS_NS_AUTO     "auto"      // stores automation rules JSON blob

// ── Watchdog ────────────────────────────────────────────────────────────────
#define WDT_TIMEOUT_S   30

// ── MQTT (optional — define MQTT_ENABLED to use) ────────────────────────────
// #define MQTT_ENABLED
#define MQTT_BROKER    "mqtt.eptoflow.com"
#define MQTT_PORT      1883
#define MQTT_QOS       1
// Topics: eptoflow/{device_uid}/cmd  eptoflow/{device_uid}/state
//         eptoflow/{device_uid}/sensor  eptoflow/{device_uid}/ota
