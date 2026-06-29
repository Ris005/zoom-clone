# ZoomClone — Video Conferencing Platform

> **New here? Read [PROJECT_GUIDE.md](PROJECT_GUIDE.md)** — start-up, full code explanation, and Render deployment all in one file.

> **Docs:** [CODE_EXPLANATION.md](CODE_EXPLANATION.md) (full walkthrough) · [DEPLOYMENT.md](DEPLOYMENT.md) (Render guide) · [render.yaml](render.yaml) (blueprint)

A Zoom-style video conferencing web app: create instant meetings, schedule them,
join by ID or invite link, and talk over real peer-to-peer WebRTC video. Built
for the Scaler SDE Fullstack assignment.

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Backend:** Python + FastAPI (REST + WebSocket signaling)
- **Database:** SQLite via SQLAlchemy 2.0
- **Realtime media:** WebRTC mesh, signaled over a FastAPI WebSocket

---

## 1. Quick start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed          # creates zoomclone.db + sample data
uvicorn app.main:app --reload --port 8000
```
API docs (auto-generated) at http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```
App at http://localhost:3000

> WebRTC needs `https` or `localhost`. On localhost it works out of the box.
> To test multi-party video, open the meeting URL in two browser tabs/windows.

---

## 2. Tech stack & why

| Layer     | Choice                     | Reasoning |
|-----------|----------------------------|-----------|
| Frontend  | Next.js 14 App Router + TS | SPA routing, file-based routes, type-safe API contracts. |
| Styling   | Tailwind                   | Fast, consistent design tokens (Zoom blue `#2D8CFF`). |
| Backend   | FastAPI                    | Async-native, first-class WebSocket support (needed for WebRTC signaling), auto OpenAPI docs. |
| ORM       | SQLAlchemy 2.0             | Clean layering, swap SQLite→Postgres by changing one URL. |
| DB        | SQLite                     | Zero-config, file-based — per assignment. |
| Media     | WebRTC (mesh) + STUN       | True P2P audio/video; server only relays tiny signaling messages. |

---

## 3. Architecture

```
                    Browser (Next.js SPA)
   ┌───────────────────────────────────────────────┐
   │  Dashboard  │  Join/Schedule modals  │ Meeting │
   │      │                │                  │      │
   │   lib/api.ts (singleton REST client)            │
   │   lib/webrtc.ts (MeshClient: RTCPeerConnections)│
   └────────┬───────────────────────┬────────────────┘
            │ REST (JSON)            │ WebSocket (signaling)
            ▼                        ▼
   ┌─────────────────────────────────────────────────┐
   │                  FastAPI backend                 │
   │  routers/  →  services/  →  repositories/  → ORM │
   │  (thin)       (rules)       (queries)            │
   │                                                  │
   │  websocket/signaling.py  +  ConnectionManager*   │
   │  core/database.py (Database*)  *= Singleton      │
   └────────────────────────┬─────────────────────────┘
                            ▼
                      SQLite (SQLAlchemy)

   Media (audio/video) flows browser ↔ browser directly (P2P),
   NOT through the server. The server only carries signaling.
```

