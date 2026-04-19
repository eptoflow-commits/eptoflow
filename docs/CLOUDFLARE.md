# Eptoflow on Cloudflare — 100% free-tier deployment

All three tiers (frontend, backend, database) run on Cloudflare's free plan:

| Layer    | Service             | Free-tier limit (as of 2024)              |
| -------- | ------------------- | ----------------------------------------- |
| Frontend | Cloudflare Pages    | Unlimited static bandwidth, 500 builds/mo |
| Backend  | Cloudflare Workers  | 100k requests/day                          |
| Database | Cloudflare D1       | 5 GB storage, 5M reads/day                 |
| Cron     | Workers cron triggers | 3 triggers per worker                   |

The ESP32 firmware still polls the Worker over plain HTTPS — no protocol changes.

---

## Prerequisites

```bash
npm install -g wrangler
wrangler login
```

## 1. Create a D1 database

```bash
cd eptoflow/cloudflare/backend
wrangler d1 create eptoflow
```

Copy the returned `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "eptoflow"
database_id = "PASTE_THE_ID_HERE"
```

Apply the schema:

```bash
npm install
npm run migrate:remote    # or migrate:local for dev
```

## 2. Secrets

```bash
# From eptoflow/cloudflare/backend
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_JWT_SECRET
wrangler secret put DEVICE_JWT_SECRET
wrangler secret put DEFAULT_ADMIN_PASSWORD
```

Tip: generate strong secrets with `openssl rand -base64 48`.

## 3. Seed the default admin

```bash
DEFAULT_ADMIN_EMAIL=admin@eptoflow.local \
DEFAULT_ADMIN_PASSWORD="ChangeMe!123" \
npm run seed:remote          # writes seed.sql + runs wrangler d1 execute
```

Log in at `/admin/login` and change the password via the admin UI.

## 4. Deploy the Worker

```bash
npm run deploy
```

Wrangler prints the Worker URL, e.g. `https://eptoflow-api.<you>.workers.dev`.
The scheduled cron triggers declared in `wrangler.toml` are automatically registered.

Health check:

```bash
curl https://eptoflow-api.<you>.workers.dev/health
```

## 5. Deploy the frontend to Pages

```bash
cd ../../frontend
npm install
npm run pages:build          # runs @cloudflare/next-on-pages
npm run pages:deploy         # wrangler pages deploy
```

Set the public API URL so the PWA talks to your Worker. Either edit
`frontend/wrangler.toml` before deploy:

```toml
[vars]
NEXT_PUBLIC_API_BASE_URL = "https://eptoflow-api.<you>.workers.dev"
```

…or set it in the Cloudflare dashboard under *Pages → Settings → Environment
Variables* (Production + Preview), then redeploy.

Pages also gives the project a URL like `https://eptoflow.pages.dev`. Add that
to the Worker's allowed origins:

```bash
cd ../cloudflare/backend
# Update wrangler.toml [vars] ALLOWED_ORIGINS to include your Pages URL, e.g.
#   ALLOWED_ORIGINS = "https://eptoflow.pages.dev,https://eptoflow.com"
npm run deploy
```

## 6. ESP32 firmware

Open `firmware/eptoflow_esp32/config.h` and update:

```cpp
#define EPF_API_BASE_URL "https://eptoflow-api.<you>.workers.dev"
```

Re-flash the board. Nothing else changes — the firmware already speaks the
same REST contract (auth → heartbeat → next → ack).

## 7. PWA install

Open `https://eptoflow.pages.dev` on your phone:

- **Android (Chrome):** menu → “Install app”.
- **iPhone (Safari):** Share → “Add to Home Screen”.

HTTPS is automatic on both Pages and Workers, which satisfies the PWA install
requirement.

## 8. Everyday workflow

| Task                     | Command                                  |
| ------------------------ | ---------------------------------------- |
| Tail Worker logs         | `wrangler tail`                          |
| Run local Worker         | `npm run dev` (inside `cloudflare/backend`) |
| Run local D1             | `npm run migrate:local && npm run seed:local` |
| Run local Pages preview  | `npm run pages:dev` (inside `frontend`)  |
| Redeploy backend         | `npm run deploy`                         |
| Redeploy frontend        | `npm run pages:build && npm run pages:deploy` |

## 9. Cost & quota expectations

- A 3-valve premium device heartbeating every 30 s + polling commands every
  5 s generates roughly `(2 + 12) * 60 * 24 ≈ 20 160 requests/day` per device
  — well below the 100 000/day free-tier Worker limit.
- D1 row writes are dominated by `device_status_logs` (1 row per heartbeat).
  To stay under the 100 000 writes/day quota, run 30-second heartbeats across
  up to ~40 devices, or bump the interval for larger fleets.
- Cron triggers do not count against request quota.

## 10. Notes for Next.js on Pages

`@cloudflare/next-on-pages` runs server components on Cloudflare's edge
runtime. The Eptoflow PWA is fine out of the box — every page under
`frontend/src/app/**` is `'use client'`, so pages are prerendered statically
and only the static shell is served from Pages. If you ever add
`app/api/*` route handlers or server actions, add this to that file:

```ts
export const runtime = 'edge';
```

## 11. Troubleshooting

- **`SUBSCRIPTION_INACTIVE` on heartbeat** → user has no active subscription;
  verify a payment via `/admin/payments` or renew via `/admin/subscriptions`.
- **CORS errors in the PWA** → make sure `ALLOWED_ORIGINS` in
  `cloudflare/backend/wrangler.toml` includes your Pages URL (and commit +
  `npm run deploy` after the change).
- **Firmware stuck at `[auth] failed 403`** → the provisioning secret is one-
  time and only returned when the device is first created in the PWA. If you
  lost it, delete and re-provision the device.
- **D1 schema changes** → edit `schema-d1.sql`, then rerun `npm run migrate:remote`.
