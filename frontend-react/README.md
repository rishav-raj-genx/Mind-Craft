# Mindcraft Frontend - React Conversion

This is the fully converted React application for the Mindcraft P2P Tutoring platform, built with Vite, React, Tailwind CSS, and Firebase.

## 3 Steps to Run Locally

**Step 1: Start the Backend**
Open a terminal in the `backend/` directory and start the Express server.
```bash
cd backend
npm install
npm run dev
```

**Step 2: Configure Firebase**
In the `frontend-react/` directory, ensure you have a `.env.local` file with your Firebase credentials:
```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=mind-craft-4f16c
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Step 3: Start the Frontend**
Open a separate terminal in the `frontend-react/` directory and start the Vite development server.
```bash
cd frontend-react
npm install
npm run dev
```

## Project Structure

- `src/components/`: Reusable components (Layout, TopAppBar, etc.)
- `src/pages/`: Main application screens (Home, Login, Profile, etc.)
- `src/context/`: React Context providers (AuthContext)
- `src/services/`: API client modules using Axios (userService, chatService, etc.)
- `src/config/`: Firebase and Axios initialization

## Features Integrated

- **Authentication**: Firebase Google Sign-In and Email/Password flow. ID Tokens attached to backend requests via Axios interceptors.
- **WebSocket Chat**: Real-time P2P messaging using the `ChatWebSocket` client connecting to `ws://localhost:3000/ws`.
- **Voice Search**: Built-in MediaRecorder on the Match screen to send audio blobs to the `/api/voice-search` endpoint for intent detection.
- **Gamification**: Real-time integration with token balance, streaks, and match leaderboards.
- **Styling**: Preserved custom Stitch UI tailwind configurations with responsive layouts and dark mode support.
