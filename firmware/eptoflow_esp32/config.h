/**
 * Eptoflow ESP32 firmware — user configuration.
 *
 * Copy this file and fill in your own values before flashing.
 * All secrets (WiFi password, device secret) live here. Keep your final
 * board out of version control.
 */
#pragma once

// ---------- Wi-Fi ----------
#define EPF_WIFI_SSID         "eptosi"
#define EPF_WIFI_PASSWORD     "eptosi332"

// ---------- Backend ----------
#define EPF_API_BASE_URL      "https://eptoflow-api.onrender.com"

// ---------- Device identity ----------
#define EPF_DEVICE_UID     "EPT-720FD2-FDADDE"
#define EPF_DEVICE_SECRET  "4ac90f360a6d9784e1e1b2db274166734b2ec17fdc13a6a5"
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
