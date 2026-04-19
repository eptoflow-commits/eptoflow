# Architecture

```
                     ┌───────────────────┐
                     │       PWA         │  Next.js 14 + Tailwind + Web Speech API
                     │ (customers/admin) │  Service worker (offline shell)
                     └─────────┬─────────┘
                               │ HTTPS/JSON
                               ▼
                    ┌────────────────────┐         ┌──────────────────┐
                    │   Backend API      │────────▶│  PostgreSQL      │
                    │  Node 20 + Express │         │  (schema.sql)    │
                    │  JWT, bcrypt, zod  │         └──────────────────┘
                    │  node-cron jobs    │
                    └──────────┬─────────┘
                               ▲
                               │ Device REST (polling)
                               │  POST /api/device/auth
                               │  POST /api/device/heartbeat
                               │   GET /api/device/next
                               │  POST /api/device/ack/:id
                               │
                     ┌─────────┴─────────┐
                     │     ESP32         │   Arduino IDE firmware
                     │ firmware          │   ArduinoJson, HTTPClient
                     └───────────────────┘
```

## Command flow

1. User (or premium user via voice) clicks a control / utters a command.
2. Frontend posts to `/api/devices/:id/commands` (or `/api/voice/command`).
3. Backend authorises (auth + subscription + plan + ownership), enqueues a row
   in `commands` with `status='pending'`.
4. ESP32 polls `GET /api/device/next` every 5 s. Backend atomically picks
   the oldest pending row (`FOR UPDATE SKIP LOCKED`) and marks it
   `status='delivered'`.
5. ESP32 executes (with safety timers + cooldown) then calls
   `POST /api/device/ack/:id` with `executed` or `failed`.
6. Heartbeats every 30 s update `devices.last_seen_at` and insert rows into
   `device_status_logs`. The cron job marks devices offline after 120 s
   without heartbeat.

## Subscription enforcement — three layers

- **Frontend**: only the allowed controls are rendered.
- **Backend**: `loadSubscription` + `requirePlan` middleware, plus
  `enqueueCommand` re-validates every single command.
- **Firmware**: heartbeat response carries `subscription_active`. When `false`,
  firmware immediately calls `stopAll()` and rejects further command execution.
  `/api/device/next` also returns no command while subscription is inactive.

## Safety

- Every output has a max-on timer (default 30 min) and a 30 s cooldown.
- `duration_seconds` is clamped on both backend (SAFE_MAX_DURATION) and
  firmware (EPF_OUTPUT_SAFETY_MAX_MS).
- Stop command (`stop_all`) turns every output OFF.
- WiFi drops → firmware retries; device goes offline in DB; user gets a
  notification.
