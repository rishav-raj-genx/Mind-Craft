import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gamificationService } from '../services/gamificationService';
import { ArrowLeft, Coins, MessageCircle, Users, Flame, BookOpen, Clock, ChevronRight, Sparkles } from 'lucide-react';

const Wallet = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState(450);

  useEffect(() => {
    if (currentUser) {
      gamificationService.getTokens(currentUser.uid).then(res => {
        const b = res.data?.balance || res.balance || 0;
        if (b > 0) setBalance(b);
      }).catch(() => {});
    }
  }, [currentUser]);

  // Mock earning missions data from Stitch design
  const missions = [
    {
      id: 1,
      icon: <MessageCircle size={22} className="text-green-600 dark:text-success-lime" />,
      title: 'Solve a Doubt in Forum',
      reward: 10,
      unit: 'MT',
      color: 'bg-success-lime/20 border-success-lime/30',
      completed: false,
    },
    {
      id: 2,
      icon: <Users size={22} className="text-focus-purple" />,
      title: 'Complete a 1-hour Session',
      reward: 50,
      unit: 'MT',
      color: 'bg-focus-purple/20 border-focus-purple/30',
      completed: false,
    },
    {
      id: 3,
      icon: <Flame size={22} className="text-orange-500" />,
      title: 'Maintain 7-day Streak',
      reward: 200,
      unit: 'MT',
      color: 'bg-orange-100 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30',
      completed: false,
      progress: { current: 4, total: 7, label: '4 Days' },
    },
    {
      id: 4,
      icon: <BookOpen size={22} className="text-secondary" />,
      title: 'Help 5 peers this week',
      reward: 100,
      unit: 'MT',
      color: 'bg-secondary/20 border-secondary/30',
      completed: false,
      progress: { current: 2, total: 5, label: '2/5 Peers' },
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-container transition-colors">
          <ArrowLeft size={20} className="text-gray-700 dark:text-on-surface" />
        </button>
        <h2 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Wallet</h2>
      </header>

      {/* Balance Card */}
      <section className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 dark:from-secondary-container dark:via-[#4a1d72] dark:to-[#2d0050] rounded-[24px] p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-success-lime/10 rounded-full blur-3xl pointer-events-none -translate-x-10 translate-y-10"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-purple-200" />
            <span className="font-label-md text-label-md text-purple-200 uppercase tracking-wider">Wallet</span>
          </div>
          <h2 className="font-body-lg text-body-lg text-purple-100 mb-4">Current Balance</h2>
          <div className="flex items-end gap-3 mb-3">
            <span className="font-headline-xl text-[56px] leading-none font-bold text-white tabular-nums">{balance}</span>
            <span className="font-label-lg text-label-lg text-purple-200 pb-2">Mind Tokens</span>
          </div>
          <div className="flex items-center gap-2 mt-4 bg-white/10 rounded-full py-2 px-4 w-fit backdrop-blur-sm">
            <Clock size={14} className="text-purple-200" />
            <span className="font-label-md text-label-md text-purple-100">Daily Reset in 4h</span>
          </div>
        </div>
      </section>

      {/* Earning Missions */}
      <section className="flex flex-col gap-4 pb-24">
        <div className="flex justify-between items-center">
          <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Earning Missions</h3>
          <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant">Daily Reset in 4h</span>
        </div>

        <div className="flex flex-col gap-3">
          {missions.map((mission, idx) => (
            <div
              key={mission.id}
              className={`bg-white dark:bg-surface-container rounded-2xl p-5 border border-gray-200 dark:border-surface-raised flex items-center gap-4 transition-all hover:shadow-md group cursor-pointer`}
              style={{ animationDelay: `${idx * 80}ms`, animation: 'slideUp 0.4s ease-out both' }}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${mission.color} flex-shrink-0`}>
                {mission.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-body-lg text-body-lg text-gray-900 dark:text-on-surface font-semibold truncate">{mission.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Coins size={14} className="text-focus-purple" />
                  <span className="font-label-lg text-label-lg text-green-700 dark:text-success-lime">{mission.reward} {mission.unit}</span>
                </div>
                {mission.progress && (
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant">{mission.progress.label}</span>
                      <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant">
                        {Math.round((mission.progress.current / mission.progress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-surface-raised rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-success-lime rounded-full transition-all duration-500"
                        style={{ width: `${(mission.progress.current / mission.progress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              <ChevronRight size={20} className="text-gray-400 dark:text-on-surface-variant group-hover:text-gray-600 dark:group-hover:text-on-surface transition-colors flex-shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Wallet;
