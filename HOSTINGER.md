# Deploying ArchPM to Hostinger

This guide covers deploying ArchPM to **Hostinger VPS** or any Hostinger plan that supports Node.js (e.g. via hPanel → Node.js / SSH access).

The Express API server serves both the REST API (`/api/*`) and the compiled React frontend from a single Node.js process — no separate web server config needed.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 20 | Check via `node -v`; install with `nvm install 20` if needed |
| pnpm | `npm install -g pnpm` |
| PM2 | `npm install -g pm2` |
| PostgreSQL database | Use an external service (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com)) or a local Postgres instance on the VPS |

---

## Step 1 — Upload the code

**Option A — Git (recommended)**
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git archpm
cd archpm
```

**Option B — File Manager / SFTP**
Upload the entire project folder (excluding `node_modules`) to your Hostinger home directory.

---

## Step 2 — Install dependencies

```bash
pnpm install --frozen-lockfile
```

---

## Step 3 — Set environment variables

Create a `.env` file in the project root (never commit this):

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
SESSION_SECRET=your-long-random-secret-here
```

> **Tip:** Generate a strong secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Alternatively, set these in **hPanel → Advanced → Environment Variables** if your plan supports it.

---

## Step 4 — Initialise the database

Run the schema push **once** to create all tables:

```bash
source .env  # or export the vars manually
pnpm --filter @workspace/db run push
```

---

## Step 5 — Build the app

```bash
pnpm run build:prod
```

This builds:
- `artifacts/api-server/dist/index.mjs` — the Express server
- `artifacts/arch-pm/dist/public/` — the compiled React SPA (served by the Express server)

---

## Step 6 — Start with PM2

```bash
# Load env vars, then start
export $(cat .env | xargs)
pm2 start ecosystem.config.cjs --env production

# Persist PM2 across server reboots
pm2 save
pm2 startup   # follow the printed instructions
```

The app will be running on **port 3000** (or whichever port you set).

---

## Step 7 — Configure a reverse proxy (Hostinger hPanel)

### If using Hostinger's built-in proxy (recommended)

Go to **hPanel → Websites → Manage → Advanced → Node.js** and:
- Set the **startup file** to `artifacts/api-server/dist/index.mjs`
- Set the **port** to `3000`

Hostinger will automatically proxy your domain to the Node.js process.

### If using a custom nginx config on VPS

Add a server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then enable HTTPS with Certbot:
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Default login

After the first startup the admin user is seeded automatically:

| Field | Value |
|---|---|
| Email | `admin@archfirm.com` |
| Password | `admin123` |

**Change the password immediately** after first login via Settings.

---

## Updating the app

```bash
git pull
pnpm install --frozen-lockfile
pnpm run build:prod
pm2 reload archpm
```

---

## Useful PM2 commands

```bash
pm2 list              # see running processes
pm2 logs archpm       # tail live logs
pm2 restart archpm    # restart
pm2 reload archpm     # zero-downtime reload
pm2 stop archpm       # stop
```
