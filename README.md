# AdDU-Seats

Real-time library seat reservation and occupancy management for Ateneo de Davao University library facilities.

The maintained product scope and non-regression checklist live in [`docs/FEATURES.md`](docs/FEATURES.md).

The current application includes public floor maps, Google OAuth/JWT authentication, live reservations, front-desk verification, break timers, ghost-seat reporting, Socket.IO updates, and administrative analytics.

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

1. **Node.js** 22+ and npm
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
| `SESSION_SECRET` | Random string used for the temporary OAuth redirect session |
| `PORT` | Backend port (default: 3001) |
| `CORS_ORIGIN` | Frontend origin for CORS and OAuth redirect (default: `http://localhost:5173`) |

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

## Test Accounts

Open `/login` and continue with a real Google account. New users are created only after a successful Google OAuth login; the database seed does not create sample users.

For local testing, set `ALLOW_ANY_GOOGLE_EMAIL=true`. Keep it `false` or omit it in production so only accounts under `SCHOOL_EMAIL_DOMAIN` can sign in.

Accounts listed in `STAFF_EMAILS` receive the admin role. Other authorized school accounts receive the student role.

When the map geometry changes, regenerate the checked-in backend seat list before seeding:

```bash
cd backend
npm run sync:seats
npm run seed
```

## Main API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (Postgres + Redis) |
| GET | `/api/auth/google` | Start Google OAuth flow |
| GET | `/api/auth/google/callback` | OAuth callback (redirects with a one-time exchange code) |
| POST | `/api/auth/exchange` | Exchange the one-time OAuth code for a JWT |
| GET | `/api/auth/me` | Current user profile (requires Bearer token) |
| GET | `/api/seats` | Public live seat list, optionally filtered by building and floor |
| POST | `/api/seats/scan` | Validate a physical-node QR token and return safe seat details |
| POST | `/api/seats/:id/flag` | Report an apparently vacant occupied seat |
| POST | `/api/reservations` | Create a reservation from a physical-node QR token |
| GET | `/api/reservations/me/current` | Current authenticated student's reservation |
| GET | `/api/reservations/pending` | Admin front-desk queue |
| POST | `/api/reservations/:id/approve` | Approve pending entry |
| POST | `/api/reservations/:id/break/start` | Start the five-minute break timer |
| POST | `/api/reservations/:id/break/extend` | Extend a break up to 15 minutes |
| POST | `/api/reservations/break/return` | Return by scanning the physical QR |
| POST | `/api/reservations/reverify` | Clear a ghost-seat report by physical QR scan |

## Verification Checklist

Run through this list to confirm Phase 1 works:

- [ ] PostgreSQL is running and `DATABASE_URL` in `backend/.env` is correct
- [ ] Redis is running and `REDIS_URL` in `backend/.env` is correct
- [ ] `backend/.env` and `frontend/.env` are filled in (especially Google OAuth + JWT secret)
- [ ] `cd backend && npx prisma migrate dev --name init` completes without errors
- [ ] `cd backend && npm run seed` inserts the 821 mapped development seats without creating sample users
- [ ] `cd backend && npm run dev` starts on port 3001
- [ ] `cd frontend && npm run dev` starts on port 5173
- [ ] `curl http://localhost:3001/api/health` returns `{ "status": "ok", "timestamp": "..." }`
- [ ] Open `http://localhost:5173`, click **Sign in with Google**, complete login, and land on the Seat Map page with your name shown
- [ ] Open a development physical-QR URL such as `http://localhost:5173/scan?token=seat%3Ag1-s001`, confirm the node, and create a reservation
- [ ] Clicking an available node on the public map only instructs the student to scan its physical QR
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
