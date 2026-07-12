# Real-Time High-Traffic Inventory System

A "Limited Edition Sneaker Drop" inventory system: users watch live stock counts, reserve an item for a 60-second checkout window, and complete (or lose) that reservation in real time across every open browser tab.

**Stack:** React (Vite) · Node.js/Express · PostgreSQL · Sequelize · Socket.io

```
invms/
├── client/     React dashboard (Vite + Tailwind + Zustand + Socket.io client)
├── server/     Express API + Socket.io server + Sequelize models
├── render.yaml Render Blueprint for the backend
└── .github/workflows/  CI + deploy pipelines
```

## Contents

1. [How to run the app locally](#how-to-run-the-app-locally)
2. [Architecture choice: the 60-second expiration](#architecture-choice-the-60-second-expiration)
3. [Concurrency: preventing overselling](#concurrency-preventing-overselling)
4. [API reference](#api-reference)
5. [Testing](#testing)
6. [Deployment (Vercel + Render + Neon)](#deployment-vercel--render--neon)

## How to run the app locally

### Prerequisites

- Node.js 18+
- A PostgreSQL database - either a local Postgres instance, or a free [Neon](https://neon.tech) project (recommended, since production also uses Neon and the connection string works identically in both places).

### 1. Database / SQL schema setup

You have two equivalent options:

**Option A - let Sequelize create the tables (fastest):**

```bash
cd server
cp .env.example .env      # edit DATABASE_URL to point at your Postgres/Neon instance
npm install
npm run db:sync           # creates users, drops, reservations, purchases tables
npm run db:seed           # optional: adds demo users + 3 sample drops (incl. a 1-unit "last pair" drop)
```

**Option B - run the raw SQL yourself:**

```bash
psql "$DATABASE_URL" -f server/schema.sql
```

`schema.sql` is hand-written to match the Sequelize models exactly (same tables, columns, constraints, and indexes), for anyone who'd rather read/run plain SQL than trust an ORM's `sync()`.

Schema summary:

| Table          | Purpose                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `users`        | one row per display name (no auth/password - see below)                                                |
| `drops`        | a "Merch Drop": name, price, `total_stock`, live `available_stock`, `starts_at`                        |
| `reservations` | one row per Reserve click: `status` (`active`/`completed`/`expired`/`cancelled`), `expires_at`         |
| `purchases`    | one row per completed purchase, `reservation_id` is unique so a reservation can only ever convert once |

### 2. Run the backend

```bash
cd server
npm run dev        # nodemon, http://localhost:8977
```

### 3. Run the frontend

```bash
cd client
cp .env.example .env   # VITE_API_URL=http://localhost:8977 (default is already correct for local dev)
npm install
npm run dev             # http://localhost:5601
```

Open `http://localhost:5601` in two browser windows side by side, pick two different usernames, and reserve/purchase items - the stock count updates instantly in both windows via WebSockets.

### 4. Create a new drop (the admin API - no UI)

```bash
curl -X POST http://localhost:8977/api/drops \
  -H "Content-Type: application/json" \
  -d '{"name": "Air Jordan 1 - Chicago", "price": 210, "totalStock": 100, "startsAt": "2026-07-12T18:00:00Z"}'
```

`startsAt` is optional (defaults to "now"). Drops with a future `startsAt` show up on the dashboard as "not started yet" and can't be reserved until that time passes.

## Architecture choice: the 60-second expiration

Each reservation is a row in `reservations` with an `expires_at` timestamp (`created_at + 60s`). Three layers work together so the expiration is both _fast_ and _correct even if the server restarts_:

1. **`setTimeout` per reservation** (`server/src/services/reservationService.js`, `scheduleExpiration`). The moment a reservation is created, a 60-second timer is armed in memory. When it fires, it expires the reservation and returns the unit to `available_stock`. This is what makes the recovery feel instant in the demo.
2. **A row lock, not a race, against purchase.** Expiring a reservation and completing a purchase both start by taking `SELECT ... FOR UPDATE` on the _same_ reservation row inside a transaction. If a user clicks "Complete Purchase" in the same instant the timer fires, whichever transaction acquires the row lock first wins; the other sees the already-updated `status` and safely no-ops (or rejects with a clear error). There's no window where both could succeed, and no window where stock is double-counted.
3. **A backup sweep, because in-memory timers don't survive a restart.** In-memory timers are a single-process optimization. If the Node process restarts (deploys, crashes, autoscaling), any timers that hadn't fired yet are gone. To make this safe rather than just "usually fine", two things happen on top of the timers:
   - On boot, `rearmActiveReservations()` re-arms a fresh timer for every reservation still marked `active` (or expires it immediately if its window already passed while the process was down).
   - Every 15 seconds, `sweepExpiredReservations()` scans for any `active` reservation whose `expires_at` is in the past and expires it. This is the actual correctness guarantee; the timers are just there to make it feel real-time instead of "up to 15s late".

Both the timer path and the sweep path call the same `expireReservation()` function, which is idempotent (checks `status === 'active'` before doing anything), so there's no double-expiring or double-crediting of stock no matter which path gets there first.

## Concurrency: preventing overselling

This is the core requirement: _"If 100 users click Reserve at the exact same millisecond for the last 1 item, only 1 user should succeed."_

The reservation endpoint does a single **conditional atomic UPDATE**, expressed through Sequelize as:

```js
const [affectedCount, affectedRows] = await Drop.update(
  { availableStock: sequelize.literal("available_stock - 1") },
  {
    where: { id: dropId, availableStock: { [Op.gt]: 0 } },
    transaction,
    returning: true,
  },
);
```

which is equivalent to:

```sql
UPDATE drops
SET available_stock = available_stock - 1
WHERE id = :dropId AND available_stock > 0
RETURNING *;
```

Why this prevents overselling without any explicit locking code: Postgres takes an implicit row-level lock for the duration of an `UPDATE`. If 100 requests hit this statement for the same row at the same millisecond, Postgres **serializes** them - each `UPDATE` runs to completion (reads the current value, checks the `available_stock > 0` guard, writes the new value, commits) before the next one is allowed to start. The moment `available_stock` hits `0`, every subsequent request's `WHERE` clause matches zero rows, `affectedCount` is `0`, and that request is told "sold out" - deterministically, not probabilistically. This is a standard, well-tested pattern for exactly this kind of problem, and it needs no `SELECT ... FOR UPDATE`, no advisory locks, and no application-level mutex.

The `UPDATE` and the `Reservation.create()` that follows it run inside one Sequelize transaction, so if reservation creation somehow failed, the stock decrement would roll back with it - the two never get out of sync.

This is verified by an automated test and a load-test script, not just by reasoning about it:

- `server/tests/reservation.test.js` fires 25 concurrent reservation requests (from 25 different users, via `Promise.all`) at a drop with exactly 1 unit of stock, and asserts exactly 1 succeeds and 24 get a `409 Sold out`.
- `server/scripts/concurrencyTest.js` does the same thing against a _running_ server over real HTTP, for a more true-to-life demo: `npm run test:concurrency` (see [Testing](#testing)).

## API reference

All responses are JSON. Errors: `{ "error": { "message": "...", "code": "..." } }`.

| Method | Path                              | Body                                     | Notes                                                                                                    |
| ------ | --------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/users`                      | `{ username }`                           | find-or-create; returns `{ user: { id, username } }`                                                     |
| `GET`  | `/api/drops`                      | -                                        | list of drops, each with `availableStock`, `isLive`, `isSoldOut`, and nested `recentPurchasers` (last 3) |
| `POST` | `/api/drops`                      | `{ name, price, totalStock, startsAt? }` | creates a drop ("Merch Drop API")                                                                        |
| `POST` | `/api/drops/:dropId/reservations` | `{ userId }`                             | atomic reserve; `409` if sold out                                                                        |
| `POST` | `/api/reservations/:id/purchase`  | `{ userId }`                             | completes purchase; `403` if not your reservation, `409` if expired/already used                         |
| `POST` | `/api/reservations/:id/cancel`    | `{ userId }`                             | releases the reservation early, returns stock immediately                                                |

WebSocket events (`socket.io`), broadcast to all connected clients:

| Event                 | Payload                                                  |
| --------------------- | -------------------------------------------------------- |
| `stock:update`        | `{ dropId, availableStock }`                             |
| `drop:created`        | `{ drop }`                                               |
| `purchase:completed`  | `{ dropId, purchase: { username, purchasedAt, price } }` |
| `reservation:expired` | `{ reservationId, dropId }`                              |

### A note on "Users"

There's no password auth in scope for this assessment. The frontend prompts once for a display name, stores it in `localStorage`, and the backend finds-or-creates a matching `User` row so reservations/purchases can be attributed to somebody (needed for the "top 3 recent purchasers" feature and for verifying "only the reserving user can purchase").

## Testing

```bash
cd server
# tests run against DATABASE_URL - point it at a disposable test database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/invms_test npm test
```

The suite (`tests/reservation.test.js`) covers: no overselling under concurrency, N-for-N reservations succeeding when stock allows it, stock recovery on both forced and real-timer expiration, purchase ownership enforcement, and the nested recent-purchasers list.

To watch the concurrency guarantee run live against your dev server:

```bash
cd server
npm run dev                 # in one terminal
npm run test:concurrency    # in another - fires 100 concurrent reserves, expects exactly 1 success
```

## Deployment (Vercel + Render + Neon)

**Why the backend isn't on Vercel too:** Vercel's compute product is serverless functions - each invocation handles one request/response and then the function instance is torn down. Socket.io needs a long-lived, stateful process to hold open WebSocket connections, which doesn't fit that model (in practice it either falls back to constantly-reconnecting long-polling or drops connections outright). So the Express + Socket.io server is deployed to [Render](https://render.com) (free tier, persistent Node process), and only the static React build goes to Vercel. Both still deploy automatically via GitHub Actions, and the database is Neon either way.

### 1. Neon (Postgres)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string (includes `?sslmode=require`).
3. Run the schema against it once: `psql "<your-neon-url>" -f server/schema.sql` (or run `npm run db:sync` locally with `DATABASE_URL` pointed at Neon).

### 2. Render (backend)

Either click **New +** → **Blueprint** in the Render dashboard and point it at this repo (it will read `render.yaml` at the repo root), or create a Web Service manually with:

- Root directory: `server`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables: `DATABASE_URL` (your Neon URL), `DB_SSL=true`, `CLIENT_URL` (your Vercel URL, for CORS), `RESERVATION_WINDOW_SECONDS=60`

Then create a **Deploy Hook** (Settings → Deploy Hook) and save its URL as the `RENDER_DEPLOY_HOOK_URL` GitHub Actions secret - `.github/workflows/deploy-backend.yml` runs the test suite against a throwaway Postgres container and, only if it passes, POSTs to that hook to ship `server/`.

### 3. Vercel (frontend)

1. Import the repo in Vercel, set **Root Directory** to `client` (or rely on `client/vercel.json`).
2. Add the environment variable `VITE_API_URL` = your Render URL (e.g. `https://invms-server.onrender.com`).
3. Grab a CLI token (`vercel login` then Account Settings → Tokens) and, from the `client` folder, run `vercel link` once to get `orgId`/`projectId` (printed to `.vercel/project.json` - do not commit this file).
4. Save three GitHub Actions secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. `.github/workflows/deploy-frontend.yml` then builds and deploys `client/` to production on every push to `main` that touches it.

### GitHub Actions secrets checklist

| Secret                   | Where it comes from                               |
| ------------------------ | ------------------------------------------------- |
| `VERCEL_TOKEN`           | Vercel → Account Settings → Tokens                |
| `VERCEL_ORG_ID`          | `client/.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID`      | `client/.vercel/project.json` after `vercel link` |
| `RENDER_DEPLOY_HOOK_URL` | Render → invms-server → Settings → Deploy Hook    |

No database credentials or `.env` files are committed anywhere in this repo - `DATABASE_URL` is set directly in the Render dashboard, and `VITE_API_URL` directly in the Vercel dashboard.

### Troubleshooting CORS between Vercel and Render

If the deployed frontend gets a CORS error hitting the deployed API, check two things:

1. **`CLIENT_URL` on Render must exactly match the frontend's origin** - scheme, host, and port, no trailing slash (e.g. `https://your-app.vercel.app`, not `https://your-app.vercel.app/`). It accepts a comma-separated list if you need to allow more than one origin (production domain + a preview domain). Any request from an origin not in that list is logged server-side (`CORS rejected origin "..."`, visible in the Render service logs) so a mismatch is easy to spot instead of guessing from the browser console.
2. **Helmet's `Cross-Origin-Resource-Policy` header.** Helmet defaults to `same-origin`, which makes Chrome block cross-origin `fetch()` responses even when `Access-Control-Allow-Origin` is correct - indistinguishable from a real CORS error in the console. `server/src/app.js` sets this to `cross-origin` explicitly, since this API is meant to be called from a different origin (Vercel) by design.

### Live URLs

- Frontend: _add your Vercel URL here after deploying_
- Backend: _add your Render URL here after deploying_
