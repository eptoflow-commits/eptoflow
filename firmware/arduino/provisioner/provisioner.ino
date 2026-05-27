/**
 * Eptoflow NVS Provisioner
 * ========================
 * Upload this sketch ONCE to store WiFi + device credentials in NVS.
 * After you see "✅ Done!" in Serial Monitor, upload main.ino.
 *
 * Steps:
 *   1. Get device_uid + device_secret from your Eptoflow dashboard
 *   2. Fill in the values below
 *   3. Upload this sketch
 *   4. Open Serial Monitor (115200 baud) — confirm "✅ Done!"
 *   5. Upload firmware/arduino/main/main.ino
 */

#include <Preferences.h>

// ── Fill these in ────────────────────────────────────────────────────────────
const char* WIFI_SSID      = "eptosi";
const char* WIFI_PASSWORD  = "eptosi332";
const char* DEVICE_UID     = "";       // ← e.g. "EPT-A1B2C3D4"
const char* DEVICE_SECRET  = "";       // ← from dashboard (shown once)
const char* CLOUD_URL      = "https://eptoflow-api.onrender.com";
// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("\n[provisioner] Starting...");

  if (strlen(DEVICE_UID) == 0 || strlen(DEVICE_SECRET) == 0) {
    Serial.println("❌ ERROR: DEVICE_UID and DEVICE_SECRET are empty!");
    Serial.println("   Fill them in and re-upload this sketch.");
    return;
  }

  Preferences p;
  p.begin("device", false);
  p.putString("ssid",       WIFI_SSID);
  p.putString("password",   WIFI_PASSWORD);
  p.putString("device_uid", DEVICE_UID);
  p.putString("device_sec", DEVICE_SECRET);
  p.putString("cloud_url",  CLOUD_URL);
  p.end();

  Serial.println("✅ Done! Credentials saved to NVS.");
  Serial.println("   Now upload firmware/arduino/main/main.ino");
  Serial.println();
  Serial.printf("   WiFi:   %s\n", WIFI_SSID);
  Serial.printf("   UID:    %s\n", DEVICE_UID);
  Serial.printf("   URL:    %s\n", CLOUD_URL);
}

void loop() {
  // Nothing to do
}