### Layered backend (request flows top → bottom)
- **routers/** — HTTP/WS entrypoints. Parse input, delegate, return. No logic.
- **services/** — business rules: ID generation, validation, lifecycle transitions, transaction boundaries.
- **repositories/** — the only layer that issues queries. One named method per intent.
- **models/** — SQLAlchemy ORM tables.
- **schemas/** — Pydantic request/response contracts (decoupled from the DB shape).
- **core/** — settings + the `Database` engine singleton.

This separation keeps every function small and independently testable: a router
never builds SQL; a repository never validates business rules.

### Design patterns
- **Singleton** — `Database` (one engine/connection pool per process), `ConnectionManager` (one process-wide room→sockets map), and the frontend `api` client + `Settings` (via `lru_cache`). See the docstrings in each file for the *why*.
- **Repository** — isolates persistence so SQLite→Postgres is a one-file change.
- **Application factory** — `create_app()` keeps construction testable.
- **Dependency injection** — FastAPI `Depends` wires a request-scoped session into each service.

---

## 4. Database schema

```
users                         meetings                         participants
─────────                     ─────────────────────            ─────────────────
id        PK                  id              PK               id           PK
name                          meeting_code    UNIQUE, IX       meeting_id   FK→meetings (CASCADE), IX
email     UNIQUE              title                            display_name
created_at                    description                      is_host
                              status          IX (enum)        is_muted
                              scheduled_for   IX (nullable)    joined_at
   1 ──< hosts                duration_min                     left_at
                              host_id         FK→users
                              created_at, ended_at
                                  1 ──< has
```

**Decisions**
- One `meetings` table backs *both* instant and scheduled meetings — they differ
  only by `status` and whether `scheduled_for` is set. Avoids two near-identical tables.
- `meeting_code` is a unique, indexed, Zoom-style 11-digit code (every join path
  looks up by it). Generated with `secrets` so codes aren't guessable/sequential.
- `status` is an enum (`scheduled`/`live`/`ended`) — documents allowed states and
  makes the dashboard's upcoming/recent split a cheap indexed filter.
- Participants are persisted (not just tracked as live sockets) so the roster and
  host controls have a stable target, and so history survives a server restart.

---

## 5. API reference

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/health` | Liveness probe. |
| GET    | `/api/meetings/dashboard` | Upcoming + recent meetings (one round-trip). |
| POST   | `/api/meetings` | Create instant meeting (→ `live`). |
| POST   | `/api/meetings/schedule` | Schedule a future meeting (validates future date). |
| GET    | `/api/meetings/{code}` | Fetch one meeting (validate before join). |
| POST   | `/api/meetings/{code}/join` | Register a participant. |
| GET    | `/api/meetings/{code}/participants` | Roster. |
| POST   | `/api/meetings/{code}/end` | End a meeting (host control). |
| WS     | `/ws/meetings/{code}/{peerId}` | WebRTC signaling channel. |

### How realtime video works
WebRTC connects browsers directly, but they first need to swap SDP offers/answers
and ICE candidates. The WebSocket is that **signaling channel** — it relays opaque
control blobs between peers and never sees the actual media, so the server stays
cheap. Topology is a **full mesh** (each peer connects to every other), which is
the simplest correct design for the small rooms in scope.

---

## 6. Features

**Core (all implemented)**
- Landing dashboard: Zoom-style navbar, New/Join/Schedule actions, Upcoming + Recent sections.
- Instant meeting: unique ID + shareable link, redirect into the room.
- Join: by meeting ID *or* pasted invite link, with a pre-join name screen and existence validation (404 on bad code).
- Schedule: title/description/date-time/duration, future-date validation, persisted, surfaces under Upcoming.
- Seeded sample data.

**Bonus**
- Responsive grid (mobile/tablet/desktop).
- Host controls scaffolding: first joiner is host; mute/video toggles; `end` endpoint; per-participant `is_muted` field + control message relay over the socket.

---

## 7. Assumptions
- **No auth** (per the brief). A seeded "Demo User" (id=1) is the implicit host.
- First person to join a meeting becomes its host (demo rule).
- STUN-only ICE (Google public server). Production would add TURN for symmetric NATs.
- Mesh topology suits demo-sized rooms; an SFU would be introduced at scale.

## 8. Future work
- Swap mesh → SFU (e.g. mediasoup/LiveKit) for large meetings.
- Real auth (the bonus item) — the `users` table already anticipates it.
- Recording, screen share, in-call chat persistence.
- Postgres in prod (one-line `DATABASE_URL` swap thanks to the repository layer).

## 9. Project layout
```
backend/app/
  core/        config.py, database.py        (Singletons)
  models/      user.py, meeting.py, participant.py
  schemas/     meeting.py                     (Pydantic contracts)
  repositories/meeting_repository.py          (data access)
  services/    meeting_service.py, id_generator.py  (business logic)
  routers/     meetings.py, health.py         (HTTP)
  websocket/   signaling.py, connection_manager.py  (WebRTC signaling)
  main.py      create_app() factory
  seed.py
frontend/
  app/         page.tsx (dashboard), meeting/[code]/page.tsx (room)
  components/  Navbar, ActionButtons, MeetingCard, meeting/*, modals/*
  lib/         api.ts (singleton), webrtc.ts (MeshClient), types.ts, format.ts
```
