import { Outlet, Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Bell, Grid, Map, MessageSquare, User, Menu, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const [isDark, setIsDark] = useState(true);
  const { pathname } = useLocation();
  const { currentUser } = useAuth();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="bg-gray-50 dark:bg-background-deep text-gray-900 dark:text-on-surface font-body-md min-h-screen pb-[100px] transition-colors duration-200">
      
      {/* TopAppBar */}
      <header className="w-full top-0 sticky bg-gray-50 dark:bg-background-deep z-40 transition-colors duration-200 border-b border-gray-200 dark:border-transparent">
        <div className="flex items-center justify-between px-margin-mobile py-4 w-full">
          <div className="flex items-center gap-3">
            <img 
              alt="User Profile" 
              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-surface-raised active:scale-95 transition-transform duration-200 cursor-pointer" 
              src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=User"} 
            />
            <h1 className="font-headline-md text-headline-md font-bold text-success-lime dark:text-success-lime text-green-700">Mindcraft</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsDark(!isDark)}
              className="w-10 h-10 rounded-full bg-white dark:bg-surface-container flex items-center justify-center text-success-lime dark:text-success-lime text-green-700 hover:bg-gray-100 dark:hover:bg-surface-container-high transition-colors active:scale-95 duration-200 shadow-sm dark:shadow-none"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="w-10 h-10 rounded-full bg-white dark:bg-surface-container flex items-center justify-center text-success-lime dark:text-success-lime text-green-700 hover:bg-gray-100 dark:hover:bg-surface-container-high transition-colors active:scale-95 duration-200 shadow-sm dark:shadow-none">
              <Bell size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-[1200px] mx-auto px-margin-mobile py-6">
        <Outlet />
      </div>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-safe bg-white dark:bg-surface-container-low shadow-[0px_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0px_-10px_30px_rgba(0,0,0,0.4)] rounded-t-lg transition-colors duration-200 border-t border-gray-200 dark:border-transparent">
        <Link to="/" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 ${pathname === '/' ? 'bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container border-b-4 border-purple-500 dark:border-focus-purple' : 'text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-variant'}`}>
          <Grid size={24} />
          <span className="font-label-md text-label-md mt-1">Home</span>
        </Link>
        <Link to="/find" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 ${pathname === '/find' ? 'bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container border-b-4 border-purple-500 dark:border-focus-purple' : 'text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-variant'}`}>
          <Map size={24} />
          <span className="font-label-md text-label-md mt-1">Match</span>
        </Link>
        <Link to="/leaderboard" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 ${pathname === '/leaderboard' ? 'bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container border-b-4 border-purple-500 dark:border-focus-purple' : 'text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-variant'}`}>
          <Menu size={24} />
          <span className="font-label-md text-label-md mt-1">Board</span>
        </Link>
        <Link to="/forum" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 ${pathname === '/forum' ? 'bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container border-b-4 border-purple-500 dark:border-focus-purple' : 'text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-variant'}`}>
          <MessageCircle size={24} />
          <span className="font-label-md text-label-md mt-1">Forum</span>
        </Link>
        <Link to="/chat" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 ${pathname.startsWith('/chat') ? 'bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container border-b-4 border-purple-500 dark:border-focus-purple' : 'text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-variant'}`}>
          <MessageSquare size={24} />
          <span className="font-label-md text-label-md mt-1">Chat</span>
        </Link>
        <Link to={`/profile/${currentUser?.uid}`} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 ${pathname.startsWith('/profile') ? 'bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container border-b-4 border-purple-500 dark:border-focus-purple' : 'text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-variant'}`}>
          <User size={24} />
          <span className="font-label-md text-label-md mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
};

export default Layout;
