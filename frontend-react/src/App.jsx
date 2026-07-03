import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
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

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const { currentUser } = useAuth();

  return (
    <Router>
      <div>
        <Routes>
          <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/signup" element={currentUser ? <Navigate to="/" replace /> : <SignUp />} />
          
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
      </div>
    </Router>
  );
}

export default App;
