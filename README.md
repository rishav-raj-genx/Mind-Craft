# Mindcraft

Mindcraft is a peer tutoring platform for college students. It combines skill-based matching, real-time chat, a doubt forum with Sarvam AI study hints, gamification, streaks, Mind Tokens, and an Expo mobile frontend.

## Repository Layout

```txt
Mind-Craft/
├── backend/              # Node.js + Express API, Neo4j AuraDB, Firebase Auth, WebSocket chat
├── frontend-react/       # Vite React PWA/mobile-web app
│   └── mobile/           # Expo React Native app
├── render.yaml           # Render Blueprint for full monorepo deployment
└── README.md
```

## Important Render Deployment Note

This root folder has `render.yaml`. That means:

- If you deploy from the full `Mind-Craft` repo, keep Render's Blueprint Path as `render.yaml`.
- The current root `render.yaml` uses `rootDir: backend`, so it expects the repo to contain a nested `backend/` folder.
- If you deploy from a backend-only repo, copy/create a separate `render.yaml` inside that backend repo root and remove `rootDir: backend`.

For your screenshot error, Render was connected to `Mind-Craft-Backend`, but that repo did not have `render.yaml` on the selected `main` branch.

## Core Features

- Firebase Authentication for user login.
- Neo4j AuraDB for users, skills, matches, chat, doubts, tokens, streaks, and badges.
- Sarvam AI integration for bilingual English/Hindi AI Assist study hints.
- WebSocket-based real-time chat and notifications.
- Doubt forum with compressed screenshot/image upload.
- Render cron workflow for weekly streak audits and Weekly Warrior rewards.
- Expo native app with global alert modal, ErrorBoundary, optimized FlatLists, cached images, and API resilience.

## Local Setup

Install dependencies separately:

```bash
cd backend
npm install

cd ../frontend-react
npm install

cd mobile
npm install
```

Run backend:

```bash
cd backend
npm run dev
```

Run web frontend:

```bash
cd frontend-react
npm run dev
```

Run Expo app:

```bash
cd frontend-react/mobile
npm start
```

## Verification Commands

Backend:

```bash
cd backend
node --check server.js
node --check src/routes/doubt.js
node --check src/services/sarvamAI.js
node --check src/workflows/weeklyAudit.js
```

Web frontend:

```bash
cd frontend-react
npm run build
```

Expo frontend:

```bash
cd frontend-react/mobile
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/mindcraft-expo-check
```

## Deployment Summary

Backend is deployed on Render using `render.yaml`.

Expo mobile is built with EAS:

```bash
cd frontend-react/mobile
eas build --platform android --profile production
```

Set this before native production builds:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com/api
```

## Documentation

- Backend details: [backend/README.md](backend/README.md)
- Frontend details: [frontend-react/README.md](frontend-react/README.md)
