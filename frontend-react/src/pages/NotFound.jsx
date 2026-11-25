import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-focus-purple mb-6 text-3xl font-bold">
        404
      </div>
      <h1 className="font-headline-lg text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Page Not Found
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm text-sm leading-relaxed">
        The page you are looking for does not exist, has been removed, or the link may be broken.
      </p>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-focus-purple text-white font-medium hover:bg-purple-700 transition-colors shadow-md"
        aria-label="Return to Home"
      >
        <Home size={18} />
        Back to Home
      </button>
    </div>
  );
};

export default NotFound;
