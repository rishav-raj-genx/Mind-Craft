import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';

const STARS = Array.from({ length: 50 }, (_, i) => {
  const seed1 = ((i * 9301 + 49297) % 233280) / 233280;
  const seed2 = (((i + 1) * 9301 + 49297) % 233280) / 233280;
  const seed3 = (((i + 2) * 9301 + 49297) % 233280) / 233280;
  const seed4 = (((i + 3) * 9301 + 49297) % 233280) / 233280;
  return {
    id: i,
    width: `${seed1 * 2 + 1}px`,
    height: `${seed1 * 2 + 1}px`,
    top: `${seed2 * 100}%`,
    left: `${seed3 * 100}%`,
    opacity: seed4 * 0.8 + 0.2,
    duration: seed1 * 3 + 2,
    delay: seed2 * 2,
  };
});

export const StarsBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
    {STARS.map((star) => (
      <motion.div
        key={star.id}
        className="absolute bg-white rounded-full"
        style={{
          width: star.width,
          height: star.height,
          top: star.top,
          left: star.left,
          opacity: star.opacity,
          boxShadow: '0 0 8px #fff',
        }}
        animate={{ opacity: [star.opacity, 1, star.opacity] }}
        transition={{ duration: star.duration, repeat: Infinity, ease: 'easeInOut', delay: star.delay }}
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
