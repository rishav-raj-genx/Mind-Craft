import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { matchService } from '../services/matchService';
import { ArrowLeft, Users, Star, MessageSquare } from 'lucide-react';
import { getAvatarUrl } from '../utils/avatar';

const MatesDetail = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [mates, setMates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      matchService.getMatches(currentUser.uid)
        .then(res => {
          const list = res.data || res.matches || [];
          setMates(list);
        })
        .catch(err => console.error('Mates fetch error:', err))
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={20} className="text-gray-700 dark:text-white" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Study Mates</h1>
      </header>

      {/* Summary */}
      <section className="bg-white dark:bg-[#12122A] rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#7C3AED]/10 flex items-center justify-center">
          <Users size={28} className="text-[#7C3AED]" />
        </div>
        <div>
          <span className="text-3xl font-black text-gray-900 dark:text-white">{mates.length}</span>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total matched mates</p>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-[#DCFD8B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : mates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
          <p className="font-semibold text-gray-600 dark:text-gray-400">No mates yet</p>
          <p className="text-sm text-gray-400 mt-1">Use Find My Mate to discover study partners!</p>
          <button onClick={() => navigate('/find')} className="mt-4 px-6 py-2.5 rounded-full bg-[#DCFD8B] text-[#151f00] font-semibold text-sm shadow-[0_3px_0_#b3d266] active:translate-y-[2px] active:shadow-[0_1px_0_#b3d266] transition-all">
            Find Mates
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-32">
          {mates.map((mate, idx) => (
            <div
              key={mate.uid || idx}
              onClick={() => navigate(`/profile/${mate.uid}`)}
              className="bg-white dark:bg-[#1C1C2E] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
              style={{ animationDelay: `${idx * 60}ms`, animation: 'slideUp 0.4s ease-out both' }}
            >
              <img
                src={mate.photoUrl || getAvatarUrl(mate.name)}
                alt={mate.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-[#7C3AED]"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white truncate">{mate.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{mate.department || mate.college}</p>
                {mate.sharedSkills && mate.sharedSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {mate.sharedSkills.slice(0, 3).map(skill => (
                      <span key={skill} className="text-[10px] bg-[#DCFD8B]/20 dark:bg-[#DCFD8B]/10 text-green-800 dark:text-[#DCFD8B] px-2 py-0.5 rounded-full border border-[#DCFD8B]/30">{skill}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {mate.averageRating > 0 && (
                  <div className="flex items-center gap-1 text-amber-500 text-sm font-bold">
                    <Star size={14} className="fill-current" /> {mate.averageRating.toFixed(1)}
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/chat'); }}
                  className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <MessageSquare size={16} className="text-[#7C3AED]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MatesDetail;
