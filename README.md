# Munchscene

Munchscene is a fairness-first group dining app.

Instead of pure majority voting, it scores restaurant options across all members,
applies fairness penalties, and returns a ranked shortlist with AI explanations.

## What It Does

- Create a room and share a 6-character code
- Join a room with live multiplayer updates
- Edit preferences in real time
- Run a fairness-based resolver
- See ranked restaurant results
- Review elimination reasons from hard constraints
- Read AI-generated explanations for top picks

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Realtime data: Firebase Realtime Database
- Places data: Google Places API
- AI explanations: OpenRouter (Gemini model)
- Monorepo workspaces: `client`, `server`, `shared`

## Repo Structure

```text
client/   React app (Vite)
server/   Express API
shared/   Shared types + scoring contracts
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env` in the repo root from `.env.example`:

```bash
cp .env.example .env
```

Fill in all required values.

### 3. Run frontend

```bash
npm run dev:client
```

### 4. Run backend

```bash
npm run dev:server
```

Frontend defaults to `http://localhost:5173`.
Backend defaults to `http://localhost:8080`.

## Scripts

From repo root:

- `npm run dev:client` - run Vite frontend
- `npm run dev:server` - run Express server with `tsx watch`
- `npm run build` - build all workspaces
- `npm run typecheck` - typecheck all workspaces

## Environment Variables

Use the exact keys from `.env.example`.

### Client (`VITE_*`)

- `VITE_APP_NAME`
- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Server

- `PORT` (optional, defaults to `8080`)
- `CLIENT_ORIGIN` (optional, defaults to `http://localhost:5173`)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (keep newline escapes: `\n`)
- `FIREBASE_DATABASE_URL`
- `GOOGLE_PLACES_API_KEY`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional, defaults to `google/gemini-2.5-flash`)

## Deployment

Any static frontend host + Node backend host works.

Minimal production requirements:

- Deploy `client` and set `VITE_API_BASE_URL` to your backend URL.
- Deploy `server` and set `CLIENT_ORIGIN` to your frontend URL.
- Configure all required env vars from `.env.example` on each platform.

## Firebase Rules Note

The client currently writes room state directly to Realtime Database.
If your RTDB rules are locked down, room creation/join may fail with
`permission-denied`.

For demo environments, ensure rules allow app writes to:

- `rooms/*`
- `roomsByCode/*`
- `results/*`

## API Endpoint

Server exposes:

- `GET /health`
- `POST /rooms/:roomId/resolve`

## Troubleshooting

### `Cannot find package 'cors'`

Run:

```bash
npm install
```

### Firebase `permission-denied` when creating a room

Check Realtime Database rules and ensure write access for your current setup.

### CORS errors in browser

Set `CLIENT_ORIGIN` on the server to your frontend domain.

## Team

- Abhinav Badesha
- Binod Dayal
- Dilshan Dadrao
- Jeevan Bhullar
