# Eptoflow — Complete From-Scratch Deployment Guide
### Stack A: Render (backend) + Neon (database) + Vercel (frontend)

Everything is free. No credit card needed for any of these services.  
Estimated total time: **45–60 minutes** on first setup.

---

## Overview — what you'll do

```
Your Computer  →  GitHub  →  Render (backend API)
                          →  Neon   (Postgres database)
                          →  Vercel (frontend PWA)
```

---

## PHASE 1 — Install tools on your computer

### Step 1 — Install Git

**Windows:**
1. Go to https://git-scm.com/download/win
2. Download and run the installer (keep all defaults)
3. Open **Command Prompt** or **PowerShell** and verify:
   ```
   git --version
   ```
   You should see something like `git version 2.45.0`

**Mac:**
1. Open **Terminal** (Spotlight → type "Terminal")
2. Run: `git --version`
3. If Git is not installed, macOS will prompt you to install Xcode Command Line Tools — click Install
4. After it finishes, run `git --version` again to confirm

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update && sudo apt-get install git -y
git --version
```

---

### Step 2 — Install Node.js

1. Go to https://nodejs.org
2. Download the **LTS** version (the left button — currently 20.x)
3. Run the installer (keep all defaults)
4. Open a **new** terminal/command prompt and verify:
   ```
   node --version
   npm --version
   ```
   You should see `v20.x.x` and `10.x.x` (or similar)

---

### Step 3 — Configure Git with your name

In your terminal, run these two commands (replace with your real name and email):

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

Use the same email as your GitHub account.

---

## PHASE 2 — Push the code to GitHub

### Step 4 — Find the project folder

The project files are in:
```
Epto flow/eptoflow/
```
in the folder you connected to this app.

Open your terminal and navigate to that folder:

**Windows (Command Prompt):**
```cmd
cd "C:\Users\YourName\Epto flow\eptoflow"
```

**Mac/Linux:**
```bash
cd ~/Desktop/"Epto flow"/eptoflow
# or wherever your folder is — drag the folder into terminal to auto-fill the path
```

Confirm you're in the right place:
```bash
ls
```
You should see: `backend/  frontend/  firmware/  cloudflare/  docs/`

---

### Step 5 — Create a GitHub repository

1. Go to https://github.com → click the **+** icon → **New repository**
2. Repository name: `eptoflow`
3. Set to **Private** (recommended — your API secrets will be in here)
4. **Do NOT** check "Add README" or any other option
5. Click **Create repository**
6. GitHub shows a page with setup commands — copy the repo URL, it looks like:
   ```
   https://github.com/YOUR-USERNAME/eptoflow.git
   ```

---

### Step 6 — Push the code to GitHub

In your terminal (inside the `eptoflow` folder):

```bash
git init
git add .
git commit -m "Initial commit — Eptoflow platform"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/eptoflow.git
git push -u origin main
```

When prompted, enter your GitHub username and password.  
> **Note:** GitHub may ask for a **Personal Access Token** instead of a password.  
> If so: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → check **repo** scope → copy the token → paste it as your password.

After the push, refresh your GitHub repo page — you should see all the files.

---

## PHASE 3 — Set up the database (Neon)

### Step 7 — Create a free Neon Postgres database

1. Go to https://neon.tech → click **Sign Up** → sign up with GitHub (easiest)
2. Click **New Project**
3. Project name: `eptoflow`
4. Region: choose the one closest to you (e.g. US East, EU West)
5. Click **Create Project**
6. On the next screen, find the **Connection string** — it looks like:
   ```
   postgresql://eptoflow_owner:SOMEPASSWORD@ep-abc-123.us-east-2.aws.neon.tech/eptoflow?sslmode=require
   ```
7. Click **Copy** — **save this somewhere safe**, you'll need it in the next step

---

## PHASE 4 — Deploy the backend (Render)

### Step 8 — Create a Render account

1. Go to https://render.com → **Get Started for Free**
2. Sign up with your GitHub account

---

### Step 9 — Create the backend web service on Render

1. In Render dashboard → click **New +** → **Web Service**
2. Connect GitHub → select your `eptoflow` repository → click **Connect**
3. Fill in the settings:
   - **Name**: `eptoflow-api`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run migrate`
   - **Start Command**: `node src/server.js`
   - **Plan**: **Free**

