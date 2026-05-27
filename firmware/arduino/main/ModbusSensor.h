#pragma once
#include <Arduino.h>
#include "config.h"

// ============================================================================
// ModbusSensor — RS485 RTU soil moisture + temperature sensor
//
// Typical sensor register map (most Chinese RS485 sensors):
//   0x0000 = Moisture  (×0.1 %)
//   0x0001 = Temperature (×0.1 °C, signed)
//
// Protocol: Modbus RTU, Function 0x03 (Read Holding Registers)
// CRC: CRC-16/Modbus (poly 0x8005, init 0xFFFF)
// ============================================================================

struct SensorReading {
  float   moisture_pct = -1.0f;  // 0.0 – 100.0, -1 = invalid
  float   temp_c       = -99.0f; // °C, -99 = invalid
  int16_t raw_moisture =  0;
  int16_t raw_temp     =  0;
  bool    valid        = false;
  uint32_t timestamp   = 0;      // millis() of last successful read
};

class ModbusSensor {
public:
  void begin() {
    MODBUS_SERIAL.begin(MODBUS_BAUD, SERIAL_8N1, PIN_RS485_RO, PIN_RS485_DI);
    pinMode(PIN_RS485_DE, OUTPUT);
    digitalWrite(PIN_RS485_DE, LOW); // receive mode
    Serial.println("[modbus] RS485 sensor initialised");
  }

  // ── Read sensor (blocking, with retries) ────────────────────────────────
  bool read(uint8_t slaveAddr = MODBUS_SLAVE_ADDR) {
    for (int attempt = 0; attempt < MODBUS_RETRIES; attempt++) {
      if (readOnce(slaveAddr)) return true;
      delay(200);
    }
    // Cache miss — keep last valid if not too stale (< 60 s)
    if (_reading.valid && (millis() - _reading.timestamp < 60000)) {
      Serial.println("[modbus] using cached reading");
      return true;
    }
    _reading.valid = false;
    Serial.println("[modbus] sensor read FAILED");
    return false;
  }

  const SensorReading& latest() const { return _reading; }

  // ── Check if sensor is responsive ───────────────────────────────────────
  bool isOnline() const {
    return _reading.valid && (millis() - _reading.timestamp < 60000);
  }

  // ── JSON for cloud upload ────────────────────────────────────────────────
  String toJson(uint8_t addr = MODBUS_SLAVE_ADDR) const {
    char buf[160];
    snprintf(buf, sizeof(buf),
      "{\"sensor_addr\":%d,\"moisture_pct\":%.1f,\"temp_c\":%.1f,"
      "\"raw_moisture\":%d,\"raw_temp\":%d,\"read_ok\":%s}",
      addr,
      _reading.valid ? _reading.moisture_pct : -1.0f,
      _reading.valid ? _reading.temp_c       : -99.0f,
      _reading.raw_moisture, _reading.raw_temp,
      _reading.valid ? "true" : "false");
    return String(buf);
  }

