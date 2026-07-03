import { BrainCircuit } from 'lucide-react';

/**
 * Theme-aware Mindcraft logo.
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
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && (
        <div className="w-8 h-8 rounded-full bg-success-lime/20 dark:bg-success-lime/10 flex items-center justify-center">
          <BrainCircuit size={iconSizeMap[size]} className="text-green-700 dark:text-success-lime" />
        </div>
      )}
      <h1 className={`font-bold tracking-tighter ${sizeMap[size]}`}>
        {/* Light mode: gradient text */}
        <span className="dark:hidden logo-gradient-light">Mindcraft</span>
        {/* Dark mode: lime glow text */}
        <span className="hidden dark:inline logo-glow-dark">Mindcraft</span>
      </h1>
    </div>
  );
};

export default MindcraftLogo;
