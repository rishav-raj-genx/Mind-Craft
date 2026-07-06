import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';

export const StarsBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
    {[...Array(50)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute bg-white rounded-full"
        style={{
          width: Math.random() * 2 + 1 + 'px',
          height: Math.random() * 2 + 1 + 'px',
          top: Math.random() * 100 + '%',
          left: Math.random() * 100 + '%',
          opacity: Math.random() * 0.8 + 0.2,
          boxShadow: '0 0 8px #fff'
        }}
        animate={{ opacity: [Math.random() * 0.8 + 0.2, 1, Math.random() * 0.8 + 0.2] }}
        transition={{ duration: Math.random() * 3 + 2, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 }}
      />
    ))}
  </div>
);

const ThemeToggle = () => {
  const { isDark, setIsDark } = useAppContext();
  
  return (
    <button
      type="button"
      onClick={() => setIsDark(!isDark)}
      className="absolute top-0 right-0 z-0 w-32 h-32 overflow-hidden rounded-bl-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCFD8B]"
      title="Toggle Theme"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait">
        {!isDark ? (
          <motion.div
            key="sun"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_20%,_#fef9c3_0%,_#fde047_40%,_#facc15_100%)] rounded-bl-full origin-top-right shadow-[-4px_4px_40px_rgba(250,204,21,0.4)] border-b border-l border-yellow-200/50 cursor-pointer"
          >
             <div className="absolute top-[20%] left-[30%] w-full h-full bg-white/40 blur-2xl rounded-full mix-blend-overlay" />
             <div className="absolute top-[40%] left-[10%] w-3 h-1 bg-white/60 rounded-full blur-[1px]" />
             <div className="absolute top-[60%] left-[30%] w-2 h-1 bg-white/60 rounded-full blur-[1px]" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="absolute top-0 right-0 w-full h-full bg-slate-800 rounded-bl-full origin-top-right overflow-hidden shadow-[-4px_4px_30px_rgba(0,0,0,0.5)] border-b border-l border-slate-700 cursor-pointer"
          >
             <div className="absolute top-6 right-6 w-16 h-16 bg-slate-900 rounded-full mix-blend-overlay opacity-50" />
             <div className="absolute top-16 right-3 w-8 h-8 bg-slate-900 rounded-full mix-blend-overlay opacity-40" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
};

export default ThemeToggle;
