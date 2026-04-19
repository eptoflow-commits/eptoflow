# Eptoflow ESP32 Firmware

Production-style Arduino IDE firmware for ESP32.

## Required libraries (Arduino Library Manager)
- **ArduinoJson** by Benoit Blanchon (>= 6.x)

`WiFi.h` and `HTTPClient.h` ship with the **esp32** board package.

## Steps

1. Install the [ESP32 board](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html) in Arduino IDE.
2. In Tools → Board, select your ESP32 dev board.
3. Open `eptoflow_esp32/eptoflow_esp32.ino`.
4. Edit `eptoflow_esp32/config.h`:
   - `EPF_WIFI_SSID` / `EPF_WIFI_PASSWORD`
   - `EPF_API_BASE_URL` (your backend URL)
   - `EPF_DEVICE_UID` / `EPF_DEVICE_SECRET` — values shown **once** when you provision a device in the PWA.
5. Upload. Open Serial Monitor at 115200 baud.

## Wiring (active-low relay/valve modules)

| Function   | GPIO | Notes                       |
|------------|------|-----------------------------|
| Valve 1    | 26   | both basic + premium        |
| Valve 2    | 27   | premium only                |
| Valve 3    | 14   | premium only                |
| Relay 1    | 25   | motor / light               |
| Moisture   | 34   | ADC1 only (32..39), premium |

If your relay modules are active-HIGH, set `EPF_ACTIVE_LOW_OUTPUTS 0` in `config.h`.

## Safety features built in

- Hard cap on output ON time: `EPF_OUTPUT_SAFETY_MAX_MS` (default 30 min).
- Cooldown between repeated turn-on: `EPF_COOLDOWN_MS` (default 30 s).
- All outputs forced OFF when backend reports `subscription_active=false`.
- Automatic Wi-Fi reconnect.
- Non-blocking main loop — no `delay()` longer than needed.
