# Eptoflow — Setup, local testing, free deployment

> **Deploying on Cloudflare?** See [CLOUDFLARE.md](./CLOUDFLARE.md) for a
> 100 %-Cloudflare recipe (Pages + Workers + D1) — no Render / Vercel / Neon
> required. This document covers the Node + Postgres variant.

## 1. Prerequisites

- Node.js 20+
- Docker (recommended for local Postgres) **or** an existing Postgres 14+ DB
- Arduino IDE 2.x with the **esp32** board package and **ArduinoJson** library

## 2. Local setup

```bash
# Clone / extract the repository
cd eptoflow

# Postgres (local)
docker compose up -d postgres

# Backend
cd backend
cp .env.example .env
# Edit .env if needed (DB URL, JWT secrets, allowed origins, default admin)
npm install
npm run migrate          # applies src/db/schema.sql
npm run seed             # creates default admin from .env
npm run dev              # listens on :4000

# Frontend (new terminal)
cd ../frontend
cp .env.local.example .env.local
# NEXT_PUBLIC_API_BASE_URL must point to backend (default http://localhost:4000)
npm install
npm run dev              # http://localhost:3000
```

Visit http://localhost:3000 to use the customer PWA.
Visit http://localhost:3000/admin/login (default credentials are in `.env`)
to access the admin panel.

## 3. End-to-end smoke test (no hardware required)

You can simulate a device with `curl`:

```bash
# 1. Sign up a user, then activate Premium via admin (see admin panel)
# 2. Create a device in the PWA: Devices → + Add device. Save device_uid + device_secret.

UID="EPT-XXXX-XXXX"
SECRET="paste_from_provisioning"

# 3. Authenticate "device"
TOK=$(curl -s -X POST http://localhost:4000/api/device/auth \
       -H 'Content-Type: application/json' \
       -d "{\"device_uid\":\"$UID\",\"device_secret\":\"$SECRET\",\"firmware_version\":\"sim\"}" \
       | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 4. Heartbeat
curl -X POST http://localhost:4000/api/device/heartbeat \
     -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
     -d '{"valve1_state":false,"moisture_value":35,"wifi_rssi":-52}'

# 5. Send a command from the PWA, then poll
curl -H "Authorization: Bearer $TOK" http://localhost:4000/api/device/next

# 6. Ack execution
CMD_ID="..."
curl -X POST http://localhost:4000/api/device/ack/$CMD_ID \
     -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
     -d '{"status":"executed"}'
```

## 4. ESP32 firmware

1. Install the ESP32 board in Arduino IDE.
2. Install `ArduinoJson` (>=6) via Library Manager.
3. Open `firmware/eptoflow_esp32/eptoflow_esp32.ino`.
4. Edit `firmware/eptoflow_esp32/config.h`:
   - WiFi SSID/password
   - `EPF_API_BASE_URL` (your backend URL — http://your-pc-ip:4000 for dev)
   - `EPF_DEVICE_UID` and `EPF_DEVICE_SECRET` from your provisioning step
5. Upload to ESP32, open Serial Monitor at 115200.
6. The device should:
   - connect to WiFi
   - authenticate (`[auth] OK`)
   - heartbeat every 30 s (`[hb] code=200`)
   - poll for commands every 5 s

## 5. PWA install

- **Android (Chrome):** Open the site → menu → “Add to Home screen”.
- **iPhone (Safari):** Open the site → Share → “Add to Home Screen”.

The site is installable because it ships:
- `manifest.webmanifest`
- a registered service worker (`/sw.js`)
- HTTPS in production (or `localhost` for dev — both are PWA-compatible)

## 6. Free-tier deployment recipe

### Database — Neon (PostgreSQL)
1. Create a free project on [https://neon.tech](https://neon.tech).
2. Copy the `postgres://` connection string. Append `?sslmode=require`.
3. From any machine with `psql` (or `npm run migrate` after setting the URL):
   ```bash
   psql "$DATABASE_URL" -f backend/src/db/schema.sql
   ```

### Backend — Render / Railway / Fly free tier
1. Push the repo to GitHub.
2. New Web Service on [Render](https://render.com), pointing at `backend/`.
3. Set environment variables (`DATABASE_URL`, `JWT_SECRET`, `ADMIN_JWT_SECRET`,
   `DEVICE_JWT_SECRET`, `ALLOWED_ORIGINS=https://your-frontend.vercel.app`,
   `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`).
4. Build command: `npm install`. Start command: `npm start`.
5. After first boot, run `npm run seed` once via Render Shell.

### Frontend — Vercel free tier
1. Import the repo on [Vercel](https://vercel.com).
2. Project root: `frontend`.
3. Env: `NEXT_PUBLIC_API_BASE_URL=https://your-backend.onrender.com`.
4. Deploy. Vercel automatically gives you HTTPS.

### ESP32 firmware
1. Update `EPF_API_BASE_URL` in `config.h` to the Render URL (`https://...`).
2. Re-flash. Done.

## 7. Local testing checklist

- [ ] `npm run migrate` succeeds
- [ ] `npm run seed` creates default admin
- [ ] Sign up, verify a payment via admin → status becomes `active`
- [ ] Provision a device → save credentials
- [ ] Run firmware on ESP32 (or simulate with `curl`)
- [ ] PWA dashboard shows device as online within a minute
- [ ] Click a valve button → command appears in `recent_commands` and ack flows back
- [ ] Wait > 120 s without heartbeat → device flips to `offline`
- [ ] Suspend payment via admin → firmware turns everything off on next heartbeat

## 8. Future improvements / roadmap

1. Real payment gateways (Stripe / Razorpay) plugged into the existing
   `/payment-intent` flow without any schema changes.
2. MQTT transport (replace REST polling) using a free Mosquitto broker.
3. ESP32 OTA updates (the firmware is already structured for it).
4. Web Push notifications via VAPID + service worker.
5. PostgreSQL → TimescaleDB for `device_status_logs` long-term metrics.
6. Multi-device groups & shared schedules.
7. Multi-tenant white-labelling.
8. Localisation (i18n).
