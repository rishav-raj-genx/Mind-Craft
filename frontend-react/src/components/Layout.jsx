import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Grid, Map, MessageSquare, User, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import MindcraftLogo from './MindcraftLogo';
import ThemeToggle from './ThemeToggle';

const Layout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { hasUnreadNotifications, clearUnreadNotifications, unreadChatCount } = useNotifications();

  const navItems = [
    { path: '/', icon: Grid, label: 'Home', match: (p) => p === '/' },
    { path: '/find', icon: Map, label: 'Map', match: (p) => p === '/find' },
    { path: '/forum', icon: MessageCircle, label: 'Forum', match: (p) => p === '/forum' },
    { path: '/chat', icon: MessageSquare, label: 'Chat', match: (p) => p.startsWith('/chat') },
    { path: `/profile/${currentUser?.uid}`, icon: User, label: 'Profile', match: (p) => p.startsWith('/profile') },
  ];

  const isProfilePage = pathname.startsWith('/profile');

  return (
    <div className="bg-gray-50 dark:bg-background-deep text-gray-900 dark:text-on-surface font-body-md min-h-screen pb-[100px] transition-colors duration-200">

      {/* TopAppBar */}
      <header className={`w-full top-0 sticky z-50 transition-colors duration-200 ${
        isProfilePage
          ? 'bg-white/95 dark:bg-black/95 border-transparent'
          : 'bg-gray-50/95 dark:bg-background-deep/95 border-b border-gray-200 dark:border-transparent'
      } backdrop-blur-md`}>
        {isProfilePage && <ThemeToggle />}
        <div className="flex items-center justify-between px-margin-mobile py-4 w-full min-h-[76px] relative z-10 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
            <MindcraftLogo size="md" showIcon={true} variant={isProfilePage ? 'profile' : 'default'} />
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => {
                clearUnreadNotifications();
                navigate('/notifications');
              }}
              className="relative w-10 h-10 rounded-full bg-white dark:bg-surface-container flex items-center justify-center text-gray-700 dark:text-on-surface hover:bg-gray-100 dark:hover:bg-surface-container-high transition-colors active:scale-95 duration-200 shadow-sm dark:shadow-none"
              aria-label="Notifications"
            >
              <Bell size={20} />
              {hasUnreadNotifications && (
                <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></div>
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
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-150 relative ${isActive
                  ? 'bg-purple-100 dark:bg-secondary-container text-purple-900 dark:text-on-secondary-container border-b-4 border-purple-500 dark:border-focus-purple'
                  : 'text-gray-500 dark:text-on-surface-variant hover:bg-gray-100 dark:hover:bg-surface-variant'
                }`}
            >
              <div className="relative">
                <Icon size={24} />
                {item.label === 'Chat' && unreadChatCount > 0 && (
                  <div className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-success-lime rounded-full shadow-[0_0_8px_rgba(220,253,139,0.8)] border border-white dark:border-surface-container-low animate-pulse"></div>
                )}
              </div>
              <span className="font-label-md text-label-md mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
