import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';
import MindcraftLogo from './MindcraftLogo';
import { INTRO_SLIDES } from '../constants/introSlides';

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 40 : -40, opacity: 0, scale: 0.98 }),
  center: { x: 0, opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 30 } },
  exit: (direction) => ({ x: direction < 0 ? 40 : -40, opacity: 0, scale: 0.98, transition: { duration: 0.15 } })
};

const Onboarding = ({ isOpen = true, onComplete, onClose }) => {
  const [[currentIndex, direction], setSlideState] = useState([0, 1]);

  const handleFinish = useCallback(() => {
    if (onComplete) onComplete();
    else if (onClose) onClose();
  }, [onComplete, onClose]);

  const nextSlide = useCallback(() => {
    if (currentIndex < INTRO_SLIDES.length - 1) {
      setSlideState([currentIndex + 1, 1]);
    } else {
      handleFinish();
    }
  }, [currentIndex, handleFinish]);

  const prevSlide = useCallback(() => {
    if (currentIndex > 0) {
      setSlideState([currentIndex - 1, -1]);
    }
  }, [currentIndex]);

  const goToSlide = useCallback((idx) => {
    setSlideState(([prev]) => [idx, idx >= prev ? 1 : -1]);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape') handleFinish();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, nextSlide, prevSlide, handleFinish]);

  if (!isOpen) return null;

  const currentSlide = INTRO_SLIDES[currentIndex];
  const IconComponent = currentSlide.icon;
  const isFinalSlide = currentIndex === INTRO_SLIDES.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mindcraft Platform Tour"
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none animate-in fade-in duration-200"
    >
      {/* Background ambient glow matching current slide */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <motion.div
          key={`glow-${currentIndex}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.18, scale: 1 }}
          transition={{ duration: 0.35 }}
          className={`w-[90vw] h-[90vw] max-w-[650px] max-h-[650px] rounded-full blur-[140px] bg-gradient-to-tr ${currentSlide.gradient}`}
        />
      </div>

      {/* Main Modal Card */}
      <div className="relative z-10 w-full max-w-lg bg-[#12121E] border border-white/10 rounded-[32px] sm:rounded-[36px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <MindcraftLogo size="sm" showIcon={true} variant="default" />
            <span
              data-testid="intro-step-counter"
              className="ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-gray-300 border border-white/10"
            >
              {currentSlide.step}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleFinish}
              className="text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-white/5"
            >
              Skip
            </button>
            <button
              onClick={handleFinish}
              aria-label="Close walkthrough"
              className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Slide Content Area */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center min-h-[360px] justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col items-center w-full"
            >
              {/* Floating Animated Icon Badge */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl mb-5 flex items-center justify-center bg-gradient-to-br ${currentSlide.gradient} ${currentSlide.shadowColor} shadow-xl border border-white/20`}
              >
                <IconComponent size={42} className="text-gray-950 stroke-[2]" />
              </motion.div>

              <h2 className="text-2xl sm:text-3xl font-black font-headline-lg text-white mb-1.5 tracking-tight">
                {currentSlide.title}
              </h2>

              <p className="text-xs sm:text-sm font-semibold text-[#DCFD8B] tracking-wide mb-3">
                {currentSlide.subtitle}
              </p>

              <p className="text-gray-300 font-body-md text-sm sm:text-base leading-relaxed max-w-md">
                {currentSlide.description}
              </p>

              {/* Highlight chips */}
              <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-5 max-w-md">
                {currentSlide.highlights.map((h, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-lg border backdrop-blur-sm ${currentSlide.tagColor}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                    {h}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-t border-white/5 bg-[#0D0D17]">
          {/* Back button */}
          <button
            onClick={prevSlide}
            disabled={currentIndex === 0}
            className={`flex items-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all ${
              currentIndex === 0
                ? 'opacity-0 pointer-events-none'
                : 'text-gray-400 hover:text-white hover:bg-white/5 active:scale-95 cursor-pointer'
            }`}
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>

          {/* Indicator Dots */}
          <div className="flex items-center gap-2" data-testid="intro-progress-dots">
            {INTRO_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? 'w-6 bg-[#DCFD8B] shadow-[0_0_10px_rgba(220,253,139,0.5)]'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* Next / Get Started button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={nextSlide}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg transition-all cursor-pointer ${
              isFinalSlide
                ? 'bg-[#DCFD8B] text-[#151f00] hover:bg-[#c9ef74] shadow-[0_0_20px_rgba(220,253,139,0.4)]'
                : 'bg-white text-gray-950 hover:bg-gray-100'
            }`}
          >
            <span>{isFinalSlide ? 'Get Started' : 'Next'}</span>
            {isFinalSlide ? <Sparkles size={14} /> : <ChevronRight size={14} />}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
