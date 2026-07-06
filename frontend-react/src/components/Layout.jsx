import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Grid, Map, MessageSquare, User, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MindcraftLogo from './MindcraftLogo';

const Layout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  const navItems = [
    { path: '/', icon: Grid, label: 'Home', match: (p) => p === '/' },
    { path: '/find', icon: Map, label: 'Map', match: (p) => p === '/find' },
    { path: '/forum', icon: MessageCircle, label: 'Forum', match: (p) => p === '/forum' },
    { path: '/chat', icon: MessageSquare, label: 'Chat', match: (p) => p.startsWith('/chat') },
    { path: `/profile/${currentUser?.uid}`, icon: User, label: 'Profile', match: (p) => p.startsWith('/profile') },
  ];

  return (
    <div className="bg-gray-50 dark:bg-background-deep text-gray-900 dark:text-on-surface font-body-md min-h-screen pb-[100px] transition-colors duration-200">

      {/* TopAppBar */}
      <header className="w-full top-0 sticky bg-gray-50 dark:bg-background-deep z-40 transition-colors duration-200 border-b border-gray-200 dark:border-transparent">
        <div className="flex items-center justify-between px-margin-mobile py-4 w-full">
          <div className="flex items-center gap-3">
            <MindcraftLogo size="md" showIcon={true} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setHasUnread(false);
                navigate('/notifications');
              }}
              className="relative w-10 h-10 rounded-full bg-white dark:bg-surface-container flex items-center justify-center text-gray-700 dark:text-on-surface hover:bg-gray-100 dark:hover:bg-surface-container-high transition-colors active:scale-95 duration-200 shadow-sm dark:shadow-none"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {hasUnread && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-[1200px] mx-auto px-margin-mobile py-6">
        <Outlet />
      </div>

      {/* BottomNavBar — 5 items matching Stitch design */}
      <nav className="fixed bottom-0 w-full z-40 flex justify-around items-center px-4 py-3 pb-safe bg-white dark:bg-surface-container-low shadow-[0px_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0px_-10px_30px_rgba(0,0,0,0.4)] rounded-t-lg transition-colors duration-200 border-t border-gray-200 dark:border-transparent">
        {navItems.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 ${isActive
                  ? 'bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container border-b-4 border-purple-500 dark:border-focus-purple'
                  : 'text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-variant'
                }`}
            >
              <Icon size={24} />
              <span className="font-label-md text-label-md mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
