# AdDU-Seats

Real-time library seat reservation and occupancy management for Ateneo de Davao University library facilities.

The maintained product scope and non-regression checklist live in [`docs/FEATURES.md`](docs/FEATURES.md).

**Phase 1** provides the project foundation: monorepo structure, database schema, Google OAuth login, health checks, Redis connectivity, and Socket.IO initialization. Seat maps, reservations, QR flows, and dashboards are built in later phases.

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React (Vite), React Router, Tailwind CSS |
| Backend   | Node.js, Express                    |
| Database  | PostgreSQL (Prisma ORM)             |
| Cache     | Redis                               |
| Auth      | Google OAuth 2.0 + JWT sessions     |
| Realtime  | Socket.IO                           |

## Prerequisites

Install and run locally before starting the app:

1. **Node.js** 18+ and npm
2. **PostgreSQL** — create a database, e.g. `addu_seats`
3. **Redis** — default local instance on port 6379
4. **Google Cloud OAuth credentials** — see [Google OAuth setup](#google-oauth-setup) below

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
4. Copy the **Client ID** and **Client Secret** into `backend/.env`.

## Project Structure

```
addu-seats/
├── frontend/          # Vite + React app (port 5173)
├── backend/           # Express API (port 3001)
└── README.md
```

## Environment Variables

### Backend (`backend/.env`)

Copy from `backend/.env.example` and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback (default: `http://localhost:3001/api/auth/google/callback`) |
| `JWT_SECRET` | Random string for signing session tokens |
| `SESSION_SECRET` | Random string (reserved for future cookie sessions) |
| `PORT` | Backend port (default: 3001) |
| `FRONTEND_URL` | Frontend origin for CORS and OAuth redirect (default: `http://localhost:5173`) |

### Frontend (`frontend/.env`)

Copy from `frontend/.env.example`:

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (default: `http://localhost:3001`) |

## Getting Started

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit both .env files with your values
```

### 3. Database setup

```bash
cd backend
npx prisma migrate dev --name init
npm run seed
```

### 4. Start Redis and PostgreSQL

Ensure both services are running before starting the backend.

### 5. Start the backend

```bash
cd backend
npm run dev
```

### 6. Start the frontend

In a second terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

## Demo Accounts

Open `/login` and use either one-click account. No password is required because these accounts are only for local UI and workflow testing.

| Role | Name | Email |
|------|------|-------|
| Student | Alex Student | `student.demo@addu.edu.ph` |
| Admin | Morgan Admin | `admin.demo@addu.edu.ph` |

The frontend opens the selected role in local preview mode without enabling protected API actions. The seeded backend users remain available for API-level development and testing.

## API Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (Postgres + Redis) |
| GET | `/api/auth/google` | Start Google OAuth flow |
| GET | `/api/auth/google/callback` | OAuth callback (redirects to frontend with token) |
| GET | `/api/auth/me` | Current user profile (requires Bearer token) |

## Verification Checklist

Run through this list to confirm Phase 1 works:

- [ ] PostgreSQL is running and `DATABASE_URL` in `backend/.env` is correct
- [ ] Redis is running and `REDIS_URL` in `backend/.env` is correct
- [ ] `backend/.env` and `frontend/.env` are filled in (especially Google OAuth + JWT secret)
- [ ] `cd backend && npx prisma migrate dev --name init` completes without errors
- [ ] `cd backend && npm run seed` inserts the current development seats and two demo accounts
- [ ] `cd backend && npm run dev` starts on port 3001
- [ ] `cd frontend && npm run dev` starts on port 5173
- [ ] `curl http://localhost:3001/api/health` returns `{ "status": "ok", "postgres": "connected", "redis": "connected" }`
- [ ] Open `http://localhost:5173`, click **Sign in with Google**, complete login, and land on the Seat Map page with your name shown
- [ ] Browser devtools → Application → Local Storage shows an `addu_seats_token` entry

## Phase Roadmap

| Phase | Scope |
|-------|-------|
| **1 (current)** | Foundation, schema, auth, health checks |
| 2 | Interactive SVG seat map |
| 3 | Reservation flow + QR verification |
| 4 | Break timers + auto-release (Redis TTL) |
| 5 | Admin dashboard + occupancy analytics |
| 6 | Forecasting, domain-restricted OAuth, deployment |
