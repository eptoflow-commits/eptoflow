# API Reference

All endpoints return JSON. Errors use the shape:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Missing token", "details": null } }
```

## Auth

### `POST /api/auth/signup`
```json
// request
{ "full_name": "Asha", "email": "asha@example.com", "password": "secret123" }
// response 201
{ "user": { "id": "…", "email": "asha@example.com", ... }, "token": "eyJhbGciOi..." }
```

### `POST /api/auth/login`
```json
// request
{ "email": "asha@example.com", "password": "secret123" }
// response 200
{ "user": { ... }, "token": "eyJ..." }
```

### `GET /api/auth/me`   (Bearer user token)
```json
{ "user": { "id": "...", "full_name": "...", "email": "..." } }
```

### `POST /api/auth/admin/login`
```json
{ "email": "admin@eptoflow.local", "password": "ChangeMe!Admin123" }
// -> { "admin": {...}, "token": "..." }
```

## Subscriptions

### `GET /api/subscriptions/me`
```json
{
  "subscription": {
    "id": "...",
    "plan_name": "premium",
    "status": "active",
    "start_date": "2026-04-01T00:00:00Z",
    "end_date": "2026-05-01T00:00:00Z",
    "isActive": true,
    "daysRemaining": 12
  },
  "plan": { "plan": "premium", "maxValves": 3, "hasVoice": true, ... },
  "plans_catalog": { "basic": {...}, "premium": {...} }
}
```

### `POST /api/subscriptions/payment-intent`
```json
// request
{ "plan": "premium", "payment_reference": "UPI-2026-ABC123",
  "screenshot_url_or_note": "https://pic.host/mypayment.png" }
// response 201
{ "subscription": { ... "status": "pending" }, "payment": { ... } }
```

## Devices (user)

### `GET /api/devices`  → `{ devices: Device[] }`

### `POST /api/devices`
```json
// response 201 (device_secret is shown ONCE)
{
  "device": { "id": "...", "device_uid": "EPT-ABC123-DEF456", ... },
  "provisioning": {
    "device_uid":    "EPT-ABC123-DEF456",
    "device_secret": "paste_this_into_config_h_only_this_time"
  },
  "plan": { ... }
}
```

### `GET /api/devices/:id` → device + last status + recent commands

### `POST /api/devices/:id/commands`
```json
// request
{ "command_type": "valve_on", "payload": { "target": "valve1" }, "source": "manual" }
// response 202
{ "command": { "id": "...", "status": "pending" } }
```

Valid `command_type`:  `valve_on`, `valve_off`, `relay_on`, `relay_off`, `water_for`, `stop_all`.

### `DELETE /api/devices/:id`

## Schedules

### `GET /api/schedules` → `{ schedules: [...] }`

### `POST /api/schedules`
```json
{
  "device_id": "...",
  "zone_or_output": "valve1",
  "days_of_week": [1,2,3,4,5],
  "start_time": "06:30",
  "duration_seconds": 300,
  "enabled": true
}
```

## Voice (premium)

### `POST /api/voice/command`
```json
// request
{ "device_id": "...", "transcript": "turn on valve 1" }
// response 202
{
  "command": { "id": "...", "command_type": "valve_on", "payload": { "target": "valve1" } },
  "parsed": { "command_type": "valve_on", "payload": { "target": "valve1" } }
}
```

## Notifications

- `GET /api/notifications` → `{ notifications: [...], unread: N }`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

## Device-facing API (ESP32)

All endpoints except `/auth` require `Authorization: Bearer <device-JWT>`.

### `POST /api/device/auth`
```json
// request
{ "device_uid": "EPT-ABC123-DEF456", "device_secret": "…", "firmware_version": "1.0.0" }
// response
{ "token": "eyJ…", "device": { "id": "...", "plan_bound": "basic" } }
```

### `POST /api/device/heartbeat`
```json
// request
{ "relay1_state": false, "valve1_state": true,
  "moisture_value": 42, "wifi_rssi": -54, "ip": "192.168.1.20" }
// response
{ "ok": true, "subscription_active": true, "plan_bound": "premium",
  "server_time": "2026-04-19T10:00:00Z" }
```

### `GET /api/device/next`
```json
// when a command is pending
{ "command": { "id": "...", "command_type": "water_for", "payload": { "target": "valve1", "duration": 120 } },
  "subscription_active": true }
// when nothing pending
{ "command": null, "subscription_active": true }
```

### `POST /api/device/ack/:cmdId`
```json
// request
{ "status": "executed" }
// or on error
{ "status": "failed", "error": "cooldown" }
// response
{ "command": { "id": "...", "status": "executed", ... } }
```

## Admin

All admin routes require `Authorization: Bearer <admin-JWT>`.

- `GET  /api/admin/dashboard`
- `GET  /api/admin/users` · `POST /api/admin/users/:id/status` (suspend/reactivate)
- `GET  /api/admin/devices` · `POST /api/admin/devices/:id/enabled` · `POST /api/admin/devices/:id/assign`
- `GET  /api/admin/subscriptions` · `POST /api/admin/subscriptions/renew`
- `GET  /api/admin/payments?status=pending` · `POST /api/admin/payments/:id/verify`
- `GET  /api/admin/schedules`
- `GET  /api/admin/audit-logs`
