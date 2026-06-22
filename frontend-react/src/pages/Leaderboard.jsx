import { Trophy, Medal, Star } from 'lucide-react';

const Leaderboard = () => {
  const topUsers = [
    { rank: 1, name: "Alex Chen", tokens: 2450, badge: "Master Tutor" },
    { rank: 2, name: "Sarah Smith", tokens: 2100, badge: "Top Contributor" },
    { rank: 3, name: "Mike Johnson", tokens: 1950, badge: "Rising Star" },
    { rank: 4, name: "Emma Davis", tokens: 1800, badge: "Helpful" },
    { rank: 5, name: "Chris Wilson", tokens: 1650, badge: "Active" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center">
          <Trophy size={48} className="text-yellow-400 mb-4" />
          <h1 className="font-headline-xl text-3xl font-bold mb-2">Weekly Leaderboard</h1>
          <p className="font-body-md opacity-90">Top contributors in the Mindcraft community</p>
        </div>
        <div className="absolute top-0 left-0 w-full h-full bg-white opacity-10 blur-2xl rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      </header>

      <section className="bg-white dark:bg-surface-container rounded-2xl p-6 shadow-md border border-gray-200 dark:border-surface-raised mb-20">
        <div className="flex flex-col gap-4">
          {topUsers.map((user, idx) => (
            <div key={idx} className={`flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.01] ${idx < 3 ? 'bg-purple-50 dark:bg-secondary-container/20 border border-purple-100 dark:border-secondary-container/30' : 'bg-gray-50 dark:bg-surface-raised border border-transparent'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                idx === 0 ? 'bg-yellow-100 text-yellow-600' : 
                idx === 1 ? 'bg-gray-200 text-gray-600' : 
                idx === 2 ? 'bg-orange-100 text-orange-600' : 
                'bg-gray-100 dark:bg-surface-container text-gray-500'
              }`}>
                {idx < 3 ? <Medal size={20} /> : `#${user.rank}`}
              </div>
              
              <img src={`https://ui-avatars.com/api/?name=${user.name}`} alt={user.name} className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-surface-container" />
              
              <div className="flex-1">
                <h3 className="font-headline-md text-lg text-gray-900 dark:text-on-surface leading-none mb-1">{user.name}</h3>
                <span className="text-xs bg-white dark:bg-background-deep px-2 py-0.5 rounded border border-gray-200 dark:border-surface-raised text-gray-600 dark:text-gray-400">{user.badge}</span>
              </div>
              
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-purple-600 dark:text-secondary font-bold">
                  <Star size={16} className="fill-current" />
                  {user.tokens}
                </div>
                <span className="text-xs text-gray-500 uppercase">Tokens</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Leaderboard;
