import { Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

const MindcraftLogo = ({ size = 'md', showIcon = true, variant = 'default', className = '' }) => {
  const [isSplit, setIsSplit] = useState(false);

  // Auto split after 30 minutes
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplit(true);
    }, 1800000);
    return () => clearTimeout(timer);
  }, []);

  const sizeMap = {
    sm: 'text-xl',
    md: 'text-3xl font-headline-md',
    lg: 'text-4xl font-headline-lg',
    xl: 'text-5xl font-headline-xl',
  };

  const iconSizeMap = {
    sm: 24,
    md: 36,
    lg: 48,
    xl: 60,
  };

  const currentSize = iconSizeMap[size];

  return (
    <div 
      className={`flex items-center cursor-pointer select-none ${className}`}
      onClick={() => setIsSplit(!isSplit)}
      title="Click to split!"
    >
      <motion.div 
        className="flex items-center relative" 
        style={{ height: currentSize }}
        animate={{ rotateY: (!isSplit && showIcon) ? 360 : 0 }}
        transition={{ 
          rotateY: { 
            repeat: (!isSplit && showIcon) ? Infinity : 0, 
            duration: (!isSplit && showIcon) ? 4 : 0.5, 
            ease: (!isSplit && showIcon) ? "linear" : "easeOut",
            delay: (!isSplit && showIcon) ? 0.4 : 0
          } 
        }}
      >
        
        {/* Left Half of Brain */}
        {showIcon && (
          <div
            className="relative z-20 flex items-center h-full"
            style={{ clipPath: 'inset(0 50% 0 0)' }}
          >
            <Brain 
              size={currentSize} 
              className="text-[#7C3AED] dark:text-[#DCFD8B] transition-colors" 
              fill="currentColor" 
              stroke="currentColor"
              strokeWidth={1.5} 
            />
          </div>
        )}

        {/* Text that appears in the middle */}
        <motion.div
          initial={false}
          animate={{ maxWidth: (!showIcon || isSplit) ? 300 : 0, opacity: (!showIcon || isSplit) ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="flex items-center justify-center overflow-hidden z-10"
          style={{ whiteSpace: 'nowrap' }}
        >
          <div className={showIcon ? "px-1" : ""}>
            <h1 className={`font-bold tracking-tighter whitespace-nowrap ${sizeMap[size]}`}>
              <span className="logo-game-text">Mindcraft</span>
            </h1>
          </div>
        </motion.div>

        {/* Right Half of Brain */}
        {showIcon && (
          <motion.div
            initial={false}
            animate={{ 
              marginLeft: isSplit ? 0 : -currentSize 
            }}
            transition={{ 
              marginLeft: { type: "spring", stiffness: 300, damping: 25 }
            }}
            className="relative z-20 flex items-center h-full"
            style={{ clipPath: 'inset(0 0 0 50%)' }}
          >
            <Brain 
              size={currentSize} 
              className="text-[#7C3AED] dark:text-[#DCFD8B] transition-colors" 
              fill="currentColor" 
              stroke="currentColor"
              strokeWidth={1.5} 
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default MindcraftLogo;
