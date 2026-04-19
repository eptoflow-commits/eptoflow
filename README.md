# Eptoflow — Plant Watering Automation Platform

A commercial subscription-based irrigation & automation platform built on **100% free and open-source** stack.

```
PWA (Next.js)  ─┐
                 ├──▶  Backend (Node.js/Express + PostgreSQL)  ◀── polls ──  ESP32 Firmware
Admin Panel  ───┘
```

## Monorepo Layout

```
eptoflow/
├─ backend/              # Node.js + Express + PostgreSQL API
├─ frontend/             # Next.js 14 PWA (customer + admin panel)
├─ firmware/             # ESP32 Arduino IDE firmware
├─ cloudflare/backend/   # Same API ported to Cloudflare Workers + D1 (Hono)
├─ docs/                 # Architecture docs, schema, API reference
└─ docker-compose.yml    # Local Postgres + backend
```

## Tech Stack (all free / open-source)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, PWA |
| Backend | Node.js 20, Express, JWT, bcrypt |
| Database | PostgreSQL 16 |
| Voice | Web Speech API (browser native) |
| Firmware | ESP32 + Arduino IDE (ArduinoJson, WiFi, HTTPClient) |
| Deployment | Vercel + Render/Railway/Fly + Neon/Supabase (free) **or** 100% Cloudflare (Pages + Workers + D1) |

## Quick Start

```bash
# 1. Start Postgres
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run migrate     # runs schema.sql
npm run seed        # creates default admin
npm run dev

# 3. Frontend
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 for the PWA and http://localhost:3000/admin for admin.

See [`docs/SETUP.md`](docs/SETUP.md) for the Node + Postgres recipe and
[`docs/CLOUDFLARE.md`](docs/CLOUDFLARE.md) for the all-Cloudflare recipe.

## Plans

| Plan | Price | Valves | Relay | Moisture | Voice |
|------|-------|--------|-------|----------|-------|
| Basic | $2.99 / 30d | 1 | 1 | ❌ | ❌ |
| Premium | $3.99 / 30d | 3 | 1 | ✅ | ✅ |

Subscriptions are verified manually by admin (no paid gateway).
