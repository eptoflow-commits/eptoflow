/**
 * Eptoflow ESP32 firmware — user configuration.
 *
 * Hardware: ESP32 + 4-channel relay expansion board + Hi-Link HLK-5M05 PSU
 *
 * RELAY BOARD CHANNEL MAPPING:
 *   CH1 (IN1) → GPIO 19 → valve1   (solenoid valve 1)
 *   CH2 (IN2) → GPIO 22 → valve2   (solenoid valve 2)
 *   CH3 (IN3) → GPIO 21 → valve3   (solenoid valve 3)
 *   CH4 (IN4) → GPIO 23 → relay1   (motor / pump / light)
 *
 * RELAY WIRING (each channel terminal block):
 *   COM → common
 *   NO  → load (normally open — load is OFF when relay is OFF)
 *   NC  → normally closed — not used for irrigation
 *
 * Hi-Link HLK-5M05: powers the relay board + ESP32 from mains.
 *   L/N → AC mains input
 *   +V/-V → 5V DC output to relay VCC + ESP32 VIN
 *
 * NOTE: Relay modules are ACTIVE LOW.
 *   GPIO LOW  → relay coil energised → COM–NO closed → load ON
 *   GPIO HIGH → relay coil released  → COM–NO open   → load OFF
 *
 * HOW TO VERIFY YOUR PIN MAPPING:
 *   Set EPF_STARTUP_RELAY_TEST 1, flash, open Serial Monitor at 115200 baud.
 *   Each relay will click ON/OFF in sequence: CH1, CH2, CH3, CH4.
 *   Confirm the physical relay matches the channel label on the board.
 *   Set EPF_STARTUP_RELAY_TEST 0 again before production use.
 */
#pragma once

// ---------- Wi-Fi ----------
#define EPF_WIFI_SSID         "eptosi"
#define EPF_WIFI_PASSWORD     "eptosi332"

// ---------- Backend ----------
#define EPF_API_BASE_URL      "https://eptoflow-api.onrender.com"

// ---------- Device identity ----------
#define EPF_DEVICE_UID        "EPT-720FD2-FDADDE"
#define EPF_DEVICE_SECRET     "4ac90f360a6d9784e1e1b2db274166734b2ec17fdc13a6a5"
#define EPF_FIRMWARE_VERSION  "1.1.0"

// ---------- GPIO pins ----------
// 4-channel relay board: IN1..IN4 connected to these GPIO pins.
// If a relay doesn't fire, swap pins here to match your PCB silkscreen.
#define EPF_VALVE1_PIN        19   // CH1 — solenoid valve 1
#define EPF_VALVE2_PIN        22   // CH2 — solenoid valve 2
#define EPF_VALVE3_PIN        21   // CH3 — solenoid valve 3
#define EPF_RELAY1_PIN        23   // CH4 — motor / pump / light

// Moisture sensor (ADC1 only — GPIO 32..39)
#define EPF_MOISTURE_PIN      34

// 1 = relay board is active LOW (standard for most relay modules)
// 0 = active HIGH
#define EPF_ACTIVE_LOW_OUTPUTS 1

// ---------- Startup relay self-test ----------
// Set to 1 to click each relay once at boot (helps verify pin mapping).
// Each relay clicks ON for 500 ms then OFF before the next one fires.
// Set back to 0 for production use.
#define EPF_STARTUP_RELAY_TEST 0

// ---------- Timing ----------
#define EPF_HEARTBEAT_MS          30000UL   // 30 s
#define EPF_POLL_COMMANDS_MS       5000UL   //  5 s
#define EPF_MOISTURE_READ_MS      15000UL   // 15 s
#define EPF_OUTPUT_SAFETY_MAX_MS  (30UL * 60UL * 1000UL)  // 30 min hard ceiling
#define EPF_COOLDOWN_MS           30000UL   // 30 s min gap between ON→ON on same output
