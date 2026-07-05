import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { gamificationService } from '../services/gamificationService';
import { matchService } from '../services/matchService';
import { doubtService } from '../services/doubtService';
import { userService } from '../services/userService';
import { Link, useNavigate } from 'react-router-dom';
import { Flame, Trophy, Star, Hash, ChevronRight, Plus, TrendingUp } from 'lucide-react';
import { motion, animate, useMotionValue, useTransform } from 'framer-motion';

const normalizeTopic = (topic) => String(topic || '').trim().toLowerCase();

const findTopicOverlap = (left = [], right = []) => {
  const rightMap = new Map(right.map(topic => [normalizeTopic(topic), topic]).filter(([key]) => key));
  return left
    .map(topic => rightMap.get(normalizeTopic(topic)))
    .filter(Boolean);
};

const scoreRecommendedMates = (currentProfile, candidates = []) => {
  const currentLearns = currentProfile?.learns || [];
  const currentTeaches = currentProfile?.teaches || [];
  const currentCollege = normalizeTopic(currentProfile?.college);

  return candidates
    .filter(mate => mate?.uid && mate.uid !== currentProfile?.uid)
    .map((mate) => {
      const teachesMe = findTopicOverlap(currentLearns, mate.teaches || []);
      const learnsFromMe = findTopicOverlap(currentTeaches, mate.learns || []);
      const sharedSkills = [...new Set([...teachesMe, ...learnsFromMe])];
      const sameCollege = currentCollege && normalizeTopic(mate.college) === currentCollege;
      const rating = Number(mate.averageRating || 0);
      const sessions = Number(mate.totalSessions || 0);
      const score =
        teachesMe.length * 5 +
        learnsFromMe.length * 3 +
        (sameCollege ? 1.5 : 0) +
        Math.min(rating, 5) * 0.35 +
        Math.min(sessions, 20) * 0.05;

      return {
        ...mate,
        sharedSkills,
        teachesMe,
        learnsFromMe,
        matchScore: score,
      };
    })
    .filter(mate => mate.sharedSkills.length > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);
};

// ─── CountUp Component ────────────────────────────────────────────────────────
const CountUp = ({ to, duration = 1.5 }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const animation = animate(count, to, { duration, ease: "easeOut" });
    return animation.stop;
  }, [to, duration, count]);

  return <motion.span>{rounded}</motion.span>;
};

