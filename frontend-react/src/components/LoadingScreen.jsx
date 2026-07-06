import { motion } from 'framer-motion';
import MindcraftLogo from './MindcraftLogo';

const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white dark:bg-background-deep overflow-hidden">
      {/* Background blobs for theme */}
      <div className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-30 flex items-center justify-center">
         <motion.div 
           animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
           transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
           className="w-[30vw] h-[30vw] min-w-[300px] min-h-[300px] bg-success-lime rounded-full blur-[100px] absolute mix-blend-multiply dark:mix-blend-screen"
         />
         <motion.div 
           animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0], x: [0, 50, 0] }}
           transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
           className="w-[25vw] h-[25vw] min-w-[250px] min-h-[250px] bg-focus-purple rounded-full blur-[80px] absolute ml-[100px] mt-[150px] mix-blend-multiply dark:mix-blend-screen"
         />
      </div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        <div className="w-24 h-24 relative flex items-center justify-center">
          <motion.div
             animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
             transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
             className="relative z-10"
          >
             <MindcraftLogo />
          </motion.div>
          {/* Pulsing ring behind logo */}
          <motion.div
            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 border-2 border-success-lime rounded-full"
          />
          <motion.div
            animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            className="absolute inset-0 border-2 border-focus-purple rounded-full"
          />
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-black font-headline-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-green-700 via-green-600 to-focus-purple dark:from-success-lime dark:via-green-400 dark:to-secondary">
            Mind Craft
          </h1>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-2 mt-2"
          >
            <div className="w-2.5 h-2.5 bg-green-500 dark:bg-success-lime rounded-full animate-bounce shadow-[0_0_8px_rgba(220,253,139,0.8)]"></div>
            <div className="w-2.5 h-2.5 bg-green-500 dark:bg-success-lime rounded-full animate-bounce shadow-[0_0_8px_rgba(220,253,139,0.8)]" style={{animationDelay: '0.15s'}}></div>
            <div className="w-2.5 h-2.5 bg-green-500 dark:bg-success-lime rounded-full animate-bounce shadow-[0_0_8px_rgba(220,253,139,0.8)]" style={{animationDelay: '0.3s'}}></div>
          </motion.div>
          <p className="text-gray-500 dark:text-on-surface-variant font-label-lg mt-1 tracking-widest uppercase text-xs font-semibold">
            Crafting your experience
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
