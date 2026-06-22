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
      <div className="dark">
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
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
