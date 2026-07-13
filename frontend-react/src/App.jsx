import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AppProvider, useAppContext } from './context/AppContext';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Home from './pages/Home';
import Profile from './pages/Profile';
import FindMate from './pages/FindMate';
import Chat from './pages/Chat';
import Leaderboard from './pages/Leaderboard';
import DoubtForum from './pages/DoubtForum';
import Notifications from './pages/Notifications';
import Wallet from './pages/Wallet';
import BadgeProgress from './pages/BadgeProgress';
import StreakDetail from './pages/StreakDetail';
import SessionsDetail from './pages/SessionsDetail';
import RatingDetail from './pages/RatingDetail';
import MatesDetail from './pages/MatesDetail';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import Onboarding from './components/Onboarding';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
};

import ThemeToggle, { StarsBackground } from './components/ThemeToggle';
import { NotificationProvider } from './context/NotificationContext';

const AppContent = () => {
  const { currentUser } = useAuth();
  const { isAppLoading, isDark } = useAppContext();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(
    localStorage.getItem('hasSeenOnboarding') === 'true'
  );

  const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/signup';

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
      
      {currentUser && isAppLoading && hasSeenOnboarding && <LoadingScreen />}
      
      <NotificationProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Home />} />
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
        </Routes>
      </NotificationProvider>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </Router>
  );
}

export default App;
