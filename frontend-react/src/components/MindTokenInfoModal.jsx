import { X, Sparkles, Star, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

const MindTokenInfoModal = ({ isOpen, onClose, tokenCount = 0 }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-surface-container rounded-3xl shadow-2xl p-6 z-10 border border-gray-100 dark:border-surface-raised"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
          <X size={20} />
        </button>
        
        <div className="text-center mb-6 mt-2">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-yellow-200 dark:border-yellow-500/30">
            <span className="text-3xl">🪙</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mind Tokens</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm font-medium">You have <span className="text-yellow-600 dark:text-yellow-400 font-bold">{tokenCount} tokens</span></p>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-xs">Earn tokens to climb the leaderboard and unlock exclusive badges!</p>
        </div>

        <div className="space-y-3">
          <div className="bg-gray-50 dark:bg-background-deep p-4 rounded-2xl flex gap-4 items-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Daily Login</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Open the app every day to claim your +5 tokens.</p>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-background-deep p-4 rounded-2xl flex gap-4 items-center">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
              <Star size={18} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Help Others</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Answer doubts in the forum or host tutoring sessions.</p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-background-deep p-4 rounded-2xl flex gap-4 items-center">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-focus-purple shrink-0">
              <Trophy size={18} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Earn Badges</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Every time you unlock a badge level, you get a +50 bonus!</p>
            </div>
          </div>
        </div>

        <button onClick={onClose} className="w-full mt-6 bg-[#DCFD8B] text-[#151f00] font-bold py-3 rounded-xl hover:bg-[#c5e675] transition-colors shadow-sm">
          Got it!
        </button>
      </motion.div>
    </div>
  );
};

export default MindTokenInfoModal;
