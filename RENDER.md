# Deploying ArchPM to Render

Render is the easiest zero-ops option. The Express server serves both the
React SPA and the `/api` routes from a single process.

**Estimated cost: $0/month** (free tier, with ~30 s cold-start after 15 min idle)  
**Always-on: ~$7/month** (Render Starter plan — no sleep)

---

## Step 1 — Database (Neon, free)

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Copy the **Connection string** (looks like
   `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).
3. From your local machine, push the schema once:

```bash
DATABASE_URL="<your-neon-url>" pnpm --filter @workspace/db run push
```

---

## Step 2 — File storage (Cloudflare R2, free up to 10 GB then $0.015/GB)

> Skip this section if you don't need file uploads, or want to test without
> storage first (files will fall back to local disk and be lost on redeploy).

1. Sign in to [Cloudflare](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**.
2. Name the bucket (e.g. `archpm-files`).
3. In **Settings → R2.dev subdomain**, enable the public URL — copy it
   (e.g. `https://pub-xxxx.r2.dev`).
4. Go to **Manage R2 API Tokens** → create a token with **Object Read & Write**
   on your bucket. Copy the **Account ID**, **Access Key ID**, and
   **Secret Access Key**.

---

## Step 3 — Create the Render Web Service

1. Go to [render.com](https://render.com) → **New → Web Service**.
2. Connect your GitHub repo.
3. Set:

| Field | Value |
|---|---|
| **Runtime** | Node |
| **Build Command** | `pnpm install --frozen-lockfile && pnpm run build:prod` |
| **Start Command** | `pnpm start` |
| **Instance Type** | Free (or Starter for always-on) |

---

## Step 4 — Environment variables

Add these in **Render → Your Service → Environment**:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your Neon connection string |
| `SESSION_SECRET` | Any random 32-char string* |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 token access key |
| `R2_SECRET_ACCESS_KEY` | R2 token secret key |
| `R2_BUCKET_NAME` | `archpm-files` (your bucket name) |
| `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` |

> *Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
>
> The `R2_*` variables are optional — omit them to skip cloud file storage
> (not recommended for 20 GB of files).

---

## Step 5 — Deploy

Click **Create Web Service**. Render will:
1. Run `pnpm install`
2. Build the API server and the React SPA
3. Start the Express process (which serves both)

Your app will be live at `https://your-service.onrender.com`.

---

## Default login

On first boot the admin user is seeded automatically:

| | |
|---|---|
| Email | `admin@archfirm.com` |
| Password | `admin123` |

**Change the password immediately** after first login.

---

## Updating

Push to your connected GitHub branch — Render auto-deploys on every push.

---

## Upgrading from free to always-on

In Render → **Your Service → Settings → Instance Type**, change from
**Free** to **Starter** ($7/month). No other changes needed.