4. Scroll down to **Environment Variables** — click **Add Environment Variable** for each:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `DATABASE_URL` | *(paste your Neon connection string from Step 7)* |
   | `JWT_SECRET` | *(generate — see below)* |
   | `ADMIN_JWT_SECRET` | *(generate — see below)* |
   | `DEVICE_JWT_SECRET` | *(generate — see below)* |
   | `JWT_EXPIRES_IN` | `7d` |
   | `DEVICE_JWT_EXPIRES_IN` | `30d` |
   | `ALLOWED_ORIGINS` | `http://localhost:3000` *(update after Step 13)* |
   | `DEFAULT_ADMIN_EMAIL` | `admin@eptoflow.local` *(or your email)* |
   | `DEFAULT_ADMIN_PASSWORD` | *(choose a strong password — write it down)* |
   | `HEARTBEAT_OFFLINE_SECONDS` | `120` |
   | `SUBSCRIPTION_DAYS` | `30` |

   **How to generate secrets** — run this in your terminal 3 times, use each output for one secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Each call gives you a different 64-char string like:
   `a3f8bc12...` — use that as your JWT_SECRET, then run again for ADMIN_JWT_SECRET, etc.

5. Click **Create Web Service**

Render starts building — this takes 3–5 minutes. Watch the logs.  
You'll see `[migrate] applying schema.sql ... [migrate] done` in the build output.  
Then you'll see something like `Server listening on port 4000`.

---

### Step 10 — Verify the backend is live

Copy your Render URL from the top of the page — it looks like:
```
https://eptoflow-api.onrender.com
```

Open a browser and go to:
```
https://eptoflow-api.onrender.com/health
```

You should see:
```json
{"ok":true,"service":"eptoflow-api","time":"2026-..."}
```

If you see this — **the backend is live!** 🎉

---

### Step 11 — Seed the admin user

You need to create the default admin account once.

1. In Render dashboard → click on your `eptoflow-api` service
2. Click the **Shell** tab (top right)
3. In the shell, run:
   ```bash
   npm run seed
   ```
4. You should see:
   ```
   [seed] created admin admin@eptoflow.local / YourPassword
   ```

Your admin account is now created.

---

## PHASE 5 — Deploy the frontend (Vercel)

### Step 12 — Create a Vercel account

1. Go to https://vercel.com → **Sign Up**
2. Sign up with GitHub

---

### Step 13 — Deploy the frontend

1. Vercel dashboard → **Add New...** → **Project**
2. Import your `eptoflow` GitHub repository
3. On the configure screen:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: click **Edit** → type `frontend` → Save
4. Expand **Environment Variables** → add:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://eptoflow-api.onrender.com` *(your Render URL)* |

5. Click **Deploy**

Vercel builds and deploys — takes 2–4 minutes.  
When done, you'll get a URL like:
```
https://eptoflow-xyz.vercel.app
```

---

### Step 14 — Update CORS on the backend

Now that you have your Vercel URL, you need to tell the backend to accept requests from it.

1. Go to Render dashboard → `eptoflow-api` → **Environment**
2. Find `ALLOWED_ORIGINS` → click **Edit**
3. Change the value to your Vercel URL:
   ```
   https://eptoflow-xyz.vercel.app
   ```
4. Click **Save Changes**
5. Render automatically restarts the service with the new value — wait ~30 seconds

---

## PHASE 6 — Test everything end-to-end

### Step 15 — Open the app and create a user

1. Open `https://eptoflow-xyz.vercel.app` in your browser
2. Click **Get Started** or **Sign Up**
3. Fill in your name, email, and password → **Sign Up**
4. You should land on the dashboard — it will show no devices or subscription yet

---

### Step 16 — Log in as admin

1. Go to `https://eptoflow-xyz.vercel.app/admin/login`
2. Email: whatever you set as `DEFAULT_ADMIN_EMAIL` (e.g. `admin@eptoflow.local`)
3. Password: the `DEFAULT_ADMIN_PASSWORD` you set in Step 9
4. You should see the admin dashboard with 1 user listed

---

### Step 17 — Activate a subscription for your user

1. In the admin panel → **Subscriptions** → **Renew**
2. Enter the user's ID (copy from the Users list) or their email
3. Select plan: **Basic** or **Premium**
4. Click **Activate**
5. Go back to the main app (as the regular user) → refresh
6. You should now have an active subscription

