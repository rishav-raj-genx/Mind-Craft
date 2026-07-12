# Mindcraft Frontend

This folder contains the Mindcraft frontend surfaces:

- Vite React PWA/mobile-web app in `frontend-react/`
- Expo React Native app in `frontend-react/mobile/`

Both clients communicate with the Node backend API.

## Web/PWA App

### Stack

- Vite
- React
- Tailwind CSS
- Firebase client auth
- Axios API services
- WebSocket chat
- PWA service worker
- `browser-image-compression` for doubt screenshots

### Local Setup

```bash
cd frontend-react
npm install
npm run dev
```

Default local URL:

```txt
http://localhost:5173
```

### Web Environment Variables

Create `.env` or `.env.local` in `frontend-react/`:

```env
VITE_API_BASE_URL=https://mindcraft-backend-g2hj.onrender.com

VITE_FIREBASE_API_KEY=your-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

For production:

```env
VITE_API_BASE_URL=https://your-render-backend.onrender.com
```

### Web Features

- Login/signup with Firebase Auth.
- Home dashboard.
- Find Mate graph/matching experience.
- Real-time chat and unread indicators.
- Doubt forum with:
  - Sarvam AI Assist hints,
  - compressed screenshot/image uploads,
  - image thumbnails,
  - circular full-screen slideshow.
- Profile pages with normalized social links.
- Streaks, badges, ratings, and Mind Tokens.

### Web Build

```bash
cd frontend-react
npm run build
```

Preview locally:

```bash
npm run preview
```

## Expo Mobile App

The native app lives in:

```txt
frontend-react/mobile
```

### Stack

- Expo SDK 57
- Expo Router
- TypeScript
- Axios
- AsyncStorage
- React Native Maps
- Expo Image
- Expo Image Picker
- Expo Image Manipulator

### Local Setup

```bash
cd frontend-react/mobile
npm install
npm start
```

### Mobile Environment Variable

The mobile app needs:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com/api
```

For local Android emulator, do not use `localhost`; use your machine IP or emulator host address.

Example:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com/api npm start
```

### Mobile Features

- Native tab navigation: Home, Find, Forum, Profile.
- Native components, not WebView.
- Global alert modal with success/error/info/warning states.
- Axios response interceptor for friendly network errors.
- Expo Router ErrorBoundary for crash-safe UI.
- Optimized FlatLists for low-RAM phones.
- Cached avatars/images through `expo-image`.
- Doubt images compressed before upload.

### Mobile Checks

```bash
cd frontend-react/mobile
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/mindcraft-expo-check
```

## Expo EAS Build

Install and login:

```bash
npm install -g eas-cli
eas login
```

Configure if needed:

```bash
cd frontend-react/mobile
eas build:configure
```

Preview APK:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com/api eas build --platform android --profile preview
```

Production Android:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com/api eas build --platform android --profile production
```

Production iOS:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-render-backend.onrender.com/api eas build --platform ios --profile production
```

Submit:

```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

## Deployment Order

1. Deploy backend on Render.
2. Confirm `/health` works.
3. Set frontend API URL to the Render backend.
4. Build/deploy web app if needed.
5. Build Expo app with EAS using `EXPO_PUBLIC_API_BASE_URL`.