const Home = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [badgeCount, setBadgeCount] = useState(0);
  const [streak, setStreak] = useState({ currentStreak: 0 });
  const [topMates, setTopMates] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [followedUsers, setFollowedUsers] = useState([]);
  const [profileName, setProfileName] = useState('');
  
  useEffect(() => {
    if (currentUser) {
      const loadData = async () => {
        let currentProfile = null;

        try {
          const profileRes = await userService.getProfile(currentUser.uid);
          currentProfile = profileRes?.data || null;
          if (currentProfile?.name) setProfileName(currentProfile.name);
        } catch { /* silent */ }

        const loadStreak = async () => {
          try { 
            const checkInRes = await gamificationService.checkIn();
            const streakData = checkInRes.data || checkInRes || { currentStreak: 0 };
            setStreak(streakData);
          } catch (err) {
            console.error("Streak check-in failed:", err);
            try {
              const s = await gamificationService.getStreak(currentUser.uid);
              setStreak(s.data || s || { currentStreak: 0 });
            } catch { /* silent */ }
          }
        };

        const loadBadges = async () => {
          try {
            const badgeRes = await gamificationService.getBadges(currentUser.uid);
            setBadgeCount(badgeRes.data?.totalEarned || 0);
          } catch { /* silent */ }
        };

        const loadMatches = async () => {
          if (currentProfile) {
            try {
              const usersRes = await userService.searchUsers('');
              const recommended = scoreRecommendedMates(currentProfile, usersRes.data || []);
              if (recommended.length > 0) {
                setTopMates(recommended);
                return;
              }
            } catch (err) {
              console.error("Recommended mates scoring failed:", err);
            }
          }

          try {
            let m = await matchService.getMatches(currentUser.uid);
            let matchList = m.data || m.matches || [];
            if (matchList.length === 0) {
              m = await matchService.getBroadMatches(currentUser.uid);
              matchList = m.data || m.matches || [];
            }
            const flattened = matchList.map(item => ({
              ...item.tutor,
              sharedSkills: item.sharedSkills,
              activityScore: item.activityScore
            }));
            if (flattened.length > 0) {
              setTopMates(flattened.slice(0, 3));
              return;
            }
          } catch (err) {
            console.error("Match fetching failed:", err);
          }
        };

        const loadTrending = async () => {
          try {
            const trendRes = await doubtService.getTrending();
            setTrendingTopics(trendRes.data || []);
          } catch { /* silent */ }
        };

        const loadFollowing = async () => {
          try {
            const followingRes = await userService.getFollowing(currentUser.uid);
            setFollowedUsers(followingRes.data || []);
          } catch { /* silent */ }
        };

        await Promise.all([
          loadStreak(),
          loadBadges(),
          loadMatches(),
          loadTrending(),
          loadFollowing(),
        ]);
      };
      loadData();
    }
  }, [currentUser]);

  // Color palette for trending topic pills
  const tagColors = [
    'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
    'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800',
    'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome & Stats Banner */}
      <section className="bg-white dark:bg-surface-container rounded-xl p-6 relative overflow-hidden shadow-lg dark:shadow-[0px_10px_30px_rgba(0,0,0,0.4)] border border-gray-200 dark:border-surface-raised transition-colors duration-200">
        <div className="relative z-10 flex flex-col gap-4">
          <div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-gray-900 dark:text-on-surface">Welcome Back, {(profileName || currentUser?.displayName || 'User').split(' ')[0]}!</h2>
            <p className="font-body-md text-body-md text-gray-600 dark:text-on-surface-variant mt-1">Ready to crush some concepts today?</p>
          </div>
          <div className="flex flex-wrap gap-4 mt-2">
            {/* Streak Pill — tappable, links to streak detail */}
            <button
              onClick={() => navigate('/streak')}
              className="flex items-center gap-2 bg-gray-50 dark:bg-surface-raised rounded-full py-2 px-4 shadow-sm border border-gray-200 dark:border-[#262626] hover:bg-gray-100 dark:hover:bg-surface-container-high transition-colors active:scale-95"
            >
              <motion.div
                animate={streak.currentStreak > 0 ? { y: [0, -3, 0] } : {}}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 1 }}
              >
                <Flame className="text-orange-500" size={20} />
              </motion.div>
              <span className="font-label-lg text-label-lg text-gray-900 dark:text-on-surface">
                <CountUp to={streak.currentStreak} /> Day Streak
              </span>
              <ChevronRight size={14} className="text-gray-400" />
            </button>
            {/* Badges Pill — tappable, links to badges page */}
            <button
              onClick={() => navigate('/badges')}
              className="flex items-center gap-2 bg-purple-50 dark:bg-secondary-container/20 rounded-full py-2 px-4 shadow-sm border border-purple-200 dark:border-secondary-container hover:bg-purple-100 dark:hover:bg-secondary-container/30 transition-colors active:scale-95"
            >
              <Trophy className="text-purple-600" size={20} />
              <span className="font-label-lg text-label-lg text-purple-700 dark:text-secondary">{badgeCount} Badges</span>
              <ChevronRight size={14} className="text-purple-400" />
            </button>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-success-lime/20 dark:bg-success-lime/5 rounded-full blur-2xl pointer-events-none"></div>
      </section>

      {/* Top Rated Mates */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Top Recommended Mates</h3>
          <Link to="/find" className="font-label-md text-label-md text-green-700 dark:text-success-lime hover:underline">View All</Link>
        </div>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-margin-mobile px-margin-mobile snap-x">
          {topMates.map((mate, i) => (
            <div 
              key={i} 
              className="min-w-[200px] bg-white dark:bg-surface-container rounded-xl p-4 flex flex-col items-center gap-3 snap-center border border-gray-200 dark:border-surface-raised shadow-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-container-high transition-colors active:scale-[0.98]"
              onClick={() => navigate(`/profile/${mate.uid}`)}
            >
              <img alt="Mate Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-focus-purple" src={mate.photoUrl || "https://ui-avatars.com/api/?name="+mate.name} />
              <div className="text-center">
                <h4 className="font-body-lg text-body-lg text-gray-900 dark:text-on-surface font-semibold">{mate.name}</h4>
                <p className="font-label-md text-label-md text-gray-600 dark:text-on-surface-variant truncate w-32">{mate.sharedSkills?.slice(0, 2).join(', ') || mate.department}</p>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-surface-raised rounded-full py-1 px-3">
                <Star className="text-orange-500 fill-orange-500" size={14} />
                <span className="font-label-md text-label-md text-gray-900 dark:text-on-surface">{mate.averageRating || "New"}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-surface-raised rounded-full h-2 mt-1 relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-success-lime rounded-full" style={{ width: `${Math.min(100, Math.max(35, (mate.matchScore || mate.activityScore || 4) * 12))}%` }}></div>
              </div>
            </div>
          ))}
          {topMates.length === 0 && (
            <div className="text-gray-500 dark:text-on-surface-variant italic">No matches found yet. Try adding more skills to your profile!</div>
          )}
        </div>
      </section>

      {/* Trending Syllabus Topics — Dynamic */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-green-600 dark:text-success-lime" />
          <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Trending Topics</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {trendingTopics.length > 0 ? trendingTopics.map((topic, i) => (
            <button
              key={topic.tag}
              onClick={() => navigate(`/forum?tag=${encodeURIComponent(topic.tag)}`)}
              className={`border rounded-full py-3 px-4 flex items-center justify-center gap-2 transition-colors tactile-press shadow-[0px_4px_0px_#e5e7eb] dark:shadow-[0px_4px_0px_#262626] ${tagColors[i % tagColors.length]}`}
            >
              <Hash size={16} />
              <span className="font-label-lg text-label-lg truncate">{topic.tag.replace('#', '')}</span>
              <span className="text-xs opacity-60">({topic.count})</span>
            </button>
          )) : (
            <div className="col-span-2 text-gray-500 dark:text-on-surface-variant italic text-sm">No trending topics yet. Be the first to post a doubt!</div>
          )}
        </div>
      </section>

      {/* Post a Doubt CTA */}
      <section className="mb-6">
        <button
          onClick={() => navigate('/forum')}
          className="w-full bg-focus-purple/10 dark:bg-secondary-container/20 hover:bg-focus-purple/20 dark:hover:bg-secondary-container/30 text-purple-700 dark:text-focus-purple font-label-lg text-label-lg rounded-2xl py-4 px-6 flex items-center justify-center gap-2 border border-purple-200 dark:border-secondary-container/40 transition-all active:scale-[0.98]"
        >
          <Plus size={20} />
          Post a Doubt
        </button>
      </section>

      {/* Followed Users */}
      {followedUsers.length > 0 && (
        <section className="mb-6">
          <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface mb-3">Following</h3>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
            {followedUsers.map(user => (
              <div 
                key={user.uid} 
                className="flex flex-col items-center gap-1 min-w-[72px] cursor-pointer"
                onClick={() => navigate(`/profile/${user.uid}`)}
              >
                <img 
                  src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`} 
                  alt={user.name} 
                  className="w-16 h-16 rounded-full border-2 border-purple-200 dark:border-secondary object-cover"
                />
                <span className="text-xs font-semibold text-gray-700 dark:text-on-surface-variant text-center truncate w-full px-1">{user.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

export default Home;