---

### Step 18 — Add a device

1. In the main app → **Devices** → **Add Device**
2. Give it a name (e.g. "Garden Controller")
3. Click **Provision**
4. A popup shows:
   ```
   Device UID:    EPT-XXXXXX-XXXXXX
   Device Secret: (long hex string)
   ```
   **Copy both values immediately** — the secret is shown only once.

---

### Step 19 — Install the PWA (optional but recommended)

**Android Chrome:**
1. Open `https://eptoflow-xyz.vercel.app`
2. Tap the three-dot menu → **Add to Home Screen** → **Install**

**iOS Safari:**
1. Open `https://eptoflow-xyz.vercel.app`
2. Tap the Share icon → **Add to Home Screen** → **Add**

---

### Step 20 — Configure and flash the ESP32

Edit the file `firmware/eptoflow_esp32/config.h` on your computer:

```cpp
// WiFi credentials
#define WIFI_SSID     "YourWiFiName"
#define WIFI_PASSWORD "YourWiFiPassword"

// API — use your Render backend URL
#define API_BASE_URL  "https://eptoflow-api.onrender.com"

// Device credentials from Step 18
#define DEVICE_UID    "EPT-XXXXXX-XXXXXX"
#define DEVICE_SECRET "your_hex_secret_here"
```

Then in Arduino IDE:
1. Install the ESP32 board package (if not already): Tools → Board Manager → search "esp32" → install
2. Open `firmware/eptoflow_esp32/eptoflow_esp32.ino`
3. Install required libraries via Library Manager:
   - `ArduinoJson` by Benoit Blanchon
4. Select board: **ESP32 Dev Module**
5. Select the correct COM/USB port
6. Click **Upload**

Open the Serial Monitor (115200 baud) — you should see:
```
[WiFi] Connected. IP: 192.168.x.x
[Auth] Device authenticated. Token received.
[HB]   Heartbeat OK. sub_active=true
```

---

## Final verification checklist

Open each URL and confirm it works:

- [ ] `https://eptoflow-api.onrender.com/health` → `{"ok":true}`
- [ ] `https://eptoflow-xyz.vercel.app` → landing page loads
- [ ] `https://eptoflow-xyz.vercel.app/signup` → can create account
- [ ] `https://eptoflow-xyz.vercel.app/admin/login` → admin dashboard loads
- [ ] After activating subscription → `/dashboard` shows plan badge
- [ ] After provisioning device → device appears in `/devices`
- [ ] ESP32 serial shows `Heartbeat OK`
- [ ] In admin dashboard → Devices shows device status = Online

---

## Troubleshooting

**Build fails on Render with `Missing required env variable: DATABASE_URL`**
→ You didn't add the environment variables in Step 9. Go to Render → Environment → add `DATABASE_URL`.

**Build fails with `npm error 403 Forbidden`**
→ This sandbox can't reach npm, but Render can. The deploy will work on Render's servers.

**Frontend shows "Network Error" or blank screen**
→ Check `NEXT_PUBLIC_API_BASE_URL` in Vercel matches exactly your Render URL (no trailing slash).

**Admin login fails with "Invalid credentials"**
→ The seed didn't run. Go to Render → Shell → run `npm run seed`.

**CORS error in browser console**
→ `ALLOWED_ORIGINS` on Render doesn't include your Vercel URL. Update it (Step 14).

**Render service sleeps after 15 minutes (free tier)**
→ The free tier spins down after inactivity. Fix: sign up for https://uptimerobot.com (free) → add a monitor for `https://eptoflow-api.onrender.com/health` with 5-minute interval. This keeps it alive.

**Device shows "offline" immediately after connecting**
→ The firmware `API_BASE_URL` has a typo, or WiFi isn't connecting. Check serial output.

---

## What to do after everything works

1. **Change the admin password** — log in to admin, go to profile, change from the default
2. **Set up UptimeRobot** — keeps Render's free tier from sleeping (5-min ping to `/health`)
3. **Add real users** — share your Vercel URL with users; they sign up themselves
4. **Verify payments manually** — when a user submits a payment intent, go to Admin → Payments → verify
5. **Flash more ESP32s** — provision a new device in the app, flash with those credentials
