import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { gamificationService } from '../services/gamificationService';
import { Edit2, School, UserPlus, MessageSquare, BookOpen, GraduationCap, Flame, Users, Star, Clock, BarChart2, Medal, Coins, TrendingUp } from 'lucide-react';

const Profile = () => {
  const { uid } = useParams();
  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [streakData, setStreakData] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userService.getFullProfile(uid);
        setProfileData(data.data);
        
        // The full profile endpoint returns streak and tokenBalance
        if (data.data?.streak) {
          setStreakData(data.data.streak);
        }
        if (data.data?.tokenBalance !== undefined) {
          setTokenBalance(data.data.tokenBalance);
        }
      } catch (err) {
        console.error("Error fetching profile", err);
      }
    };

    // Also fetch tokens and streak directly for robustness
    const fetchGamification = async () => {
      try {
        const [tokensRes, streakRes] = await Promise.all([
          gamificationService.getTokens(uid),
          gamificationService.getStreak(uid),
        ]);
        if (tokensRes?.data?.balance !== undefined) {
          setTokenBalance(tokensRes.data.balance);
        }
        if (streakRes?.data) {
          setStreakData(streakRes.data);
        }
      } catch (err) {
        console.error("Error fetching gamification data", err);
      }
    };

    fetchProfile();
    fetchGamification();
  }, [uid]);

  if (!profileData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-success-lime border-t-transparent rounded-full animate-spin"></div>
        <span className="text-gray-500 dark:text-on-surface-variant font-body-md">Loading profile...</span>
      </div>
    );
  }

  const { user, skillGraph } = profileData;
  const streak = streakData || profileData.streak || { currentStreak: 0, longestStreak: 0, activeDates: [], grid: [] };

  // Build 7x5 consistency grid from activeDates
  const buildConsistencyGrid = () => {
    const activeDates = streak.activeDates || [];
    const activeDateSet = new Set(activeDates.map(d => {
      // Normalize to YYYY-MM-DD string
      if (typeof d === 'string') return d.split('T')[0];
      return new Date(d).toISOString().split('T')[0];
    }));

    // Generate last 35 days
    const cells = [];
    const today = new Date();
    for (let i = 34; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const isActive = activeDateSet.has(dateStr);
      
      cells.push({
        date: dateStr,
        isActive,
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      });
    }
    return cells;
  };

  const gridCells = buildConsistencyGrid();

  return (
    <div className="flex flex-col gap-6">
      {/* Profile Header Area */}
      <section className="flex flex-col items-center justify-center text-center gap-4 bg-white dark:bg-surface-container-low rounded-[24px] p-8 shadow-[0px_10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0px_10px_30px_rgba(0,0,0,0.2)] transition-colors duration-300">
        <div className="relative group cursor-pointer active:scale-95 transition-transform duration-200">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-success-lime shadow-[0_4px_20px_rgba(220,253,139,0.3)]">
            <img className="w-full h-full object-cover" src={user.photoUrl || `https://ui-avatars.com/api/?name=${user.name}&background=DCFD8B&color=151f00`} alt={user.name} />
          </div>
          {currentUser?.uid === uid && (
            <div className="absolute bottom-0 right-0 bg-secondary-container text-on-secondary-container w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-surface-container-low">
              <Edit2 size={16} />
            </div>
          )}
        </div>
        
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-gray-900 dark:text-primary">{user.name}</h1>
          <p className="font-body-lg text-body-lg text-focus-purple mt-1">{user.department} Major</p>
          <div className="flex items-center justify-center gap-2 mt-3 text-gray-500 dark:text-on-surface-variant">
            <School size={18} />
            <span className="font-body-sm text-body-sm">Year {user.year} • {user.college}</span>
          </div>
        </div>

        {/* Token Balance Badge */}
        <div className="flex items-center gap-2 bg-purple-50 dark:bg-secondary-container/20 rounded-full py-2 px-5 border border-purple-200 dark:border-secondary-container">
          <Coins className="text-purple-600 dark:text-secondary" size={18} />
          <span className="font-label-lg text-label-lg text-purple-700 dark:text-secondary">{tokenBalance} Mind Tokens</span>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 w-full justify-center">
          <button className="bg-success-lime text-on-primary-fixed py-3 px-6 rounded-full font-label-lg text-label-lg shadow-[0_4px_0_#b3d266] active:translate-y-[2px] active:shadow-[0_2px_0_#b3d266] transition-all flex items-center gap-2">
            <UserPlus size={18} /> Connect
          </button>
          <button className="bg-gray-100 dark:bg-surface-raised text-gray-900 dark:text-primary py-3 px-6 rounded-full font-label-lg text-label-lg border border-gray-300 dark:border-outline-variant shadow-[0_4px_0_#e5e7eb] dark:shadow-[0_4px_0_#1c1b1b] active:translate-y-[2px] transition-all">
            Message
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mt-2 w-full justify-center">
          <button className="bg-secondary-container text-on-secondary-container py-2 px-5 rounded-full font-label-md text-label-md shadow-[0_3px_0_#490b78] active:translate-y-[2px] transition-all flex items-center gap-1">
            <GraduationCap size={16} /> Topics I Teach: {skillGraph?.teaches?.join(', ') || 'None'}
          </button>
          <button className="bg-focus-purple/20 text-secondary-container dark:text-focus-purple py-2 px-5 rounded-full font-label-md text-label-md shadow-[0_3px_0_#632d93] active:translate-y-[2px] transition-all flex items-center gap-1 border border-focus-purple/30">
            <BookOpen size={16} /> Topics I Learn: {skillGraph?.learns?.join(', ') || 'None'}
          </button>
        </div>
      </section>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0px_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0px_4px_15px_rgba(0,0,0,0.1)] transition-colors duration-300">
          <Flame className="text-success-lime" size={28} />
          <span className="font-headline-md text-headline-md text-gray-900 dark:text-primary">{streak.currentStreak}</span>
          <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant uppercase tracking-wider">Day Streak</span>
        </div>
        <div className="bg-white dark:bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0px_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0px_4px_15px_rgba(0,0,0,0.1)] transition-colors duration-300">
          <Users className="text-focus-purple" size={28} />
          <span className="font-headline-md text-headline-md text-gray-900 dark:text-primary">{user.totalSessions || 0}</span>
          <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant uppercase tracking-wider">Sessions</span>
        </div>
        <div className="bg-white dark:bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0px_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0px_4px_15px_rgba(0,0,0,0.1)] transition-colors duration-300">
          <Star className="text-warm-peach" size={28} />
          <span className="font-headline-md text-headline-md text-gray-900 dark:text-primary">{(user.averageRating || 0).toFixed(1)}</span>
          <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant uppercase tracking-wider">Rating</span>
        </div>
        <div className="bg-white dark:bg-surface-container-low rounded-xl p-4 flex flex-col items-center justify-center gap-1 shadow-[0px_4px_15px_rgba(0,0,0,0.05)] dark:shadow-[0px_4px_15px_rgba(0,0,0,0.1)] transition-colors duration-300">
          <TrendingUp className="text-secondary" size={28} />
          <span className="font-headline-md text-headline-md text-gray-900 dark:text-primary">{streak.longestStreak || 0}</span>
          <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant uppercase tracking-wider">Best Streak</span>
        </div>
      </div>

      {/* Consistency Graph */}
      <section className="bg-white dark:bg-surface-container-low rounded-[24px] p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0px_10px_30px_rgba(0,0,0,0.2)] transition-colors duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-headline-md text-headline-md text-gray-900 dark:text-primary flex items-center gap-2">
            <BarChart2 className="text-success-lime" size={24} />
            Consistency Graph
          </h2>
          <div className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant">Last 35 days</div>
        </div>
        <div className="overflow-x-auto pb-2">
          <div className="min-w-max">
            <div className="grid grid-rows-5 grid-flow-col gap-2 w-max">
              {gridCells.map((cell, i) => (
                <div 
                  key={i} 
                  className={`w-6 h-6 rounded-[6px] transition-all hover:scale-110 cursor-pointer ${
                    cell.isActive 
                      ? 'bg-success-lime shadow-[0_0_10px_rgba(220,253,139,0.5)]' 
                      : 'bg-gray-200 dark:bg-surface-raised'
                  }`}
                  title={`${cell.dayLabel}${cell.isActive ? ' ✅ Active' : ''}`}
                ></div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end items-center gap-2 mt-4 font-label-md text-label-md text-gray-500 dark:text-on-surface-variant">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-[3px] bg-gray-200 dark:bg-surface-raised"></div>
            <div className="w-3 h-3 rounded-[3px] bg-primary-fixed-dim/40"></div>
            <div className="w-3 h-3 rounded-[3px] bg-success-lime"></div>
            <div className="w-3 h-3 rounded-[3px] bg-focus-purple/60"></div>
          </div>
          <span>More</span>
        </div>
      </section>

      {/* Badge Showcase */}
      <section className="bg-white dark:bg-surface-container-low rounded-[24px] p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.05)] dark:shadow-[0px_10px_30px_rgba(0,0,0,0.2)] transition-colors duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-headline-md text-headline-md text-gray-900 dark:text-primary flex items-center gap-2">
            <Medal className="text-focus-purple" size={24} />
            Badge Showcase
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-surface-raised rounded-xl p-5 border border-gray-200 dark:border-outline-variant/30 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-primary-container/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px] text-success-lime fill">data_object</span>
            </div>
            <div>
              <h3 className="font-body-lg text-body-lg text-gray-900 dark:text-primary font-bold">DSA Master</h3>
              <p className="font-body-sm text-body-sm text-gray-600 dark:text-on-surface-variant mt-1">Helped 20 peers conquer Trees & Graphs.</p>
            </div>
          </div>
          {streak.currentStreak >= 5 && (
            <div className="bg-gray-50 dark:bg-surface-raised rounded-xl p-5 border border-gray-200 dark:border-outline-variant/30 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-orange-100/20 dark:bg-surface-container flex items-center justify-center">
                <Flame size={32} className="text-orange-500" />
              </div>
              <div>
                <h3 className="font-body-lg text-body-lg text-gray-900 dark:text-primary font-bold">On Fire!</h3>
                <p className="font-body-sm text-body-sm text-gray-600 dark:text-on-surface-variant mt-1">Maintained a {streak.currentStreak}-day learning streak.</p>
              </div>
            </div>
          )}
          {tokenBalance >= 100 && (
            <div className="bg-gray-50 dark:bg-surface-raised rounded-xl p-5 border border-gray-200 dark:border-outline-variant/30 flex flex-col items-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-purple-100/20 dark:bg-surface-container flex items-center justify-center">
                <Coins size={32} className="text-focus-purple" />
              </div>
              <div>
                <h3 className="font-body-lg text-body-lg text-gray-900 dark:text-primary font-bold">Token Collector</h3>
                <p className="font-body-sm text-body-sm text-gray-600 dark:text-on-surface-variant mt-1">Earned {tokenBalance} Mind Tokens through contribution.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Profile;
