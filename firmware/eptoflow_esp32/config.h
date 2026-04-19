/**
 * Eptoflow ESP32 firmware — user configuration.
 *
 * Copy this file and fill in your own values before flashing.
 * All secrets (WiFi password, device secret) live here. Keep your final
 * board out of version control.
 */
#pragma once

// ---------- Wi-Fi ----------
#define EPF_WIFI_SSID         "YOUR_WIFI_SSID"
#define EPF_WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"

// ---------- Backend ----------
// Use HTTP for local dev (e.g. http://192.168.1.5:4000).
// Use HTTPS in production (e.g. https://api.example.com).
#define EPF_API_BASE_URL      "http://192.168.1.5:4000"

// ---------- Device identity ----------
// These are displayed ONCE in the web UI when you claim a device.
// After you register a device in the PWA dashboard, save the values here.
#define EPF_DEVICE_UID        "EPT-XXXXXX-XXXXXX"
#define EPF_DEVICE_SECRET     "REPLACE_WITH_SERVER_ISSUED_SECRET"
#define EPF_FIRMWARE_VERSION  "1.0.0"

// ---------- GPIO pins (active LOW common for relay boards) ----------
#define EPF_VALVE1_PIN        26
#define EPF_VALVE2_PIN        27
#define EPF_VALVE3_PIN        14
#define EPF_RELAY1_PIN        25
#define EPF_MOISTURE_PIN      34     // ADC1 only (32..39)

// Set to 1 if your relay/valve modules turn ON when pin is LOW.
#define EPF_ACTIVE_LOW_OUTPUTS 1

// ---------- Timing ----------
#define EPF_HEARTBEAT_MS        30000UL   // 30 s
#define EPF_POLL_COMMANDS_MS    5000UL    //  5 s
#define EPF_MOISTURE_READ_MS    15000UL
#define EPF_OUTPUT_SAFETY_MAX_MS  (30UL * 60UL * 1000UL) // 30 min absolute ceiling
#define EPF_COOLDOWN_MS           30000UL   // minimum gap between ON→ON
