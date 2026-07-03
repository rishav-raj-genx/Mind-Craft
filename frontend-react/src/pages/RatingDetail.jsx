import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { ArrowLeft, Star, MessageCircle } from 'lucide-react';

const RatingDetail = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      userService.getFullProfile(currentUser.uid)
        .then(res => {
          const data = res.data || {};
          const r = data.reviews || [];
          setReviews(r);
          setAvgRating(data.user?.averageRating || 0);
        })
        .catch(err => console.error('Fetch reviews error:', err))
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={20} className="text-gray-700 dark:text-white" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Ratings & Reviews</h1>
      </header>

      {/* Summary */}
      <section className="bg-white dark:bg-[#12122A] rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center text-center gap-3">
        <Star size={40} className="text-amber-400 fill-amber-400" />
        <span className="text-5xl font-black text-gray-900 dark:text-white tabular-nums">{avgRating.toFixed(1)}</span>
        <p className="text-sm text-gray-500 dark:text-gray-400">{reviews.length} review{reviews.length !== 1 ? 's' : ''} received as a tutor</p>
        <div className="flex items-center gap-0.5 mt-1">
          {[1,2,3,4,5].map(s => (
            <Star key={s} size={20} className={s <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'} />
          ))}
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-[#DCFD8B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageCircle size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
          <p className="font-semibold text-gray-600 dark:text-gray-400">No reviews yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Complete tutoring sessions to receive ratings!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-32">
          {reviews.map((r, idx) => (
            <div
              key={r.sessionId || idx}
              className="bg-white dark:bg-[#1C1C2E] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm"
              style={{ animationDelay: `${idx * 60}ms`, animation: 'slideUp 0.4s ease-out both' }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-[#7C3AED] dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-700">{r.skill}</span>
                <div className="flex items-center gap-0.5 text-amber-500">
                  {'★'.repeat(Math.round(r.rating))}{'☆'.repeat(5 - Math.round(r.rating))}
                  <span className="text-xs text-gray-500 ml-1">{r.rating}</span>
                </div>
              </div>
              {r.ratingComment && (
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-2 italic">"{r.ratingComment}"</p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {r.scheduledAt ? new Date(r.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RatingDetail;
