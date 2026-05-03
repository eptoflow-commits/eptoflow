/**
 * Eptoflow — Output (valve/relay) abstraction with safety timers.
 *
 * - All outputs share a max-on timer (EPF_OUTPUT_SAFETY_MAX_MS) so hardware
 *   can never be left running.
 * - Cooldown between repeated ON→ON prevents pump / solenoid stress.
 * - Non-blocking: call Outputs::loop() from main loop().
 */
#pragma once
#include <Arduino.h>
#include "config.h"

namespace Outputs {

enum Id { VALVE1 = 0, VALVE2, VALVE3, RELAY1, COUNT };

static const char* names[COUNT] = { "valve1", "valve2", "valve3", "relay1" };

struct OutputState {
  uint8_t  pin;
  bool     on;
  uint32_t turnedOnAt;
  uint32_t plannedOffAt;   // 0 = no scheduled off
  uint32_t lastOffAt;
};

static OutputState states[COUNT];

inline void writePhysical(uint8_t pin, bool on) {
#if EPF_ACTIVE_LOW_OUTPUTS
  digitalWrite(pin, on ? LOW : HIGH);
#else
  digitalWrite(pin, on ? HIGH : LOW);
#endif
}

inline void setup() {
  states[VALVE1].pin = EPF_VALVE1_PIN;
  states[VALVE2].pin = EPF_VALVE2_PIN;
  states[VALVE3].pin = EPF_VALVE3_PIN;
  states[RELAY1].pin = EPF_RELAY1_PIN;
  for (int i = 0; i < COUNT; ++i) {
    // CRITICAL for active-LOW relay boards:
    // Write the OFF level BEFORE calling pinMode(OUTPUT).
    // If pinMode is called first, the pin momentarily floats LOW
    // which energises the relay. Writing first avoids this glitch.
#if EPF_ACTIVE_LOW_OUTPUTS
    digitalWrite(states[i].pin, HIGH);   // HIGH = relay OFF for active-LOW boards
#else
    digitalWrite(states[i].pin, LOW);    // LOW  = relay OFF for active-HIGH boards
#endif
    pinMode(states[i].pin, OUTPUT);
    states[i].on = false;
    states[i].turnedOnAt = 0;
    states[i].plannedOffAt = 0;
    states[i].lastOffAt = 0;
    Serial.printf("[out] pin %d → OFF (init)\n", states[i].pin);
  }
}

inline Id fromName(const String& n) {
  for (int i = 0; i < COUNT; ++i) if (n.equalsIgnoreCase(names[i])) return (Id)i;
  return (Id)-1;
}

inline bool isOn(Id id)  { return (id >= 0 && id < COUNT) ? states[id].on : false; }
inline uint8_t pinOf(Id id) { return states[id].pin; }

inline bool turnOn(Id id, uint32_t durationMs = 0) {
  if (id < 0 || id >= COUNT) return false;
  OutputState& s = states[id];
  uint32_t now = millis();
  // Cooldown check
  if (!s.on && s.lastOffAt && (now - s.lastOffAt) < EPF_COOLDOWN_MS) {
    Serial.printf("[out] %s cooldown active, rejecting turnOn\n", names[id]);
    return false;
  }
  s.on = true;
  s.turnedOnAt = now;
  // Clamp duration to safety max.
  if (durationMs == 0 || durationMs > EPF_OUTPUT_SAFETY_MAX_MS) durationMs = EPF_OUTPUT_SAFETY_MAX_MS;
  s.plannedOffAt = now + durationMs;
  writePhysical(s.pin, true);
  Serial.printf("[out] %s ON (duration %lums)\n", names[id], (unsigned long)durationMs);
  return true;
}

inline bool turnOff(Id id) {
  if (id < 0 || id >= COUNT) return false;
  OutputState& s = states[id];
  if (!s.on) return true;
  s.on = false;
  s.plannedOffAt = 0;
  s.lastOffAt = millis();
  writePhysical(s.pin, false);
  Serial.printf("[out] %s OFF\n", names[id]);
  return true;
}

inline void stopAll() {
  for (int i = 0; i < COUNT; ++i) turnOff((Id)i);
}

inline void loop() {
  uint32_t now = millis();
  for (int i = 0; i < COUNT; ++i) {
    OutputState& s = states[i];
    if (s.on && s.plannedOffAt && (int32_t)(now - s.plannedOffAt) >= 0) {
      Serial.printf("[out] %s auto-off (safety/timer)\n", names[i]);
      turnOff((Id)i);
    }
  }
}

inline bool anyOn() {
  for (int i = 0; i < COUNT; ++i) if (states[i].on) return true;
  return false;
}

} // namespace Outputs
