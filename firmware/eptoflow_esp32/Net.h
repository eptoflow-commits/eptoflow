#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

namespace Net {

static String        g_token          = "";
static unsigned long g_lastWifiCheck  = 0;
static bool          g_wifiStarted    = false;
static const unsigned long WIFI_RETRY_MS = 5000UL;

// Call once from loop() — never from setup()
inline void wifiBegin() {
  if (g_wifiStarted) return;
  g_wifiStarted = true;
  WiFi.persistent(false);
  WiFi.setSleep(false);           // prevents CPU hogging / WDT
  WiFi.setAutoReconnect(true);
  WiFi.mode(WIFI_STA);
  yield();
  WiFi.begin(EPF_WIFI_SSID, EPF_WIFI_PASSWORD);
  Serial.printf("[wifi] begin -> '%s'\n", EPF_WIFI_SSID);
}

inline bool isConnected() { return WiFi.status() == WL_CONNECTED; }

inline void loop() {
  unsigned long now = millis();

  // Kick off WiFi on first loop call
  if (!g_wifiStarted) { wifiBegin(); return; }

  if (isConnected()) {
    g_lastWifiCheck = now;
    return;
  }

  // Non-blocking retry every WIFI_RETRY_MS
  if (now - g_lastWifiCheck < WIFI_RETRY_MS) {
    yield();
    return;
  }
  g_lastWifiCheck = now;

  switch (WiFi.status()) {
    case WL_NO_SSID_AVAIL:  Serial.println("[wifi] SSID not found"); break;
    case WL_CONNECT_FAILED: Serial.println("[wifi] wrong password"); break;
    default: Serial.printf("[wifi] retry (status=%d)\n", WiFi.status()); break;
  }

  WiFi.disconnect(false);
  yield();
  delay(100);
  WiFi.begin(EPF_WIFI_SSID, EPF_WIFI_PASSWORD);
}

inline void setToken(const String& t)  { g_token = t; }
inline bool hasToken()                  { return g_token.length() > 0; }
inline void clearToken()                { g_token = ""; }

inline String fullUrl(const String& path) {
  String b = EPF_API_BASE_URL;
  if (b.endsWith("/")) b.remove(b.length() - 1);
  return b + path;
}

inline int httpPostJson(const String& path, JsonDocument& body,
                        JsonDocument* outDoc = nullptr, String* outBody = nullptr,
                        bool useAuth = true) {
  if (!isConnected()) return -1;
  WiFiClientSecure client;
  client.setInsecure(); // skip cert verification (backend uses valid cert anyway)
  HTTPClient  http;
  http.setTimeout(8000);
  if (!http.begin(client, fullUrl(path))) return -2;
  http.addHeader("Content-Type", "application/json");
  if (useAuth && hasToken()) http.addHeader("Authorization", "Bearer " + g_token);
  String payload;
  serializeJson(body, payload);
  int code = http.POST(payload);
  if (outDoc || outBody) {
    String resp = http.getString();
    if (outBody) *outBody = resp;
    if (outDoc && resp.length()) deserializeJson(*outDoc, resp);
  }
  http.end();
  yield();
  return code;
}

inline int httpGetJson(const String& path, JsonDocument* outDoc = nullptr,
                       String* outBody = nullptr, bool useAuth = true) {
  if (!isConnected()) return -1;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient  http;
  http.setTimeout(8000);
  if (!http.begin(client, fullUrl(path))) return -2;
  if (useAuth && hasToken()) http.addHeader("Authorization", "Bearer " + g_token);
  int code = http.GET();
  if (outDoc || outBody) {
    String resp = http.getString();
    if (outBody) *outBody = resp;
    if (outDoc && resp.length()) deserializeJson(*outDoc, resp);
  }
  http.end();
  yield();
  return code;
}

} // namespace Net
