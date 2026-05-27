# Eptoflow MQTT Topic Map

All topics are prefixed with `eptoflow/{device_uid}/`

## Device → Cloud (publish)

| Topic | Payload | Description |
|-------|---------|-------------|
| `eptoflow/{uid}/state` | `{"valve1":false,"relay1":true,...}` | Full relay state on change |
| `eptoflow/{uid}/sensor` | `{"moisture_pct":45.2,"temp_c":28.1,"read_ok":true}` | Sensor reading every 30s |
| `eptoflow/{uid}/status` | `{"online":true,"firmware":"2.0.0","ip":"192.168.x.x"}` | Heartbeat every 60s |
| `eptoflow/{uid}/alert` | `{"type":"moisture_low","valve":"valve1","value":18.5}` | Automation alert |
| `eptoflow/{uid}/ack` | `{"cmd_id":"xxx","status":"executed"}` | Command acknowledgement |

## Cloud → Device (subscribe)

| Topic | Payload | Description |
|-------|---------|-------------|
| `eptoflow/{uid}/cmd` | `{"command_type":"water_for","payload":{"target":"valve1","duration":300}}` | Execute command |
| `eptoflow/{uid}/config` | `{"relay_licenses":[...],"automation_rules":[...]}` | Push full config |
| `eptoflow/{uid}/ota` | `{"version":"2.1.0","url":"https://..."}` | Trigger OTA update |

## Command Types

| command_type | Payload | Description |
|---|---|---|
| `water_for` | `{target, duration}` | Water valve for N seconds |
| `valve_on` | `{target}` | Open valve indefinitely |
| `valve_off` | `{target}` | Close valve |
| `relay_on` | `{target}` | Turn on relay (motor/pump) |
| `relay_off` | `{target}` | Turn off relay |
| `stop_all` | `{}` | Emergency stop all |
| `activate_relay` | `{relay_key, activated}` | Enable/disable premium relay |
| `sync_automation` | `{valve_key, rule}` | Update one automation rule |
| `push_config` | `{licenses, rules, zones}` | Replace full device config |
| `reboot` | `{}` | Restart device |

## QoS Recommendations

- Commands: **QoS 1** (at-least-once)
- Sensor data: **QoS 0** (best-effort, high frequency)
- State/heartbeat: **QoS 1**
- OTA: **QoS 2** (exactly-once, critical)

## Retained Messages

- `eptoflow/{uid}/status` should be retained so the dashboard shows last-known state immediately on reconnect.
- Set LWT (Last Will): `eptoflow/{uid}/status` = `{"online":false}` with retain=true
