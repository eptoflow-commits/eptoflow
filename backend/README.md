# Eptoflow backend

Node 20 + Express + PostgreSQL.

```bash
cp .env.example .env
npm install
npm run migrate   # creates all tables
npm run seed      # creates default admin
npm run dev       # starts :4000 with node --watch
```

Endpoints are documented in `../docs/API.md`.

## Folder layout

```
src/
├── config/         # env parsing
├── db/             # pool.js, schema.sql, migrate.js, seed.js
├── middleware/     # auth, validate, error
├── routes/         # auth, devices, deviceApi, schedules, subscriptions,
│                   # voice, notifications, admin
├── services/       # plan, subscription, command, voice
├── jobs/           # node-cron jobs (offline detection, schedule runner,
│                   # subscription expiry, expiring reminders)
├── utils/          # audit, crypto, http errors
└── server.js
```
