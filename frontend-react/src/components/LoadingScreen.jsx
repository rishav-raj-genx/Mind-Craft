import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import MindcraftLogo from './MindcraftLogo';

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-gray-50 dark:bg-background-deep overflow-hidden">
      {/* Subtle Dot Pattern Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.06] dark:opacity-[0.02]"
        style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      ></div>

      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        {/* Animated Icon & Logo Wrapper */}
        <div className="relative flex flex-col items-center justify-center h-32">
          {/* Subtle expanding rings instead of giant blobs */}
          <motion.div
            animate={{ scale: [1, 1.5], opacity: [0.1, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
            className="absolute w-24 h-24 bg-success-lime/20 rounded-full"
          />
          <motion.div
            animate={{ scale: [1, 2], opacity: [0.05, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            className="absolute w-24 h-24 bg-success-lime/10 rounded-full"
          />
          
          <motion.div
             animate={{ y: [0, -6, 0] }}
             transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
             className="relative z-10 bg-white dark:bg-surface-container shadow-lg border border-slate-200 dark:border-surface-raised p-5 rounded-3xl"
          >
             <MindcraftLogo showIcon={false} className="w-12 h-12" />
          </motion.div>
        </div>
        
        {/* Typography & Status */}
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <h1 className="text-3xl md:text-4xl font-bold font-headline-lg text-gray-900 dark:text-on-surface">
            Mind Craft
          </h1>
          
          <div className="flex items-center gap-2 text-slate-600 dark:text-on-surface-variant font-semibold">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <BookOpen size={18} className="text-success-lime" />
            </motion.div>
            <p className="tracking-wide text-sm">
              Preparing your study space
            </p>
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="text-success-lime font-bold"
            >
              ...
            </motion.span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
