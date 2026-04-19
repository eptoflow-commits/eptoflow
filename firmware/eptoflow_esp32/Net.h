/**
 * Eptoflow — Network + REST helpers.
 *
 * Handles WiFi connection (with auto-reconnect), JWT bearer storage, and
 * convenience POST/GET helpers using HTTPClient.
 *
 * Requires: ArduinoJson (>= 6.x).  Install via Library Manager.
 */
#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

namespace Net {

static String g_token = "";
static unsigned long g_lastWiFiAttempt = 0;
static const unsigned long WIFI_RETRY_MS = 5000;

inline void wifiBegin() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(EPF_WIFI_SSID, EPF_WIFI_PASSWORD);
  Serial.printf("[wifi] connecting to %s\n", EPF_WIFI_SSID);
}

inline bool isConnected() { return WiFi.status() == WL_CONNECTED; }

inline void loop() {
  if (isConnected()) return;
  unsigned long now = millis();
  if (now - g_lastWiFiAttempt < WIFI_RETRY_MS) return;
  g_lastWiFiAttempt = now;
  Serial.println("[wifi] reconnecting...");
  WiFi.disconnect();
  WiFi.begin(EPF_WIFI_SSID, EPF_WIFI_PASSWORD);
}

inline void setToken(const String& t) { g_token = t; }
inline bool hasToken() { return g_token.length() > 0; }
inline void clearToken() { g_token = ""; }

inline String fullUrl(const String& path) {
  String b = String(EPF_API_BASE_URL);
  if (b.endsWith("/")) b.remove(b.length() - 1);
  return b + path;
}

/**
 * POST a JSON document. Returns HTTP code; populates `outBody` and parses `outDoc`
 * if the response is JSON.
 */
inline int httpPostJson(const String& path, JsonDocument& body,
                        JsonDocument* outDoc = nullptr, String* outBody = nullptr,
                        bool useAuth = true) {
  if (!isConnected()) return -1;
  HTTPClient http;
  http.setTimeout(8000);
  http.begin(fullUrl(path));
  http.addHeader("Content-Type", "application/json");
  if (useAuth && hasToken()) http.addHeader("Authorization", "Bearer " + g_token);
  String payload;
  serializeJson(body, payload);
  int code = http.POST(payload);
  String resp = http.getString();
  if (outBody) *outBody = resp;
  if (outDoc && resp.length()) deserializeJson(*outDoc, resp);
  http.end();
  return code;
}

inline int httpGetJson(const String& path, JsonDocument* outDoc = nullptr,
                       String* outBody = nullptr, bool useAuth = true) {
  if (!isConnected()) return -1;
  HTTPClient http;
  http.setTimeout(8000);
  http.begin(fullUrl(path));
  if (useAuth && hasToken()) http.addHeader("Authorization", "Bearer " + g_token);
  int code = http.GET();
  String resp = http.getString();
  if (outBody) *outBody = resp;
  if (outDoc && resp.length()) deserializeJson(*outDoc, resp);
  http.end();
  return code;
}

} // namespace Net
