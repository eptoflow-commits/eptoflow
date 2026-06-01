#pragma once
#include <Arduino.h>
#include "config.h"

// ============================================================================
// ModbusSensor — RS485 RTU soil moisture + temperature sensor
//
// Wiring:
//   MAX485 RO  → ESP32 GPIO 21  (UART2 RX)
//   MAX485 DI  → ESP32 GPIO 18  (UART2 TX)
//   MAX485 DE  → ESP32 GPIO 22  (driver enable,   HIGH=TX)
//   MAX485 RE  → ESP32 GPIO 19  (receiver enable, LOW=RX)
//
// Protocol: Modbus RTU, FC=0x03, addr=1, reg=0x0000, count=2
// Request:  01 03 00 00 00 02 C4 0B
// Response: 01 03 04 MM MM TT TT CRC_L CRC_H  (9 bytes)
//   MM MM = moisture × 0.1 %
//   TT TT = temperature × 0.1 °C (signed)
// ============================================================================

struct SensorReading {
  float    moisture_pct = -1.0f;   // 0–100 %, -1 = invalid
  float    temp_c       = -99.0f;  // °C,      -99 = invalid
  bool     valid        = false;
  uint32_t timestamp    = 0;
};

class ModbusSensor {
public:
  void begin() {
    MODBUS_SERIAL.begin(MODBUS_BAUD, SERIAL_8N1, PIN_RS485_RO, PIN_RS485_DI);
    pinMode(PIN_RS485_DE, OUTPUT);
    pinMode(PIN_RS485_RE, OUTPUT);
    setRX();
    Serial.printf("[modbus] RS485 ready — RO=%d DI=%d DE=%d RE=%d baud=%d\n",
      PIN_RS485_RO, PIN_RS485_DI, PIN_RS485_DE, PIN_RS485_RE, MODBUS_BAUD);
  }

  bool read(uint8_t slaveAddr = MODBUS_SLAVE_ADDR) {
    for (int attempt = 0; attempt < MODBUS_RETRIES; attempt++) {
      if (readOnce(slaveAddr)) return true;
      delay(200);
    }
    if (_reading.valid && (millis() - _reading.timestamp < 60000)) {
      Serial.println("[modbus] using cached reading");
      return true;
    }
    _reading.valid = false;
    Serial.println("[modbus] sensor read FAILED");
    return false;
  }

  const SensorReading& latest() const { return _reading; }

  bool isOnline() const {
    return _reading.valid && (millis() - _reading.timestamp < 60000);
  }

  String toJson(uint8_t addr = MODBUS_SLAVE_ADDR) const {
    char buf[160];
    snprintf(buf, sizeof(buf),
      "{\"sensor_addr\":%d,\"moisture_pct\":%.1f,\"temp_c\":%.1f,\"read_ok\":%s}",
      addr,
      _reading.valid ? _reading.moisture_pct : -1.0f,
      _reading.valid ? _reading.temp_c       : -99.0f,
      _reading.valid ? "true" : "false");
    return String(buf);
  }

private:
  SensorReading _reading;

  void setTX() { digitalWrite(PIN_RS485_DE, HIGH); digitalWrite(PIN_RS485_RE, HIGH); }
  void setRX() { digitalWrite(PIN_RS485_DE, LOW);  digitalWrite(PIN_RS485_RE, LOW);  }

  static uint16_t crc16(const uint8_t* d, uint8_t len) {
    uint16_t crc = 0xFFFF;
    for (uint8_t i = 0; i < len; i++) {
      crc ^= d[i];
      for (uint8_t b = 0; b < 8; b++)
        crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
    }
    return crc;
  }

  bool readOnce(uint8_t slaveAddr) {
    // Fixed request frame for count=2 (moisture + temperature)
    const uint8_t req[] = { (uint8_t)slaveAddr, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B };

    while (MODBUS_SERIAL.available()) MODBUS_SERIAL.read();

    Serial.printf("[modbus] TX: %02X %02X %02X %02X %02X %02X %02X %02X\n",
      req[0],req[1],req[2],req[3],req[4],req[5],req[6],req[7]);

    setTX();
    delayMicroseconds(500);
    MODBUS_SERIAL.write(req, sizeof(req));
    MODBUS_SERIAL.flush();
    delayMicroseconds(200);
    setRX();

    // Collect up to 16 bytes over 1500 ms
    uint32_t t = millis();
    uint8_t  buf[16];
    int      idx = 0;
    while (millis() - t < 1500 && idx < 16) {
      if (MODBUS_SERIAL.available())
        buf[idx++] = MODBUS_SERIAL.read();
    }

    Serial.printf("[modbus] RX(%d):", idx);
    for (int i = 0; i < idx; i++) Serial.printf(" %02X", buf[i]);
    Serial.println();

    if (idx < 9) return false;

    // Scan for frame header: slaveAddr 0x03 0x04
    int fs = -1;
    for (int i = 0; i <= idx - 7; i++) {
      if (buf[i] == slaveAddr && buf[i+1] == 0x03 && buf[i+2] == 0x04) {
        fs = i; break;
      }
    }
    if (fs == -1) {
      Serial.println("[modbus] frame header not found");
      return false;
    }

    uint8_t* f = &buf[fs];

    // Validate CRC
    uint16_t rxCRC  = f[7] | ((uint16_t)f[8] << 8);
    uint16_t calCRC = crc16(f, 7);
    if (rxCRC != calCRC) {
      Serial.printf("[modbus] CRC fail: got 0x%04X expected 0x%04X\n", rxCRC, calCRC);
      return false;
    }

    // Moisture
    _reading.moisture_pct = ((f[3] << 8) | f[4]) / 10.0f;

    // Temperature (signed)
    int16_t rawTemp = (int16_t)((f[5] << 8) | f[6]);
    _reading.temp_c = rawTemp / 10.0f;

    if (_reading.moisture_pct < 0 || _reading.moisture_pct > 100) return false;
    if (_reading.temp_c < -40   || _reading.temp_c > 80)           return false;

    _reading.valid     = true;
    _reading.timestamp = millis();
    return true;
  }
};

extern ModbusSensor Sensor;
