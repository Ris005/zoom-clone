# Deployment Guide — Render

This deploys two services from the one repo:

| Service           | What it is        | Render type          | Root dir   |
|-------------------|-------------------|----------------------|------------|
| `zoomclone-api`   | FastAPI backend   | Web Service (Python) | `backend`  |
| `zoomclone-web`   | Next.js frontend  | Web Service (Node)   | `frontend` |

You can do it **manually in the dashboard** (Section 2) or with the
**`render.yaml` blueprint** (Section 3). The blueprint is faster and reviewers
like seeing infra-as-code.

> There is a chicken-and-egg: the frontend needs the backend URL, and the backend
> needs the frontend URL (for CORS). Deploy the **backend first**, copy its URL,
> then deploy the frontend, then come back and set the backend's `CORS_ORIGINS`.
> Order is spelled out below.

---

## 0. Prerequisites
1. Push this repo to GitHub (public, per the assignment).
2. Sign in at https://dashboard.render.com and connect your GitHub.

---

## 1. The exact commands (copy/paste)

### Backend — `zoomclone-api` (Python Web Service)
| Field            | Value                                                        |
|------------------|--------------------------------------------------------------|
| Root Directory   | `backend`                                                    |
| Runtime          | Python (auto-detected)                                        |
| Build Command    | `pip install -r requirements.txt && python -m app.seed`      |
| Start Command    | `uvicorn app.main:app --host 0.0.0.0 --port $PORT`           |

- `--host 0.0.0.0` is **required** — without it Render can't reach the container.
- `$PORT` is injected by Render; never hard-code a port.
- The `python -m app.seed` in the build step pre-loads the sample meetings so the
  dashboard isn't empty on first load.

### Frontend — `zoomclone-web` (Node Web Service)
| Field            | Value                          |
|------------------|--------------------------------|
| Root Directory   | `frontend`                     |
| Runtime          | Node (auto-detected)           |
| Build Command    | `npm install && npm run build` |
| Start Command    | `npm start`                    |

- `npm start` runs `next start`, which reads `$PORT` and binds `0.0.0.0`
  automatically — no flags needed.

---

## 2. Manual dashboard steps

### Step A — deploy the backend
1. Dashboard → **New → Web Service** → pick your repo.
2. **Root Directory:** `backend`.
3. **Build Command** and **Start Command:** as in the table above.
4. **Instance Type:** Free.
5. **Environment variables** (Advanced → Add Environment Variable):
   | Key            | Value                                   |
   |----------------|-----------------------------------------|
   | `DEBUG`        | `false`                                 |
   | `CORS_ORIGINS` | *(set after Step B — leave blank now)*  |
6. **Create Web Service.** When it's live, copy its URL, e.g.
   `https://zoomclone-api.onrender.com`.

### Step B — deploy the frontend
1. Dashboard → **New → Web Service** → same repo.
2. **Root Directory:** `frontend`.
3. **Build / Start Commands:** as in the table above.
4. **Instance Type:** Free.
5. **Environment variable** (must be set **before** the build — Next bakes
   `NEXT_PUBLIC_*` into the bundle at build time):
   | Key                   | Value                                |
   |-----------------------|--------------------------------------|
   | `NEXT_PUBLIC_API_URL` | `https://zoomclone-api.onrender.com` |
6. **Create Web Service.** When live, copy its URL, e.g.
   `https://zoomclone-web.onrender.com`.

### Step C — open CORS on the backend
1. Go back to `zoomclone-api` → **Environment**.
2. Set:
   | Key            | Value                                       |
   |----------------|---------------------------------------------|
   | `CORS_ORIGINS` | `["https://zoomclone-web.onrender.com"]`    |
   > It's a JSON array (the backend setting is a `list[str]`). Include the quotes
   > and brackets exactly. Add more origins comma-separated inside the brackets.
3. Save → the service redeploys. Done.

Visit the frontend URL. Backend API docs are at `<api-url>/docs`.

---

## 3. One-click blueprint (`render.yaml`)

A `render.yaml` is included at the repo root. To use it:
1. Dashboard → **New → Blueprint** → select your repo.
2. Render reads `render.yaml` and proposes both services. Click **Apply**.
3. Set the two `sync: false` secrets when prompted (or right after, in each
   service's Environment tab):
   - `zoomclone-web` → `NEXT_PUBLIC_API_URL` = the API service's URL.
   - `zoomclone-api` → `CORS_ORIGINS` = `["<frontend-url>"]`.
4. Trigger a redeploy of each after setting them (frontend must rebuild so the
   API URL is baked in).

---

## 4. Environment variables — full reference

### Backend (`zoomclone-api`)
| Key            | Required | Example                                  | Notes |
|----------------|----------|------------------------------------------|-------|
| `DEBUG`        | no       | `false`                                  | Turns off SQL echo in logs. |
| `CORS_ORIGINS` | yes      | `["https://zoomclone-web.onrender.com"]` | JSON array of allowed SPA origins. |
| `DATABASE_URL` | no       | `sqlite:///./zoomclone.db`               | Default is fine; point at Postgres in prod. |

### Frontend (`zoomclone-web`)
| Key                   | Required | Example                              | Notes |
|-----------------------|----------|--------------------------------------|-------|
| `NEXT_PUBLIC_API_URL` | yes      | `https://zoomclone-api.onrender.com` | **Build-time** — set before first build. The WebSocket URL is derived from this (`https`→`wss`) automatically. |

---

## 5. Render free-tier gotchas (know these for the interview)

- **Cold starts:** free services sleep after ~15 min idle; the next request takes
  ~30–60s to wake. Fine for a demo — just hit the URL a minute before showing it.
- **WebSockets on free tier are flaky** *because* of that sleep (an idle room can
  drop). For a reliable live demo, keep the tab active, or use a paid instance.
- **Ephemeral disk:** the SQLite file is wiped on every redeploy/restart, so
  seeded data resets to the sample set (which is acceptable here since seeding
  runs in the build). For real persistence, attach a paid persistent disk or use
  a managed Postgres and set `DATABASE_URL`.
- **WebRTC needs HTTPS:** Render gives every service HTTPS by default, so
  `getUserMedia` works in the browser. Locally it works on `localhost`.
- **TURN for real networks:** the app uses a public STUN server, which is enough
  for many networks but not symmetric NATs. For a bulletproof demo across
  different networks, add a TURN server (e.g. a free metered TURN credential) to
  the `iceServers` list in `frontend/lib/webrtc.ts`.

---

## 6. Alternative: Vercel for the frontend (often smoother for Next.js)

Vercel is purpose-built for Next.js and has no cold-start on the frontend:
1. Import the repo at https://vercel.com/new.
2. Set **Root Directory** to `frontend` (Vercel auto-detects Next.js — no build/
   start commands needed).
3. Add env var `NEXT_PUBLIC_API_URL = https://zoomclone-api.onrender.com`.
4. Deploy, then add the Vercel URL to the backend's `CORS_ORIGINS`.

Keep the **backend on Render** either way (Vercel's serverless functions don't
hold long-lived WebSocket connections well, which the signaling needs).
