import { useState } from 'react';
import { Star, X } from 'lucide-react';

const RatingModal = ({ isOpen, onClose, onSubmit, sessionId }) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(sessionId, rating, comment);
      onClose();
    } catch (err) {
      console.error('Rating submission failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-container rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-surface-raised relative animate-[fadeIn_0.2s_ease-out]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-on-surface transition-colors">
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Rate this Session</h3>
          <p className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant mt-2">How was your learning experience?</p>
        </div>

        {/* 5-Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                size={36}
                className={`transition-colors ${
                  star <= (hoveredStar || rating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300 dark:text-surface-raised'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Leave a review (optional)..."
          className="w-full bg-gray-50 dark:bg-background-deep border border-gray-200 dark:border-outline-variant rounded-xl py-3 px-4 text-sm text-gray-900 dark:text-on-surface mb-6 h-24 resize-none focus:outline-none focus:border-focus-purple"
        />

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className={`w-full py-3.5 rounded-[20px] font-label-lg font-bold text-base transition-all ${
            rating > 0
              ? 'bg-focus-purple text-white hover:bg-[#6830d1] active:scale-95'
              : 'bg-gray-100 dark:bg-surface-raised text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting...' : 'Submit Rating'}
        </button>
      </div>
    </div>
  );
};

export default RatingModal;
