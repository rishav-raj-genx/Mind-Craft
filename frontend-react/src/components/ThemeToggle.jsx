import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';

// Deterministic 32-bit PRNG (Mulberry32) for React-19 purity
function createPrng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createPrng(0x9e3779b9);
const TOTAL_STARS = 100;

const STARS = Array.from({ length: TOTAL_STARS }, (_, i) => {
  const x = +(rng() * 100).toFixed(2);
  const y = +(rng() * 100).toFixed(2);
  const sizeRoll = rng();
  // Vary star sizes from 1px to 2.5px
  const size = sizeRoll < 0.5 ? 1 : sizeRoll < 0.8 ? 1.5 : sizeRoll < 0.94 ? 2 : 2.5;
  const baseOpacity = +(rng() * 0.45 + 0.25).toFixed(2); // 0.25 to 0.70
  const duration = +(rng() * 3 + 2.5).toFixed(2); // 2.5s to 5.5s
  const delay = +(rng() * 5).toFixed(2); // 0s to 5s
  const hasGlow = size >= 2;

  return {
    id: i,
    top: `${y}%`,
    left: `${x}%`,
    size,
    baseOpacity,
    duration,
    delay,
    hasGlow,
  };
});

export const StarsBackground = () => (
  <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none z-0" aria-hidden="true">
    {STARS.map((star) => (
      <div
        key={star.id}
        className="absolute rounded-full bg-white pointer-events-none"
        style={{
          width: `${star.size}px`,
          height: `${star.size}px`,
          top: star.top,
          left: star.left,
          '--star-base-opacity': star.baseOpacity,
          boxShadow: star.hasGlow ? '0 0 6px 1px rgba(255, 255, 255, 0.85)' : undefined,
          animation: `star-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
        }}
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
