import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { gamificationService } from '../services/gamificationService';
import { matchService } from '../services/matchService';
import { Link } from 'react-router-dom';
import { Flame, Coins, Star, Code, FunctionSquare, Cpu, TestTube, Database, BrainCircuit } from 'lucide-react';

const Home = () => {
  const { currentUser } = useAuth();
  const [tokens, setTokens] = useState(0);
  const [streak, setStreak] = useState({ currentStreak: 0 });
  const [topMates, setTopMates] = useState([]);
  
  useEffect(() => {
    if (currentUser) {
      const loadData = async () => {
        try {
          const t = await gamificationService.getTokens(currentUser.uid);
          setTokens(t.data?.balance || t.balance || 0);
          
          const s = await gamificationService.getStreak(currentUser.uid);
          setStreak(s.data || s || { currentStreak: 0 });
          
          const m = await matchService.getMatches(currentUser.uid);
          // Just take top 3 for dashboard
          const matchList = m.data || m.matches || [];
          setTopMates(matchList.slice(0, 3));
        } catch (err) {
          console.error("Error loading home data:", err);
        }
      };
      loadData();
    }
  }, [currentUser]);

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome & Stats Banner */}
      <section className="bg-white dark:bg-surface-container rounded-xl p-6 relative overflow-hidden shadow-lg dark:shadow-[0px_10px_30px_rgba(0,0,0,0.4)] border border-gray-200 dark:border-surface-raised transition-colors duration-200">
        <div className="relative z-10 flex flex-col gap-4">
          <div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-gray-900 dark:text-on-surface">Welcome Back, {currentUser?.displayName?.split(' ')[0] || 'User'}!</h2>
            <p className="font-body-md text-body-md text-gray-600 dark:text-on-surface-variant mt-1">Ready to crush some concepts today?</p>
          </div>
          <div className="flex flex-wrap gap-4 mt-2">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-surface-raised rounded-full py-2 px-4 shadow-sm border border-gray-200 dark:border-[#262626]">
              <Flame className="text-orange-500" size={20} />
              <span className="font-label-lg text-label-lg text-gray-900 dark:text-on-surface">{streak.currentStreak} Day Streak</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-50 dark:bg-secondary-container/20 rounded-full py-2 px-4 shadow-sm border border-purple-200 dark:border-secondary-container">
              <Coins className="text-purple-600" size={20} />
              <span className="font-label-lg text-label-lg text-purple-700 dark:text-secondary">{tokens} Mind Tokens</span>
            </div>
          </div>
        </div>
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-success-lime/20 dark:bg-success-lime/5 rounded-full blur-2xl pointer-events-none"></div>
      </section>

      {/* Top Rated Mates */}
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Top Recommended Mates</h3>
          <Link to="/find" className="font-label-md text-label-md text-success-lime text-green-700 hover:underline">View All</Link>
        </div>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-margin-mobile px-margin-mobile snap-x">
          {topMates.map((mate, i) => (
            <div key={i} className="min-w-[200px] bg-white dark:bg-surface-container rounded-xl p-4 flex flex-col items-center gap-3 snap-center border border-gray-200 dark:border-surface-raised shadow-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <img alt="Mate Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-focus-purple" src={mate.photoUrl || "https://ui-avatars.com/api/?name="+mate.name} />
              <div className="text-center">
                <h4 className="font-body-lg text-body-lg text-gray-900 dark:text-on-surface font-semibold">{mate.name}</h4>
                <p className="font-label-md text-label-md text-gray-600 dark:text-on-surface-variant truncate w-32">{mate.sharedSkills?.[0] || mate.department}</p>
              </div>
              <div className="flex items-center gap-1 bg-gray-50 dark:bg-surface-raised rounded-full py-1 px-3">
                <Star className="text-orange-500 fill-orange-500" size={14} />
                <span className="font-label-md text-label-md text-gray-900 dark:text-on-surface">{mate.averageRating || "New"}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-surface-raised rounded-full h-2 mt-1 relative overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-success-lime w-[85%] rounded-full"></div>
              </div>
            </div>
          ))}
          {topMates.length === 0 && (
            <div className="text-gray-500 dark:text-on-surface-variant italic">No matches found yet. Try adding more skills to your profile!</div>
          )}
        </div>
      </section>

      {/* Trending Syllabus Topics */}
      <section className="flex flex-col gap-4 mb-20">
        <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Trending Syllabus Topics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <button className="bg-white dark:bg-surface-container hover:bg-gray-50 dark:hover:bg-surface-container-high border border-gray-200 dark:border-surface-raised rounded-full py-3 px-4 flex items-center justify-center gap-2 transition-colors tactile-press shadow-[0px_4px_0px_#e5e7eb] dark:shadow-[0px_4px_0px_#262626]">
            <Code className="text-green-600" size={18} />
            <span className="font-label-lg text-label-lg text-gray-900 dark:text-on-surface">Data Structures</span>
          </button>
          <button className="bg-white dark:bg-surface-container hover:bg-gray-50 dark:hover:bg-surface-container-high border border-gray-200 dark:border-surface-raised rounded-full py-3 px-4 flex items-center justify-center gap-2 transition-colors tactile-press shadow-[0px_4px_0px_#e5e7eb] dark:shadow-[0px_4px_0px_#262626]">
            <FunctionSquare className="text-purple-600" size={18} />
            <span className="font-label-lg text-label-lg text-gray-900 dark:text-on-surface">Calculus II</span>
          </button>
          <button className="bg-white dark:bg-surface-container hover:bg-gray-50 dark:hover:bg-surface-container-high border border-gray-200 dark:border-surface-raised rounded-full py-3 px-4 flex items-center justify-center gap-2 transition-colors tactile-press shadow-[0px_4px_0px_#e5e7eb] dark:shadow-[0px_4px_0px_#262626]">
            <Cpu className="text-orange-500" size={18} />
            <span className="font-label-lg text-label-lg text-gray-900 dark:text-on-surface">Operating Sys</span>
          </button>
          <button className="bg-white dark:bg-surface-container hover:bg-gray-50 dark:hover:bg-surface-container-high border border-gray-200 dark:border-surface-raised rounded-full py-3 px-4 flex items-center justify-center gap-2 transition-colors tactile-press shadow-[0px_4px_0px_#e5e7eb] dark:shadow-[0px_4px_0px_#262626]">
            <TestTube className="text-green-600" size={18} />
            <span className="font-label-lg text-label-lg text-gray-900 dark:text-on-surface">Microbiology</span>
          </button>
          <button className="bg-white dark:bg-surface-container hover:bg-gray-50 dark:hover:bg-surface-container-high border border-gray-200 dark:border-surface-raised rounded-full py-3 px-4 flex items-center justify-center gap-2 transition-colors tactile-press shadow-[0px_4px_0px_#e5e7eb] dark:shadow-[0px_4px_0px_#262626]">
            <Database className="text-purple-600" size={18} />
            <span className="font-label-lg text-label-lg text-gray-900 dark:text-on-surface">Econometrics</span>
          </button>
          <button className="bg-white dark:bg-surface-container hover:bg-gray-50 dark:hover:bg-surface-container-high border border-gray-200 dark:border-surface-raised rounded-full py-3 px-4 flex items-center justify-center gap-2 transition-colors tactile-press shadow-[0px_4px_0px_#e5e7eb] dark:shadow-[0px_4px_0px_#262626]">
            <BrainCircuit className="text-lime-600" size={18} />
            <span className="font-label-lg text-label-lg text-gray-900 dark:text-on-surface">Cognitive Psych</span>
          </button>
        </div>
      </section>

    </div>
  );
};

export default Home;
