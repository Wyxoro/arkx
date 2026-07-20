# ArkStream — Production Deployment Guide
## Railway + Cloudflare (`arkstream.org`)

---

## Architecture

```
Users → Cloudflare (orange cloud, arkstream.org)
            ↓
      Railway service (single)
      Express server on $PORT
      ├── /api/*   — AniList, Jikan, HLS proxy routes
      └── /*       — Vite-built React SPA (static files)
```

One Railway service, one domain. No CORS headaches.

---

## 1 · Push the repo to GitHub

Railway deploys from GitHub. Push this repository to a private GitHub repo.

```bash
git remote add origin https://github.com/YOUR_ORG/arkstream.git
git push -u origin main
```

---

## 2 · Create the Railway project

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Select your repository
3. Railway will auto-detect `nixpacks.toml` and run the build

---

## 3 · Set environment variables in Railway

In the Railway service dashboard → **Variables**, add:

| Variable       | Value                        | Notes                                              |
|----------------|------------------------------|----------------------------------------------------|
| `NODE_ENV`     | `production`                 | Required — enables static serving + correct CSP   |
| `BASE_PATH`    | `/`                          | Required at build time for Vite                    |
| `SESSION_SECRET` | (strong random string)     | Used for session signing                           |

Railway automatically provides `PORT`.

---

## 4 · Custom domain in Railway

1. Railway service → **Settings → Networking → Custom Domain**
2. Add `arkstream.org` and `www.arkstream.org`
3. Railway will show you **CNAME target** values (e.g. `xyz.up.railway.app`)

---

## 5 · Cloudflare DNS

In Cloudflare dashboard for `arkstream.org`:

| Type  | Name  | Target                        | Proxy  |
|-------|-------|-------------------------------|--------|
| CNAME | `@`   | `xyz.up.railway.app`          | ✅ ON  |
| CNAME | `www` | `xyz.up.railway.app`          | ✅ ON  |

> **Orange cloud (proxied) ON** — Cloudflare handles TLS, DDoS, caching.

---

## 6 · Cloudflare SSL/TLS settings

- **SSL/TLS mode → Full (strict)** — Cloudflare ↔ Railway is encrypted end-to-end
- **Always Use HTTPS → ON**
- **HSTS** — already set by the API server (`max-age=63072000; includeSubDomains; preload`)

---

## 7 · Cloudflare Cache Rules (optional but recommended)

Create a Cache Rule for `/api/*`:
- **Cache eligibility → Bypass cache** — API responses must never be served stale from Cloudflare

Static assets (`/assets/*`, `*.js`, `*.css`) are safe to cache — Vite adds content hashes.

---

## 8 · Verify deployment

```bash
# Health check
curl https://arkstream.org/api/healthz

# Should return: {"status":"ok"}
```

---

## Environment variable reference

| Variable       | Required | Default | Description                              |
|----------------|----------|---------|------------------------------------------|
| `PORT`         | Auto     | —       | Provided by Railway automatically        |
| `NODE_ENV`     | Yes      | —       | Set to `production` in Railway           |
| `BASE_PATH`    | Yes      | `/`     | Vite base path (set at build time)       |
| `SESSION_SECRET` | Yes   | —       | Secret for session signing               |
| `PROXY_URL`    | No       | —       | Residential proxy for streaming (optional) |

---

## Re-deploying

Railway auto-deploys on every push to `main`. To trigger manually:
- Railway dashboard → **Deployments → Deploy now**

---

## Rollback

Railway keeps the last N deployments. To roll back:
- Railway dashboard → **Deployments → (previous deploy) → Rollback**