  // ── Diagnostic scan — call once from setup() to debug wiring ────────────
  // Tries slave addresses 1–5 and prints raw bytes to Serial.
  // Remove/comment out after sensor is confirmed working.
  void diagScan() {
    Serial.println("[modbus-diag] === SENSOR SCAN START ===");
    Serial.printf("[modbus-diag] baud=%d  RO=GPIO%d  DI=GPIO%d  DE=GPIO%d\n",
      MODBUS_BAUD, PIN_RS485_RO, PIN_RS485_DI, PIN_RS485_DE);

    for (uint8_t addr = 1; addr <= 5; addr++) {
      Serial.printf("[modbus-diag] trying slave addr %d …\n", addr);

      while (MODBUS_SERIAL.available()) MODBUS_SERIAL.read();

      uint8_t req[8];
      buildRequest(req, addr, 0x0000, 2);

      // print the request bytes we're sending
      Serial.print("[modbus-diag] TX: ");
      for (int i = 0; i < 8; i++) Serial.printf("%02X ", req[i]);
      Serial.println();

      digitalWrite(PIN_RS485_DE, HIGH);
      delayMicroseconds(200);
      MODBUS_SERIAL.write(req, 8);
      MODBUS_SERIAL.flush();
      delayMicroseconds(200);
      digitalWrite(PIN_RS485_DE, LOW);

      // wait up to 1 s for any bytes at all
      uint32_t t = millis();
      uint8_t  resp[32];
      int      rLen = 0;
      while (millis() - t < 1000 && rLen < 32) {
        if (MODBUS_SERIAL.available()) {
          resp[rLen++] = MODBUS_SERIAL.read();
        }
      }

      if (rLen == 0) {
        Serial.println("[modbus-diag] RX: (nothing — check A/B wiring or power)");
      } else {
        Serial.printf("[modbus-diag] RX (%d bytes): ", rLen);
        for (int i = 0; i < rLen; i++) Serial.printf("%02X ", resp[i]);
        Serial.println();
      }

      delay(300);
    }
    Serial.println("[modbus-diag] === SENSOR SCAN END ===");
  }

private:
  SensorReading _reading;

  // ── CRC-16 Modbus ────────────────────────────────────────────────────────
  static uint16_t crc16(const uint8_t* data, size_t len) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; i++) {
      crc ^= data[i];
      for (int b = 0; b < 8; b++) {
        if (crc & 0x0001) { crc >>= 1; crc ^= 0xA001; }
        else               { crc >>= 1; }
      }
    }
    return crc;
  }

  // ── Build RTU request ────────────────────────────────────────────────────
  void buildRequest(uint8_t* buf, uint8_t slave, uint16_t reg, uint16_t count) {
    buf[0] = slave;
    buf[1] = 0x03;           // Read Holding Registers
    buf[2] = reg >> 8;
    buf[3] = reg & 0xFF;
    buf[4] = count >> 8;
    buf[5] = count & 0xFF;
    uint16_t c = crc16(buf, 6);
    buf[6] = c & 0xFF;
    buf[7] = c >> 8;
  }

  // ── Single read attempt ──────────────────────────────────────────────────
  bool readOnce(uint8_t slaveAddr) {
    while (MODBUS_SERIAL.available()) MODBUS_SERIAL.read();

    uint8_t req[8];
    buildRequest(req, slaveAddr, 0x0000, 2);

    digitalWrite(PIN_RS485_DE, HIGH);
    delayMicroseconds(200);
    MODBUS_SERIAL.write(req, 8);
    MODBUS_SERIAL.flush();
    delayMicroseconds(200);
    digitalWrite(PIN_RS485_DE, LOW);

    uint32_t t = millis();
    uint8_t  resp[16];
    int      rLen = 0;
    while (millis() - t < MODBUS_TIMEOUT_MS) {
      if (MODBUS_SERIAL.available()) {
        resp[rLen++] = MODBUS_SERIAL.read();
        if (rLen >= 9) break;
      }
    }

    if (rLen < 9) return false;

    uint16_t rxCrc   = resp[7] | (resp[8] << 8);
    uint16_t calcCrc = crc16(resp, 7);
    if (rxCrc != calcCrc) {
      Serial.printf("[modbus] CRC mismatch: got 0x%04X, expected 0x%04X\n", rxCrc, calcCrc);
      return false;
    }

    if (resp[0] != slaveAddr || resp[1] != 0x03 || resp[2] != 4) return false;

    _reading.raw_moisture = (int16_t)((resp[3] << 8) | resp[4]);
    _reading.raw_temp     = (int16_t)((resp[5] << 8) | resp[6]);
    _reading.moisture_pct = _reading.raw_moisture * 0.1f;
    _reading.temp_c       = _reading.raw_temp     * 0.1f;

    if (_reading.moisture_pct < 0 || _reading.moisture_pct > 100) return false;
    if (_reading.temp_c < -40   || _reading.temp_c > 80)           return false;

    _reading.valid     = true;
    _reading.timestamp = millis();
    return true;
  }
};

extern ModbusSensor Sensor;
