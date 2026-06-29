# ZoomClone — Complete Project Guide (All-in-One)

Everything in one document: what it is, **how to start it locally**, a full code
explanation, and **how to deploy on Render**. The individual docs
(`README.md`, `CODE_EXPLANATION.md`, `DEPLOYMENT.md`) are also in this folder if
you prefer them split.

## Contents
1. [What it is + tech stack](#1-what-it-is)
2. [Folder structure](#2-folder-structure)
3. [Start the project locally](#3-start-the-project-locally)
4. [Full code explanation](#4-full-code-explanation)
5. [Deploy on Render (commands + env)](#5-deploy-on-render)

---

## 1. What it is

A Zoom-style video conferencing app: create instant meetings, schedule them, join
by ID or invite link, and talk over real peer-to-peer **WebRTC** video.

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind
- **Backend:** Python + FastAPI (REST + WebSocket signaling)
- **Database:** SQLite via SQLAlchemy 2.0
- **Realtime media:** WebRTC mesh, signaled over a FastAPI WebSocket

---

## 2. Folder structure

```
zoom-clone/
├── README.md                 # short overview
├── PROJECT_GUIDE.md          # << this file: everything in one place
├── CODE_EXPLANATION.md       # full code walkthrough (also embedded below)
├── DEPLOYMENT.md             # Render guide (also embedded below)
├── render.yaml               # Render blueprint (New → Blueprint → Apply)
├── .gitignore
│
├── backend/                  # FastAPI + SQLite
│   ├── app/
│   │   ├── core/             # config.py, database.py  (Singletons)
│   │   ├── models/           # user.py, meeting.py, participant.py  (ORM)
│   │   ├── schemas/          # meeting.py  (Pydantic contracts)
│   │   ├── repositories/     # meeting_repository.py  (data access)
│   │   ├── services/         # meeting_service.py, id_generator.py  (logic)
│   │   ├── routers/          # meetings.py, health.py  (HTTP)
│   │   ├── websocket/        # signaling.py, connection_manager.py  (WebRTC)
│   │   ├── main.py           # create_app() factory + uvicorn entrypoint
│   │   └── seed.py           # sample data
│   ├── requirements.txt
│   ├── run.sh                # convenience: seed (first run) then serve
│   └── .env.example
│
└── frontend/                 # Next.js 14
    ├── app/
    │   ├── page.tsx          # dashboard
    │   └── meeting/[code]/page.tsx   # meeting room
    ├── components/           # Navbar, ActionButtons, MeetingCard, meeting/*, modals/*
    ├── lib/                  # api.ts (singleton), webrtc.ts (MeshClient), types.ts, format.ts
    ├── package.json
    ├── tailwind.config.ts
    └── .env.local.example
```

---

## 3. Start the project locally

You need **Python 3.11+** and **Node 18+**. Open two terminals.

### Terminal 1 — backend (port 8000)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed                   # creates zoomclone.db + sample meetings
uvicorn app.main:app --reload --port 8000
```
- API base: `http://localhost:8000`
- Interactive API docs: `http://localhost:8000/docs`
- (Shortcut: `./run.sh` does the seed-then-serve steps for you.)

### Terminal 2 — frontend (port 3000)
```bash
cd frontend
npm install
cp .env.local.example .env.local     # contains NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```
- App: `http://localhost:3000`

### Try it
1. Open `http://localhost:3000` → you'll see the dashboard with seeded meetings.
2. Click **New Meeting** → you're taken into a room with your camera.
3. To see multi-party video, copy the meeting URL and open it in a **second
   browser tab/window** → both tiles appear and connect over WebRTC.

> WebRTC's `getUserMedia` only works on `https` or `localhost`. Locally you're on
> `localhost`, so it works with no extra setup. Allow camera/mic when prompted.

### Common hiccups
- **CORS error in the browser console:** the backend must allow the frontend
  origin. The default config already allows `http://localhost:3000`. If you run
  the frontend on a different port, set `CORS_ORIGINS` (see the env reference in §5).
- **"Meeting not found" right after creating:** make sure the backend is running
  and `NEXT_PUBLIC_API_URL` points at it.
- **No video tile:** you likely denied camera permission — reload and allow it.

---

## 4. Full code explanation


A file-by-file, layer-by-layer walkthrough of how the app works, why it's
structured this way, and how a single request flows end to end. Written so you
can defend every decision in the evaluation interview.

---

### 0. The 30-second mental model

```
Browser (Next.js)  ──REST──►  FastAPI  ──►  SQLite        (create/join/schedule meetings)
Browser (Next.js)  ──WS────►  FastAPI signaling           (exchange WebRTC offers/answers)
Browser  ◄──────── media (audio/video) P2P ──────────►  Browser   (NOT through the server)
```

Two channels do two different jobs:
- **REST** persists meetings/participants in SQLite.
- **WebSocket** is only a *signaling* relay so two browsers can set up a direct
  WebRTC link. Once that link exists, audio/video flows browser-to-browser; the
  server never touches the media. That's why the backend stays cheap.

---

### 1. Backend layering (the most important idea)

The backend is split into layers, each with one job. A request flows **top to
bottom**, and each layer only knows about the layer directly below it:

```
routers/        HTTP & WebSocket entrypoints      "what URL maps to what"
   │            (parse input, call a service, return) — NO logic
   ▼
services/       business rules                    "what it means to do X"
   │            (validation, ID gen, transactions)
   ▼
repositories/   data access                       "how to read/write rows"
   │            (the ONLY layer that issues queries)
   ▼
models/         SQLAlchemy ORM tables             "what the data looks like in the DB"

schemas/        Pydantic contracts                "what the JSON looks like on the wire"
core/           settings + DB engine (Singletons) "cross-cutting infra"
```

**Why bother?** Each function stays small and testable in isolation. A router
never builds SQL; a repository never validates business rules; a service never
serialises JSON. If you want to swap SQLite for Postgres, you touch *one* line in
`core/config.py`. If the API JSON shape changes, you touch `schemas/` and nothing
in the database layer moves.

#### Request trace: "Create an instant meeting"
1. `POST /api/meetings` hits **`routers/meetings.py → create_instant_meeting`**.
   FastAPI has already validated the body against `MeetingCreate` (a schema).
2. The router calls **`MeetingService.create_instant(payload)`**. Nothing else.
3. The service asks **`id_generator.generate_unique_code`** for a fresh code,
   builds a `Meeting` ORM object with `status=LIVE`, and hands it to the
   repository.
4. **`MeetingRepository.add`** stages the row and flushes to get its `id`.
5. The service calls `session.commit()` (it owns the transaction boundary) and
   maps the ORM row to a **`MeetingOut`** schema (adding the invite link).
6. The router returns that schema; FastAPI serialises it to JSON.

That's the whole pattern. Every endpoint follows the same shape.

---

### 2. `core/` — configuration and the database (Singletons)

#### `core/config.py`
Defines `Settings` (a Pydantic `BaseSettings`). Every field can be overridden by
an environment variable of the same name, which is how deployment works — no code
change to point at a different database or allow a different CORS origin.

`get_settings()` is wrapped in `@lru_cache`, which makes it a **singleton**: the
`Settings` object is built once on first call and reused forever after. We read
the environment exactly once and share one immutable config everywhere.

#### `core/database.py` — the `Database` singleton
A SQLAlchemy `Engine` owns a connection pool. We want **exactly one** per process
— two engines would mean two pools fighting over the same SQLite file. `Database`
guarantees that.

**How the singleton is implemented (interview gold):** we override `__new__`,
which is Python's *allocation* hook. It runs before `__init__` and decides which
object to return:

```python
def __new__(cls):
    if cls._instance is None:
        cls._instance = super().__new__(cls)
        cls._instance._initialized = False
    return cls._instance          # same object every time

def __init__(self):
    if self._initialized:         # __init__ runs on every Database() call,
        return                    # but we build the engine only once
    ... build engine ...
    self._initialized = True
```

So `Database()` and `Database.instance()` both yield the one shared object, and
the engine is constructed a single time. (An earlier version put a guard *inside*
`__init__` that raised on the second call — that's the classic singleton bug,
because the accessor itself triggers a second `__init__`. The `__new__` approach
avoids it cleanly.)

Other details worth knowing:
- `connect_args={"check_same_thread": False}` — SQLite forbids using one
  connection across threads by default, but FastAPI runs sync endpoints in a
  threadpool. Disabling the check is safe because SQLAlchemy's pool hands each
  session its own connection.
- `expire_on_commit=False` — lets us return freshly-created rows after commit
  without a re-fetch.
- `get_db()` is the FastAPI **dependency** that yields one session per request
  and always closes it. Services call `commit()`; the dependency just manages the
  session's lifecycle.

---

### 3. `models/` — the database tables

Three tables, all inheriting SQLAlchemy 2.0's typed `Base`:

- **`User`** (`user.py`) — minimal, because the brief says "assume a logged-in
  user." It exists so `Meeting.host_id` is a real foreign key (cleaner than a
  hard-coded string) and so real auth can be added later without migrating
  meetings.
- **`Meeting`** (`meeting.py`) — the core aggregate. *One* table backs both
  instant and scheduled meetings; they differ only by `status` and whether
  `scheduled_for` is set. `meeting_code` is unique + indexed (every join looks up
  by it). `status` is a Python `enum` (`scheduled`/`live`/`ended`) so the allowed
  states are documented at the schema level and the dashboard split is a cheap
  indexed filter.
- **`Participant`** (`participant.py`) — one row per person who joins. We persist
  these (rather than only tracking live sockets) so the roster and host controls
  have a stable target and so history survives a restart. `is_muted` backs the
  host-control bonus feature.

Relationships use `lazy="selectin"` to avoid the N+1 query problem when loading a
meeting's participants, and `cascade="all, delete-orphan"` so deleting a meeting
cleans up its participants automatically.

---

### 4. `schemas/` — the wire contract

`schemas/meeting.py` defines the Pydantic models for requests and responses.
These are deliberately **separate** from the ORM models so the JSON shape can
evolve independently of the database.

- **Requests:** `MeetingCreate`, `MeetingSchedule`, `JoinRequest`. Validation
  lives here declaratively — e.g. `MeetingSchedule.must_be_in_future` is a
  `field_validator` that rejects past dates before any business logic runs.
- **Responses:** `MeetingOut`, `ParticipantOut`, `JoinResponse`.
  `model_config = ConfigDict(from_attributes=True)` lets Pydantic build these
  directly from ORM objects. `MeetingOut.invite_link` is a computed convenience
  field so the frontend never has to assemble the URL.

---

### 5. `repositories/` — data access

`meeting_repository.py` is the **only** place queries are written. Each method is
one named, intention-revealing operation:
- `get_by_code` / `get_by_id` — lookups.
- `code_exists` — a cheap existence check used by the ID generator.
- `list_upcoming` — scheduled meetings with a future start time, soonest first
  (the dashboard's "Upcoming" section).
- `list_recent` — most recently created meetings ("Recent" section).
- `add` / `add_participant` — stage a row and `flush()` to populate its id.

The repository never commits. It stages changes on the session and lets the
service decide the transaction boundary — that keeps multi-step operations atomic
and the transaction visible in one place.

---

### 6. `services/` — business logic

#### `services/id_generator.py`
Generates Zoom-style numeric meeting codes. Uses `secrets` (cryptographically
strong) so codes aren't guessable or sequential, with a small retry budget on the
(astronomically unlikely) collision. The `exists` check is **injected** as a
callable rather than importing a repository, so the function is pure and trivially
unit-testable — pass a lambda in tests, the real DB check in production.

#### `services/meeting_service.py`
The use-case layer. One public method per route:
- `create_instant` / `schedule` — build a `Meeting`, persist, commit, return.
- `join` — validates the meeting exists and isn't ended (404/409 otherwise),
  flips a `SCHEDULED` room to `LIVE` on first join, makes the first joiner the
  host, registers the participant.
- `end` — marks a meeting ended (host control).
- `list_dashboard` — returns *both* dashboard buckets in one call to save a
  round-trip.

Private helpers keep the public methods short: `_new_code`, `_require_meeting`
(centralises the 404 path), `_to_out` (ORM → schema mapping + invite link).

---

### 7. `routers/` — HTTP entrypoints

`routers/meetings.py` is thin by design. The `get_service` dependency wires a
request-scoped DB session into a `MeetingService`, so each handler is a one-liner
that parses input, delegates, and returns. `routers/health.py` is a trivial
liveness probe Render uses for health checks.

`main.py` is the **composition root**: `create_app()` (an application factory,
kept side-effect-free for testability) builds the app, adds CORS middleware
(needed because the SPA is on a different origin), mounts the routers, and a
`lifespan` hook creates the tables on boot.

---

### 8. `websocket/` — realtime signaling

#### Why this exists
WebRTC connects browsers directly, but the two peers first need to swap **SDP
offers/answers** and **ICE candidates**. They can't do that peer-to-peer until the
peer-to-peer link exists — chicken and egg. The WebSocket breaks the cycle: it's a
*signaling channel* that relays these tiny control messages. It never carries
audio/video, so the server load is negligible.

#### `websocket/connection_manager.py` — the `ConnectionManager` singleton
Holds `room_code → {peer_id: WebSocket}` for the whole process. It **must** be a
singleton: every socket handler has to see the same room map, or two peers in "the
same" meeting would never find each other. Same `__new__` pattern as `Database`.

It holds only *ephemeral* connection state; durable participant records live in
the DB. So a restart drops live sockets (clients reconnect) without corrupting
history. Methods: `connect`, `disconnect` (drops empty rooms to avoid leaks),
`peers`, `send_to` (targeted), `broadcast` (fan-out).

#### `websocket/signaling.py` — the endpoint + protocol
One WebSocket per participant at `/ws/meetings/{code}/{peer_id}`. On connect it
tells the newcomer who's already in the room (`peers`) and tells the room a
newcomer arrived (`peer-joined`). Then it loops, relaying:
- `signal` → forwarded to one `target` peer (the SDP/ICE blobs),
- `control` → broadcast to the room (host mute/remove events).
On disconnect it broadcasts `peer-left`.

**Topology = full mesh:** each participant connects directly to every other. This
is the simplest correct design and is perfect for small demo rooms. At scale
you'd replace the mesh with an SFU (a media server that fans one upstream out to
many) — noted in the README's future work, and a good thing to raise proactively.

---

### 9. Frontend (`frontend/`)

#### `lib/` — the non-visual core
- **`lib/types.ts`** — TypeScript interfaces that mirror the backend schemas
  exactly, so the API is type-safe end to end.
- **`lib/api.ts`** — the API client, exported as a single instance `api` (a
  **singleton**). One configured entrypoint to the backend means no component
  hand-rolls a `fetch` with a divergent base URL. Each method maps 1:1 to a
  backend route. A private `request<T>` helper centralises JSON handling and
  surfaces FastAPI's `{detail}` errors as a typed `ApiError` (carrying the HTTP
  status so callers can branch on 404, etc.). `signalingUrl()` derives the WS URL
  by swapping `http→ws` on the API base.
- **`lib/webrtc.ts` — `MeshClient`** — owns the local media stream and a `Map` of
  `RTCPeerConnection`s (one per remote peer), and drives the offer/answer/ICE
  handshake over the signaling socket. UI components subscribe via callbacks
  (`onRemoteStream`, `onPeerLeft`) and never touch raw WebRTC APIs. Key methods:
  `start()` (getUserMedia + open socket), `toggleAudio/Video`, `stop()`. Internals
  `callPeer` (send an offer), `onPeerSignal` (answer offers, apply ICE),
  `ensurePeer` (lazily build a wired connection). STUN-only ICE; production would
  add TURN.
- **`lib/format.ts`** — pure helpers (`formatMeetingCode` → "874 2261 9043",
  `formatDateTime`).

#### `app/` — routes (Next.js App Router)
- **`app/layout.tsx`** — root layout; minimal so the full-screen meeting room can
  omit the navbar.
- **`app/page.tsx` — the dashboard.** Owns dashboard data + which modal is open.
  `refresh()` loads both sections; handlers wire the three actions:
  `handleNewMeeting` (create + navigate into the room), `handleJoin` (join via
  API then navigate), `handleSchedule` (schedule + refresh so it appears under
  Upcoming). Rendering is delegated to small components; a local `Section`
  component handles headings + empty states.
- **`app/meeting/[code]/page.tsx` — the meeting room.** A small state machine with
  three phases: `loading` (validate the code exists), `prejoin` (gate behind the
  name screen if no name in the query), `incall` (start media + signaling, render
  the grid). The `MeshClient` lives in a **ref**, not state, because it's an
  imperative object whose identity must survive re-renders; React state mirrors
  only what the UI draws (streams, mute flags). Cleanup (`mesh.stop()`) runs on
  unmount/leave.

#### `components/`
- **`Navbar`** — brand + placeholder profile/settings (no auth, per the brief).
- **`ActionButtons`** — the New/Join/Schedule tiles, driven by a declarative tile
  config so the JSX is a single readable map.
- **`MeetingCard`** — one meeting row; its action label adapts to the lifecycle
  (Start / Join / Ended), so one component serves both dashboard sections.
- **`modals/Modal`** — generic dialog shell (overlay, close button,
  Escape-to-close, click-outside-to-close) so each specific modal only supplies
  content.
- **`modals/JoinMeetingModal`** — accepts a bare code *or* a pasted invite link
  (`extractCode` strips everything to digits), plus a name.
- **`modals/ScheduleMeetingModal`** — title/description/datetime/duration; sends
  an ISO timestamp.
- **`meeting/VideoTile`** — binds a `MediaStream` to a `<video>` via a ref (React
  can't set `srcObject` declaratively); `muted` on self prevents echo.
- **`meeting/ControlBar`** — mic/camera/participants/copy-invite/leave; pure
  presentation reflecting state passed in.
- **`meeting/PreJoinScreen`** — the "enter your name" gate.

---

### 10. Likely interview questions (and crisp answers)

- **Why one `meetings` table for instant + scheduled?** They differ only by
  `status`/`scheduled_for`; one table avoids duplication and makes the dashboard
  split a cheap indexed filter.
- **Why a repository layer over SQLite?** Isolates persistence; SQLite → Postgres
  is a one-line `DATABASE_URL` change.
- **Why is signaling over WebSocket but media isn't?** WebRTC media is P2P; the
  server only needs to relay the small SDP/ICE handshake, which keeps it cheap.
- **Mesh vs SFU?** Mesh is O(n²) connections — fine for small rooms, replaced by
  an SFU at scale.
- **Singleton trade-offs?** Great for a single process (one engine pool, one room
  map), but `ConnectionManager` is in-memory, so it won't survive a restart or
  scale across multiple server processes — you'd move to Redis pub/sub for that.
- **How do you make the meeting code unique?** Crypto-random digits with a DB
  existence check and a retry; unique index enforces it at the DB level too.
- **Where do transactions begin/end?** In the service layer (`commit()`), so
  multi-step operations are atomic and the boundary is explicit.

---

## 5. Deploy on Render


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

### 0. Prerequisites
1. Push this repo to GitHub (public, per the assignment).
2. Sign in at https://dashboard.render.com and connect your GitHub.

---

### 1. The exact commands (copy/paste)

#### Backend — `zoomclone-api` (Python Web Service)
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

#### Frontend — `zoomclone-web` (Node Web Service)
| Field            | Value                          |
|------------------|--------------------------------|
| Root Directory   | `frontend`                     |
| Runtime          | Node (auto-detected)           |
| Build Command    | `npm install && npm run build` |
| Start Command    | `npm start`                    |

- `npm start` runs `next start`, which reads `$PORT` and binds `0.0.0.0`
  automatically — no flags needed.

---

### 2. Manual dashboard steps

#### Step A — deploy the backend
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

#### Step B — deploy the frontend
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

#### Step C — open CORS on the backend
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

### 3. One-click blueprint (`render.yaml`)

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

### 4. Environment variables — full reference

#### Backend (`zoomclone-api`)
| Key            | Required | Example                                  | Notes |
|----------------|----------|------------------------------------------|-------|
| `DEBUG`        | no       | `false`                                  | Turns off SQL echo in logs. |
| `CORS_ORIGINS` | yes      | `["https://zoomclone-web.onrender.com"]` | JSON array of allowed SPA origins. |
| `DATABASE_URL` | no       | `sqlite:///./zoomclone.db`               | Default is fine; point at Postgres in prod. |

#### Frontend (`zoomclone-web`)
| Key                   | Required | Example                              | Notes |
|-----------------------|----------|--------------------------------------|-------|
| `NEXT_PUBLIC_API_URL` | yes      | `https://zoomclone-api.onrender.com` | **Build-time** — set before first build. The WebSocket URL is derived from this (`https`→`wss`) automatically. |

---

### 5. Render free-tier gotchas (know these for the interview)

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

### 6. Alternative: Vercel for the frontend (often smoother for Next.js)

Vercel is purpose-built for Next.js and has no cold-start on the frontend:
1. Import the repo at https://vercel.com/new.
2. Set **Root Directory** to `frontend` (Vercel auto-detects Next.js — no build/
   start commands needed).
3. Add env var `NEXT_PUBLIC_API_URL = https://zoomclone-api.onrender.com`.
4. Deploy, then add the Vercel URL to the backend's `CORS_ORIGINS`.

Keep the **backend on Render** either way (Vercel's serverless functions don't
hold long-lived WebSocket connections well, which the signaling needs).
