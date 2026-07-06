import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Sparkles, BookOpen, Users, Trophy, ChevronLeft } from 'lucide-react';
import MindcraftLogo from './MindcraftLogo';

const slides = [
  {
    id: 0,
    title: "Welcome to Mind Craft",
    description: "Master skills. Find your tribe. Elevate your mind.",
    icon: Sparkles,
    color: "from-green-400 to-green-600 dark:from-success-lime dark:to-green-700",
    shadow: "shadow-green-500/30"
  },
  {
    id: 1,
    title: "Find Study Mates",
    description: "Connect with peers who share your passions and complement your skills.",
    icon: Users,
    color: "from-blue-400 to-blue-600 dark:from-blue-300 dark:to-blue-700",
    shadow: "shadow-blue-500/30"
  },
  {
    id: 2,
    title: "Teach & Learn",
    description: "Exchange knowledge through 1-on-1 sessions and community doubt forums.",
    icon: BookOpen,
    color: "from-purple-400 to-purple-600 dark:from-secondary dark:to-focus-purple",
    shadow: "shadow-purple-500/30"
  },
  {
    id: 3,
    title: "Gamify Your Growth",
    description: "Earn badges, maintain streaks, and climb to the top of the leaderboard.",
    icon: Trophy,
    color: "from-orange-400 to-orange-600 dark:from-orange-300 dark:to-orange-700",
    shadow: "shadow-orange-500/30"
  }
];

const Onboarding = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-gray-50 dark:bg-background-deep flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-20 flex items-center justify-center">
        <motion.div 
          key={`bg-${currentIndex}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, rotate: currentIndex * 45 }}
          transition={{ duration: 1 }}
          className={`w-[120vw] h-[120vw] max-w-[800px] max-h-[800px] rounded-full blur-[120px] bg-gradient-to-tr ${slides[currentIndex].color}`}
        />
      </div>

      <div className="flex-1 w-full max-w-md flex flex-col justify-center relative z-10 perspective-[1000px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, rotateY: 90, scale: 0.8 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, rotateY: -90, scale: 0.8 }}
            transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
            className="bg-white/80 dark:bg-surface-container/80 backdrop-blur-xl rounded-[40px] p-8 shadow-2xl border border-white/40 dark:border-surface-raised flex flex-col items-center text-center transform-style-3d"
          >
            {/* 3D Floating Icon Container */}
            <motion.div 
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className={`w-32 h-32 rounded-full mb-8 flex items-center justify-center bg-gradient-to-br ${slides[currentIndex].color} shadow-lg ${slides[currentIndex].shadow}`}
            >
              {currentIndex === 0 ? (
                <MindcraftLogo className="w-16 h-16 text-white" />
              ) : (
                <div className="text-white">
                  {(() => {
                    const Icon = slides[currentIndex].icon;
                    return <Icon size={64} strokeWidth={1.5} />;
                  })()}
                </div>
              )}
            </motion.div>

            <h2 className="text-3xl font-black font-headline-lg text-gray-900 dark:text-white mb-4">
              {slides[currentIndex].title}
            </h2>
            <p className="text-gray-600 dark:text-on-surface-variant font-body-lg text-lg leading-relaxed">
              {slides[currentIndex].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="w-full max-w-md relative z-10 flex flex-col items-center gap-8 pb-8">
        {/* Indicators */}
        <div className="flex gap-3">
          {slides.map((_, idx) => (
            <motion.div
              key={idx}
              className={`h-2.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-green-500 dark:bg-success-lime' : 'w-2.5 bg-gray-300 dark:bg-surface-raised'}`}
              initial={false}
              animate={{ width: idx === currentIndex ? 32 : 10 }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex w-full justify-between items-center px-4">
          <button
            onClick={prevSlide}
            className={`p-4 rounded-full transition-all ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-gray-200 dark:hover:bg-surface-raised text-gray-600 dark:text-on-surface-variant'}`}
          >
            <ChevronLeft size={28} />
          </button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={nextSlide}
            className={`py-4 px-8 rounded-full font-label-lg text-lg font-bold flex items-center gap-2 shadow-xl transition-all ${
              currentIndex === slides.length - 1
                ? 'bg-gradient-to-r from-green-500 to-green-700 dark:from-success-lime dark:to-green-600 text-white dark:text-green-950 hover:shadow-green-500/30'
                : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
            }`}
          >
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
            {currentIndex !== slides.length - 1 && <ChevronRight size={24} />}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
