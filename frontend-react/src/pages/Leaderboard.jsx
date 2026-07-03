import { ArrowLeft, Star, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Leaderboard = () => {
  const navigate = useNavigate();

  const topUsers = [
    { rank: 1, name: "Muskan", tokens: 1200, badge: "Master Tutor", avatar: "https://ui-avatars.com/api/?name=Muskan&background=DCFD8B&color=151f00" },
    { rank: 2, name: "Satya", tokens: 850, badge: "Top Contributor", avatar: "https://ui-avatars.com/api/?name=Satya&background=DEB7FF&color=2D0050" },
    { rank: 3, name: "Kavita", tokens: 760, badge: "Rising Star", avatar: "https://ui-avatars.com/api/?name=Kavita&background=FDD5BD&color=432b1b" },
    { rank: 4, name: "Sneha", tokens: 720, badge: "Helpful", avatar: "https://ui-avatars.com/api/?name=Sneha" },
    { rank: 5, name: "Liam T.", tokens: 690, badge: "Active", avatar: "https://ui-avatars.com/api/?name=Liam" },
    { rank: 6, name: "Olivia H.", tokens: 650, badge: "Consistent", avatar: "https://ui-avatars.com/api/?name=Olivia" },
    { rank: 7, name: "Mia W.", tokens: 610, badge: "Learner", avatar: "https://ui-avatars.com/api/?name=Mia" },
  ];

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-container transition-colors">
          <ArrowLeft size={20} className="text-gray-700 dark:text-on-surface" />
        </button>
        <h1 className="font-headline-lg text-headline-lg text-gray-900 dark:text-on-surface">Weekly Leaderboard</h1>
      </header>

      {/* Podium (Top 3) */}
      <section className="mt-8 mb-4 px-4 h-64 flex items-end justify-center gap-2 md:gap-4 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-focus-purple/20 to-transparent blur-3xl pointer-events-none -z-10"></div>
        
        {/* Rank 2 */}
        <div className="w-1/3 flex flex-col items-center relative z-10" style={{ animationDelay: '200ms', animation: 'slideUp 0.5s ease-out both' }}>
          <div className="relative mb-3">
            <img src={topUsers[1].avatar} alt={topUsers[1].name} className="w-16 h-16 rounded-full border-[3px] border-gray-300 dark:border-gray-500 object-cover shadow-lg" />
            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-gray-300 dark:bg-gray-500 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white dark:border-background-deep shadow-md">2</div>
          </div>
          <h3 className="font-body-md text-body-md font-bold text-gray-900 dark:text-on-surface">{topUsers[1].name}</h3>
          <p className="font-label-md text-label-md text-focus-purple mt-0.5">{topUsers[1].tokens} Tokens</p>
          <div className="w-full bg-gradient-to-t from-gray-200 dark:from-surface-raised to-transparent h-24 mt-4 rounded-t-2xl border-t border-x border-gray-300 dark:border-outline-variant/30 opacity-80"></div>
        </div>
        
        {/* Rank 1 */}
        <div className="w-1/3 flex flex-col items-center relative z-20" style={{ animationDelay: '0ms', animation: 'slideUp 0.5s ease-out both' }}>
          <div className="absolute -top-12">
            <Medal size={32} className="text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" />
          </div>
          <div className="relative mb-3">
            <img src={topUsers[0].avatar} alt={topUsers[0].name} className="w-24 h-24 rounded-full border-[4px] border-yellow-400 object-cover shadow-[0_0_20px_rgba(250,204,21,0.4)]" />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-sm font-bold text-yellow-900 border-2 border-white dark:border-background-deep shadow-md">1</div>
          </div>
          <h3 className="font-body-lg text-body-lg font-bold text-gray-900 dark:text-on-surface">{topUsers[0].name}</h3>
          <p className="font-label-lg text-label-lg text-focus-purple font-bold mt-0.5">{topUsers[0].tokens} Tokens</p>
          <div className="w-full bg-gradient-to-t from-focus-purple/30 to-transparent h-32 mt-4 rounded-t-2xl border-t border-x border-focus-purple/50 dark:border-focus-purple/30 shadow-[0_-10px_20px_rgba(188,132,238,0.15)] opacity-90"></div>
        </div>

        {/* Rank 3 */}
        <div className="w-1/3 flex flex-col items-center relative z-10" style={{ animationDelay: '400ms', animation: 'slideUp 0.5s ease-out both' }}>
          <div className="relative mb-3">
            <img src={topUsers[2].avatar} alt={topUsers[2].name} className="w-16 h-16 rounded-full border-[3px] border-orange-400 object-cover shadow-lg" />
            <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white dark:border-background-deep shadow-md">3</div>
          </div>
          <h3 className="font-body-md text-body-md font-bold text-gray-900 dark:text-on-surface">{topUsers[2].name}</h3>
          <p className="font-label-md text-label-md text-focus-purple mt-0.5">{topUsers[2].tokens} Tokens</p>
          <div className="w-full bg-gradient-to-t from-orange-200 dark:from-orange-900/30 to-transparent h-20 mt-4 rounded-t-2xl border-t border-x border-orange-300 dark:border-orange-500/30 opacity-80"></div>
        </div>
      </section>

      {/* Rest of the list */}
      <section className="flex flex-col gap-3 pb-32 mt-4">
        {topUsers.slice(3).map((user, idx) => (
          <div 
            key={user.rank} 
            className="bg-white dark:bg-surface-container rounded-2xl p-4 border border-gray-200 dark:border-surface-raised flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
            style={{ animationDelay: `${500 + idx * 100}ms`, animation: 'slideUp 0.4s ease-out both' }}
          >
            <div className="w-8 flex justify-center text-gray-500 dark:text-on-surface-variant font-bold">
              {user.rank}
            </div>
            
            <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-surface-raised" />
            
            <div className="flex-1 min-w-0">
              <h3 className="font-body-lg text-body-lg text-gray-900 dark:text-on-surface font-semibold truncate">{user.name}</h3>
              <span className="text-[11px] font-label-md text-gray-500 dark:text-on-surface-variant">{user.badge}</span>
            </div>
            
            <div className="flex items-center gap-1.5 font-label-lg text-label-lg text-gray-900 dark:text-on-surface font-bold">
              {user.tokens}
            </div>
          </div>
        ))}
      </section>

      {/* Fixed "You" Bar at bottom */}
      <div className="fixed bottom-[80px] left-0 right-0 px-margin-mobile z-40 max-w-[1200px] mx-auto w-full">
        <div className="bg-gradient-to-r from-purple-900 to-secondary-container rounded-2xl p-4 shadow-[0_10px_25px_rgba(99,45,147,0.3)] flex items-center justify-between border border-focus-purple/30 animate-[slideUp_0.5s_ease-out_1s_both]">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-sm">
              42
            </div>
            <div>
              <h4 className="font-body-md text-body-md font-bold text-white">You</h4>
              <p className="font-label-md text-[11px] text-purple-200">450 Tokens • +150 to rank up</p>
            </div>
          </div>
          <button onClick={() => navigate('/wallet')} className="bg-success-lime text-green-900 font-label-md text-sm px-4 py-2 rounded-full font-bold shadow-[0_2px_0_#b3d266] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1">
            <Star size={14} className="fill-current" /> Earn More
          </button>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
