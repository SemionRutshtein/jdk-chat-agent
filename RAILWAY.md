# Railway Deployment Guide

## Services to create

1. **Postgres** — Railway plugin
2. **Redis** — Railway plugin
3. **backend** — Docker service
4. **frontend** — Docker service

---

## Step 1 — Create Railway project

1. Go to [railway.app](https://railway.app) → New Project
2. Choose **Empty project**

---

## Step 2 — Add Postgres + Redis

- Click **+ New** → **Database** → **PostgreSQL**
- Click **+ New** → **Database** → **Redis**

---

## Step 3 — Deploy backend

1. Click **+ New** → **GitHub Repo** → select this repo
2. In service settings:
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `Dockerfile`
3. Set environment variables:

| Variable | Value |
|---|---|
| `CLAUDE_API_KEY` | Your Anthropic API key |
| `POSTGRES_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `JWT_SECRET` | Any long random string |
| `DEBUG` | `False` |

> **Note:** `PORT` is injected automatically — do not set it.

> **First boot** takes ~3–5 min: the startup script runs RAG initialization (embedding all 6 PDFs). Subsequent deploys skip this if ChromaDB volume persists.

### Persistent volume for ChromaDB (recommended)

In the backend service → **Volumes** → Mount `/app/chroma_data`. This avoids re-running RAG init on every deploy.

---

## Step 4 — Deploy frontend

1. Click **+ New** → **GitHub Repo** → same repo
2. In service settings:
   - **Root Directory**: `frontend`
   - **Dockerfile Path**: `Dockerfile`
3. Set environment variables:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<backend-service>.railway.app` |

> Copy the backend's public URL from Railway dashboard → Settings → Networking → Public URL.

---

## Step 5 — Verify

- Backend health: `https://<backend>.railway.app/api/health`
- Frontend: open `https://<frontend>.railway.app` → login page appears
