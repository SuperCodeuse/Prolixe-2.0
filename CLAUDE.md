# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Prolixe-V2** ("DACH-GPT") is a teacher's class-management app: schedule, journal
(lesson log), assignments/corrections, evaluations, students, class councils. It is a
two-package monorepo — `client/` (Create React App) and `server/` (Express + MySQL) —
served in production under the URL base **`/GPT`** at `https://studio-dach.site/GPT/`.

## Commands

Client (`cd client`):
```bash
npm start          # CRA dev server; proxies /api → http://localhost:5000 (package.json "proxy")
npm run build      # production build → client/build (homepage "/GPT", sourcemaps off, heap-capped)
```

Server (`cd server`):
```bash
npm run dev        # nodemon src/server.js (auto-reload)
node src/server.js # plain run (this is how PM2 runs it in prod, on port 5000)
```

There is no real test suite (only the default CRA `react-scripts test`).

The **server needs a `.env`** (loaded by dotenv) with: `DB_SERVER`, `DB_PORT`,
`DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `EMAIL_HOST`, `EMAIL_PORT`,
`EMAIL_USER`, `EMAIL_PASS`, `FRONTEND_URL`, `PORT`.

## Backend architecture (`server/src`)

Single entrypoint `server.js` that:
- Creates one **`mysql2/promise` connection pool** and injects it into every request via
  a middleware setting **`req.pool`**. Controllers read `req.pool` and run **raw SQL** — there
  is no ORM in use. (`mongoose`/`mssql` appear in dependencies but are legacy/unused; the
  live database is **MySQL**.)
- Splits routing into **public vs protected**: `app.use('/api/auth', AuthRoute)` is open
  (login, forgot/reset password); everything else is mounted on an `apiRouter` that first
  applies `verifyToken`, then mounts each resource (`/users`, `/classes`, `/schedule`,
  `/journal`, `/attributions`, `/evaluations`, `/students`, `/conseilDeClasse`, `/notes`,
  `/school-years`, `/holidays`, `/subjects`) — all under `/api`.
- Auth is **JWT** (`jsonwebtoken` + `bcrypt`). `middleware/authMiddleware.js` reads
  `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, and sets `req.user`.
- Auto-migrates via `CREATE TABLE IF NOT EXISTS` inside `initDatabase()` on boot.
- `/api/generate-document` streams a PDF via `pdfkit`; `/api/health` pings the DB.

The layering is uniform: **route → controller → `req.pool` raw SQL**. To add an endpoint,
add a route file, mount it on `apiRouter` (protected) or directly (public), and write the
controller against `req.pool`.

## Frontend architecture (`client/src`)

- **Provider stack** (in `index.js`, order matters):
  `AuthProvider → ToastProvider → JournalProvider → App`, all under
  `<BrowserRouter basename="/GPT">`.
- **Three-layer data access**: `components/**` consume **`hooks/use*.js`** (React-context
  providers + data hooks) which call **`services/*Service.js`**, which all go through
  **`services/api.js`** (`ApiService.request`). `api.js` prepends `API_BASE_URL` (`/GPT/api`)
  and attaches the JWT read from `localStorage`/`sessionStorage` key **`authToken`**; it
  throws if no token is present and dispatches a global `auth-error` event on 401/403
  (which `useAuth` turns into a logout).
- **Routing/auth gate** (`App.jsx`): renders the authenticated app only when
  `isAuthenticated`; otherwise only login/register/reset routes. `useAuth` restores the
  session synchronously from stored user on mount.

### Critical pitfall: data providers mounted above the auth gate

`JournalProvider` (and any future top-level data provider) mounts **before** the user is
authenticated. It must therefore trigger its data load from an effect **gated on
`isAuthenticated`**, not a bare mount effect — otherwise the first fetch runs with no token
(fails), and after login the provider never refetches, so the dashboard shows nothing until
a full page refresh. `useJournal.js`'s load effect is written this way on purpose; preserve
that pattern when adding provider-level fetches.

## Production deployment notes

- Client build (`client/build`) is served by **nginx** at `location /GPT/`; the API is
  proxied `/GPT/api/` → `http://localhost:5000/api/`. The server process runs under **PM2**.
- The base path is wired in three places that must stay in sync: `homepage: "/GPT"`
  (package.json), `basename="/GPT"` (index.js), and the nginx `location /GPT/` blocks.
- The host VPS is **RAM-constrained (~700 MB free, no swap)**. Build with the existing
  heap cap; prefer building into a fresh dir (`BUILD_PATH=…/build_new`) and repointing the
  nginx symlink, rather than overwriting `build/` in place, to avoid downtime and OOM
  killing the other Node services running on the box.
