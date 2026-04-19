# Eptoflow — Production Deployment Guide

Two fully-free deployment targets. Choose **Stack A** (Node + Postgres + Vercel) for the
easiest setup, or **Stack B** (100% Cloudflare) for zero cold-starts and global edge
performance. Both obey the same REST contract — your firmware and PWA work with either.

---

## Stack A — Node + Postgres + Vercel

### Services used (all free tiers)

| Layer | Service | Free tier |
|-------|---------|-----------|
| Database | [Neon](https://neon.tech) or [Supabase](https://supabase.com) | 0.5 GB storage, shared compute |
| Backend API | [Render](https://render.com) | 750 h/month (always-on for 1 service) |
| Frontend PWA | [Vercel](https://vercel.com) | Unlimited hobby deploys |

---

### Step 1 — Postgres database (Neon, ~3 min)

1. Sign up at https://neon.tech → **New Project** → name it `eptoflow`
2. Copy the **connection string** shown — looks like:
   ```
   postgres://eptoflow_user:PASS@ep-xxx.us-east-1.aws.neon.tech/eptoflow?sslmode=require
   ```
3. Keep this string handy — you'll paste it into Render in Step 2.

> **Supabase alternative**: New project → Settings → Database → Connection String (URI mode).

---

### Step 2 — Backend API (Render, ~10 min)

#### Option A — Deploy via render.yaml (recommended)

```bash
# In your terminal, from the repo root:
git add .
git commit -m "Add render.yaml"
git push origin main
```

1. Go to https://dashboard.render.com → **New** → **Blueprint**
2. Connect your GitHub repo, select the `backend/render.yaml` file
3. Render reads the blueprint and creates the web service
4. In the service settings, **override** these env vars:
   - `DATABASE_URL` → paste your Neon connection string
   - `DEFAULT_ADMIN_EMAIL` → your admin email
   - `ALLOWED_ORIGINS` → `https://YOUR-APP.vercel.app` (fill in after Step 3)
5. Click **Apply** — Render installs deps, runs `npm run migrate`, starts the server

#### Option B — Manual setup

1. Render → New **Web Service** → connect GitHub → select `backend/` as root dir
2. **Build Command**: `npm install && npm run migrate`
3. **Start Command**: `node src/server.js`
4. Add all env vars from `backend/.env.example` (use strong random strings for secrets):

```bash
# Generate strong secrets (run these in your terminal):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Required env vars:

```
NODE_ENV=production
PORT=4000
DATABASE_URL=<your Neon/Supabase connection string>
JWT_SECRET=<32+ char random string>
ADMIN_JWT_SECRET=<32+ char random string>
DEVICE_JWT_SECRET=<32+ char random string>
JWT_EXPIRES_IN=7d
DEVICE_JWT_EXPIRES_IN=30d
ALLOWED_ORIGINS=https://YOUR-APP.vercel.app
DEFAULT_ADMIN_EMAIL=admin@yourdomain.com
DEFAULT_ADMIN_PASSWORD=<strong password — change after first login>
HEARTBEAT_OFFLINE_SECONDS=120
SUBSCRIPTION_DAYS=30
```

#### Seed the admin (one-time, after first deploy)

In Render dashboard → your web service → **Shell**:
```bash
npm run seed
```

This creates the admin user defined by `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`.

#### Health check

```bash
curl https://YOUR-BACKEND.onrender.com/health
# → {"ok":true,"service":"eptoflow-api","time":"..."}
```

---

### Step 3 — Frontend PWA (Vercel, ~5 min)

1. Sign up at https://vercel.com → **Add New Project** → import your GitHub repo
2. Set **Root Directory** to `frontend/`
3. Framework: **Next.js** (auto-detected)
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_BASE_URL = https://YOUR-BACKEND.onrender.com
   ```
5. Click **Deploy**

After deploy, copy your Vercel URL (`https://YOUR-APP.vercel.app`) and update:
- `ALLOWED_ORIGINS` in Render → **your Vercel URL**
- Redeploy the Render service (or it picks up on next git push)

#### PWA install check

Open the Vercel URL on Android Chrome → three-dot menu → **Add to home screen**.
On iOS Safari → Share → **Add to Home Screen**.

---

### Stack A — Final checklist

- [ ] `GET https://YOUR-BACKEND.onrender.com/health` returns `{"ok":true}`
- [ ] Sign up at `https://YOUR-APP.vercel.app/signup` — creates a user
- [ ] Log in at `https://YOUR-APP.vercel.app/admin/login` with admin credentials
- [ ] Admin dashboard shows user count = 1
- [ ] PWA installs on mobile
- [ ] Firmware `config.h` updated with backend URL (see Firmware section below)

---

## Stack B — 100% Cloudflare (Workers + D1 + Pages)

### Services used (all free tiers)

| Layer | Service | Free limit |
|-------|---------|------------|
| Database | Cloudflare D1 | 5 GB storage, 5M reads/day, 100K writes/day |
| Backend | Cloudflare Workers | 100K requests/day |
| Frontend | Cloudflare Pages | Unlimited static deploys |

> **D1 write headroom**: At 30-second heartbeat cadence, each device generates ~2,880
> writes/day. The free tier supports ~34 simultaneously active devices before hitting
> 100K writes/day. Add a log-retention job before scaling beyond that.

---

### Prerequisites

```bash
npm install -g wrangler
wrangler login      # opens browser for Cloudflare auth
```

---

### Step 1 — Create the D1 database

```bash
cd cloudflare/backend

wrangler d1 create eptoflow
```

Copy the output — it looks like:
```
✅ Successfully created DB 'eptoflow'
[[d1_databases]]
binding = "DB"
database_name = "eptoflow"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Paste the `database_id` into `cloudflare/backend/wrangler.toml`**:

```toml
[[d1_databases]]
binding = "DB"
database_name = "eptoflow"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   ← replace this
```

---

### Step 2 — Apply schema to D1

```bash
# Remote (production) database:
npm run migrate:remote

# Local dev database (for wrangler dev):
npm run migrate:local
```

---

### Step 3 — Set secrets

```bash
wrangler secret put JWT_SECRET          # paste a 32+ char random string
wrangler secret put ADMIN_JWT_SECRET    # paste a different 32+ char random string
wrangler secret put DEVICE_JWT_SECRET   # paste a third 32+ char random string
wrangler secret put DEFAULT_ADMIN_PASSWORD  # your desired admin password
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Step 4 — Seed the admin

```bash
# Generate and apply the admin seed SQL:
DEFAULT_ADMIN_EMAIL=admin@yourdomain.com \
DEFAULT_ADMIN_PASSWORD="YourStrongPassword123!" \
npm run seed:remote
```

For local dev:
```bash
DEFAULT_ADMIN_EMAIL=admin@eptoflow.local \
DEFAULT_ADMIN_PASSWORD="ChangeMe!123" \
npm run seed:local
```

---

### Step 5 — Deploy the Worker

```bash
npm run deploy
```

Note the Worker URL from the output:
```
https://eptoflow-api.YOUR-SUBDOMAIN.workers.dev
```

---

### Step 6 — Update CORS origins

Edit `wrangler.toml` → update `ALLOWED_ORIGINS` with your Pages URL
(you'll know this after Step 7 — come back and update):

```toml
[vars]
ALLOWED_ORIGINS = "https://eptoflow.pages.dev,https://YOUR-CUSTOM-DOMAIN.com"
```

Then redeploy:
```bash
npm run deploy
```

---

### Step 7 — Deploy the Frontend to Pages

```bash
cd ../../frontend

# Build for Cloudflare Pages:
npx @cloudflare/next-on-pages

# Deploy:
wrangler pages deploy .vercel/output/static --project-name=eptoflow
```

Or connect the GitHub repo in the Cloudflare dashboard:
1. Dashboard → Pages → **Create a project** → Connect to Git
2. Build settings:
   - **Framework preset**: Next.js
   - **Build command**: `npx @cloudflare/next-on-pages`
   - **Build output directory**: `.vercel/output/static`
   - **Compatibility flags**: `nodejs_compat`
3. Environment variable:
   ```
   NEXT_PUBLIC_API_BASE_URL = https://eptoflow-api.YOUR-SUBDOMAIN.workers.dev
   ```

---

### Stack B — Final checklist

- [ ] `GET https://eptoflow-api.YOUR-SUBDOMAIN.workers.dev/health` returns `{"ok":true}`
- [ ] D1 tables visible in Cloudflare dashboard → D1 → eptoflow
- [ ] Sign up at `https://eptoflow.pages.dev/signup`
- [ ] Admin login at `https://eptoflow.pages.dev/admin/login`
- [ ] Cron triggers show in Workers → your worker → Triggers tab
- [ ] PWA installs on mobile
- [ ] Firmware `config.h` updated with Worker URL

---

## Firmware Configuration

After deploying either stack, flash the ESP32 with the correct API URL.

Edit `firmware/eptoflow_esp32/config.h`:

```cpp
// Stack A (Render backend):
#define API_BASE_URL "https://YOUR-BACKEND.onrender.com"

// Stack B (Cloudflare Worker):
#define API_BASE_URL "https://eptoflow-api.YOUR-SUBDOMAIN.workers.dev"

// Your device credentials (from POST /api/devices response):
#define DEVICE_UID    "EPT-XXXXXX-XXXXXX"
#define DEVICE_SECRET "your_48_char_hex_secret"
```

Flash via Arduino IDE → select board **ESP32 Dev Module** → Upload.

---

## Post-deploy: First admin workflow

1. Open the PWA → **Sign Up** as a regular user
2. Log in to `/admin/login` with your admin credentials
3. Go to **Subscriptions** → **Renew** for the test user → select plan
4. Return to the PWA as that user — subscription should be active
5. Go to **Devices** → **Add Device** → note `device_uid` + `device_secret`
6. Flash the ESP32 with those credentials
7. Watch the device come online in the dashboard

---

## Common issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| CORS error in browser | `ALLOWED_ORIGINS` missing your frontend URL | Update env var + redeploy backend |
| `401 Invalid token` | JWT_SECRET mismatch between sign and verify | Ensure all three JWT secrets are set correctly |
| Device shows offline immediately | `HEARTBEAT_OFFLINE_SECONDS` too low or firmware not running | Check firmware serial output; set threshold ≥120 |
| Admin login fails | Admin not seeded | Run `npm run seed` (Stack A) or `npm run seed:remote` (Stack B) |
| PWA won't install | Icons missing or manifest not served as `application/manifest+json` | Check `vercel.json` headers; confirm icon-192.png exists |
| D1 write quota warning | Too many devices / heartbeat too frequent | Increase `HEARTBEAT_OFFLINE_SECONDS`, add log retention job |
| Render spins down (free tier) | Render free web services sleep after 15 min inactivity | Use a free uptime monitor (e.g. UptimeRobot) to ping `/health` every 5 min |
