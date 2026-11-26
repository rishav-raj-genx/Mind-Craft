import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/react';
import { useAuth } from './context/AuthContext';
import { AppProvider, useAppContext } from './context/AppContext';
import Layout from './components/Layout';
import Onboarding from './components/Onboarding';
import { StarsBackground } from './components/ThemeToggle';
import { NotificationProvider } from './context/NotificationContext';

// Lazy-loaded routes
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const FindMate = lazy(() => import('./pages/FindMate'));
const Chat = lazy(() => import('./pages/Chat'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const DoubtForum = lazy(() => import('./pages/DoubtForum'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Wallet = lazy(() => import('./pages/Wallet'));
const BadgeProgress = lazy(() => import('./pages/BadgeProgress'));
const StreakDetail = lazy(() => import('./pages/StreakDetail'));
const SessionsDetail = lazy(() => import('./pages/SessionsDetail'));
const RatingDetail = lazy(() => import('./pages/RatingDetail'));
const MatesDetail = lazy(() => import('./pages/MatesDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

export const PageSpinner = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
    <div className="w-8 h-8 border-3 border-focus-purple border-t-transparent rounded-full animate-spin" />
    <span className="text-sm text-gray-500 font-medium">Loading...</span>
  </div>
);

// Route guard for authenticated + registered users (State 3)
const ProtectedRoute = ({ children }) => {
  const { isLoaded, isSignedIn, isCheckingProfile, isRegistered, needsOnboarding } = useAuth();

  if (!isLoaded || (isSignedIn && isCheckingProfile)) {
    return <PageSpinner />;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" replace />;
  }

  if (needsOnboarding || !isRegistered) {
    return <Navigate to="/signup?reason=no_profile" replace />;
  }

  return children;
};

// Route guard for /login:
// - Not signed in -> render Login
// - Signed in + needs onboarding -> redirect to /signup?reason=no_profile
// - Signed in + registered -> redirect to /
const PublicLoginRoute = ({ children }) => {
  const { isLoaded, isSignedIn, isCheckingProfile, isRegistered, needsOnboarding } = useAuth();

  if (!isLoaded || (isSignedIn && isCheckingProfile)) {
    return <PageSpinner />;
  }

  if (isSignedIn) {
    if (isRegistered && !needsOnboarding) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/signup?reason=no_profile" replace />;
  }

  return children;
};

// Route guard for /signup:
// - Not signed in -> render SignUp (Step 1 Clerk SignUp)
// - Signed in + needs onboarding -> render SignUp (Step 2 Onboarding Form)
// - Signed in + registered -> redirect to /
const PublicSignUpRoute = ({ children }) => {
  const { isLoaded, isSignedIn, isCheckingProfile, isRegistered, needsOnboarding } = useAuth();

  if (!isLoaded || (isSignedIn && isCheckingProfile)) {
    return <PageSpinner />;
  }

  if (isSignedIn && isRegistered && !needsOnboarding) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const ProfileRedirect = () => {
  const { currentUser, isRegistered, needsOnboarding } = useAuth();
  if (needsOnboarding || !isRegistered) {
    return <Navigate to="/signup?reason=no_profile" replace />;
  }
  const uid = currentUser?.uid || currentUser?.id;
  if (!uid) return <Navigate to="/login" replace />;
  return <Navigate to={`/profile/${uid}`} replace />;
};

export const INTRO_SEEN_KEY = 'mindcraft_intro_seen_v1';

const AppContent = () => {
  const { isLoaded, isSignedIn, isCheckingProfile } = useAuth();
  const { isDark } = useAppContext();
  const [showIntroModal, setShowIntroModal] = useState(() => {
    try {
      return localStorage.getItem(INTRO_SEEN_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleOpenTour = () => setShowIntroModal(true);
    window.addEventListener('open-mindcraft-tour', handleOpenTour);
    return () => window.removeEventListener('open-mindcraft-tour', handleOpenTour);
  }, []);

  const handleIntroComplete = useCallback(() => {
    try {
      localStorage.setItem(INTRO_SEEN_KEY, 'true');
    } catch (e) {
      console.error(e);
    }
    setShowIntroModal(false);
  }, []);

  if (!isLoaded || (isSignedIn && isCheckingProfile)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#1C1C2E]' : 'bg-[#FAFAFA]'}`}>
        <PageSpinner />
        {showIntroModal && (
          <Onboarding
            isOpen={showIntroModal}
            onComplete={handleIntroComplete}
            onClose={handleIntroComplete}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen transition-colors ${isDark ? 'bg-[#1C1C2E] text-white' : 'bg-[#FAFAFA] text-gray-900'}`}>
      {isDark && <StarsBackground />}

      {showIntroModal && (
        <Onboarding
          isOpen={showIntroModal}
          onComplete={handleIntroComplete}
          onClose={handleIntroComplete}
        />
      )}

      <NotificationProvider>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/login/*" element={<PublicLoginRoute><Login /></PublicLoginRoute>} />
            <Route path="/signup/*" element={<PublicSignUpRoute><SignUp /></PublicSignUpRoute>} />
            <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback signInForceRedirectUrl="/" signUpForceRedirectUrl="/signup" />} />
            <Route path="/login/sso-callback" element={<AuthenticateWithRedirectCallback signInForceRedirectUrl="/" signUpForceRedirectUrl="/signup" />} />

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Home />} />
              <Route path="/profile" element={<ProfileRedirect />} />
              <Route path="/profile/:uid" element={<Profile />} />
              <Route path="/find" element={<FindMate />} />
              <Route path="/chat/:matchId" element={<Chat />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/forum" element={<DoubtForum />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/badges" element={<BadgeProgress />} />
              <Route path="/streak" element={<StreakDetail />} />
              <Route path="/sessions" element={<SessionsDetail />} />
              <Route path="/ratings" element={<RatingDetail />} />
              <Route path="/mates" element={<MatesDetail />} />
            </Route>

            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </NotificationProvider>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </Router>
  );
}
