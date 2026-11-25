import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
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

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
};

const ProfileRedirect = () => {
  const { currentUser } = useAuth();
  if (!currentUser?.uid) return <Navigate to="/login" replace />;
  return <Navigate to={`/profile/${currentUser.uid}`} replace />;
};

const AppContent = () => {
  const { currentUser } = useAuth();
  const { isDark } = useAppContext();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(
    localStorage.getItem('hasSeenOnboarding') === 'true'
  );

  const isAuthPage = window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/signup') || window.location.pathname.startsWith('/sso-callback');

  if (currentUser && !hasSeenOnboarding && !isAuthPage) {
    return (
      <Onboarding
        onComplete={() => {
          localStorage.setItem('hasSeenOnboarding', 'true');
          setHasSeenOnboarding(true);
        }}
      />
    );
  }

  return (
    <div className={`relative min-h-screen transition-colors ${isDark ? 'bg-[#1C1C2E] text-white' : 'bg-[#FAFAFA] text-gray-900'}`}>
      {isDark && <StarsBackground />}

      <NotificationProvider>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/login/*" element={<Login />} />
            <Route path="/signup/*" element={<SignUp />} />
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
