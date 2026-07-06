import { BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Theme-aware Mindcraft logo with funky animations.
 * - Dark mode: lime green glowing text
 * - Light mode: rich purple-green gradient text
 * 
 * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} showIcon - whether to show the brain icon
 */
const MindcraftLogo = ({ size = 'md', showIcon = false, className = '' }) => {
  const sizeMap = {
    sm: 'text-lg',
    md: 'text-headline-md font-headline-md',
    lg: 'text-headline-lg font-headline-lg',
    xl: 'text-headline-xl font-headline-xl',
  };

  const iconSizeMap = {
    sm: 16,
    md: 22,
    lg: 28,
    xl: 36,
  };

  return (
    <motion.div 
      className={`flex items-center gap-2 cursor-pointer select-none ${className}`}
      whileHover={{ scale: 1.05, rotate: [-1, 2, -2, 0] }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {showIcon && (
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 rounded-full bg-success-lime/20 dark:bg-success-lime/10 flex items-center justify-center"
        >
          <BrainCircuit size={iconSizeMap[size]} className="text-green-700 dark:text-success-lime" />
        </motion.div>
      )}
      <motion.h1 
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className={`font-bold tracking-tighter ${sizeMap[size]}`}
      >
        {/* Light mode: gradient text */}
        <span className="dark:hidden logo-gradient-light">Mindcraft</span>
        {/* Dark mode: lime glow text */}
        <span className="hidden dark:inline logo-glow-dark">Mindcraft</span>
      </motion.h1>
    </motion.div>
  );
};

export default MindcraftLogo;
