import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BadgeProgress from '../pages/BadgeProgress';
import * as authContext from '../context/AuthContext';
import * as gamificationHooks from '../hooks/useGamification';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useGamification', () => ({
  useBadges: vi.fn(),
}));

const ALL_17_BADGES = [
  { id: 'streak_champion', name: 'Streak Champion', emoji: '🔥', description: 'Maintain a daily streak', level: 1, maxLevel: 4, isMaxed: false, currentValue: 3, nextThreshold: 7, progress: 0, progressLabel: '3/7', color: 'from-orange-500/20 to-orange-400/10', borderColor: 'border-orange-400/30', iconColor: 'text-orange-500' },
  { id: 'session_pro', name: 'Session Pro', emoji: '📚', description: 'Complete tutoring sessions', level: 0, maxLevel: 3, isMaxed: false, currentValue: 2, nextThreshold: 5, progress: 40, progressLabel: '2/5', color: 'from-green-500/20 to-success-lime/10', borderColor: 'border-success-lime/30', iconColor: 'text-success-lime' },
  { id: 'dsa_master', name: 'DSA Master', emoji: '💻', description: 'DSA-related sessions', level: 0, maxLevel: 3, isMaxed: false, currentValue: 0, nextThreshold: 3, progress: 0, progressLabel: '0/3', color: 'from-green-500/20 to-success-lime/10', borderColor: 'border-success-lime/30', iconColor: 'text-green-600' },
  { id: 'late_night_learner', name: 'Late Night Learner', emoji: '🌙', description: 'Sessions after midnight', level: 0, maxLevel: 3, isMaxed: false, currentValue: 0, nextThreshold: 1, progress: 0, progressLabel: '0/1', color: 'from-purple-500/20 to-focus-purple/10', borderColor: 'border-focus-purple/30', iconColor: 'text-focus-purple' },
  { id: 'problem_solver', name: 'Problem Solver', emoji: '🐛', description: 'Answer doubts in the forum', level: 0, maxLevel: 3, isMaxed: false, currentValue: 1, nextThreshold: 3, progress: 33, progressLabel: '1/3', color: 'from-orange-500/20 to-orange-400/10', borderColor: 'border-orange-400/30', iconColor: 'text-orange-500' },
  { id: 'mentor', name: 'Mentor', emoji: '🎓', description: 'Teach sessions as a tutor', level: 0, maxLevel: 3, isMaxed: false, currentValue: 1, nextThreshold: 3, progress: 33, progressLabel: '1/3', color: 'from-blue-500/20 to-blue-400/10', borderColor: 'border-blue-400/30', iconColor: 'text-blue-600' },
  { id: 'top_rated', name: 'Top Rated', emoji: '⭐', description: 'Earn high ratings (avg ≥ 4.0)', level: 0, maxLevel: 3, isMaxed: false, currentValue: 1, nextThreshold: 5, progress: 20, progressLabel: '1/5', color: 'from-yellow-500/20 to-yellow-400/10', borderColor: 'border-yellow-400/30', iconColor: 'text-yellow-500' },
  { id: 'social_butterfly', name: 'Social Butterfly', emoji: '🤝', description: 'Study with unique mates', level: 0, maxLevel: 3, isMaxed: false, currentValue: 1, nextThreshold: 3, progress: 33, progressLabel: '1/3', color: 'from-pink-500/20 to-pink-400/10', borderColor: 'border-pink-400/30', iconColor: 'text-pink-500' },
  { id: 'wealthy_mind', name: 'Wealthy Mind', emoji: '🪙', description: 'Accumulate Mind Tokens', level: 1, maxLevel: 3, isMaxed: false, currentValue: 120, nextThreshold: 500, progress: 5, progressLabel: '120/500', color: 'from-yellow-500/20 to-yellow-400/10', borderColor: 'border-yellow-400/30', iconColor: 'text-yellow-500' },
  { id: 'weekly_warrior', name: 'Weekly Warrior', emoji: '', description: 'Maintained a perfect 7-day study streak this week', level: 1, maxLevel: 3, isMaxed: false, currentValue: 1, nextThreshold: 4, progress: 0, progressLabel: '1/4', color: 'from-amber-500/20 to-yellow-400/10', borderColor: 'border-amber-400/30', iconColor: 'text-amber-500' },
  { id: 'spark_starter', name: 'Spark Starter', emoji: '', description: 'Achieved a 3-day daily consistency streak', level: 1, maxLevel: 1, isMaxed: true, currentValue: 3, nextThreshold: 3, progress: 100, progressLabel: '3/3', color: 'from-emerald-500/20 to-green-400/10', borderColor: 'border-emerald-400/30', iconColor: 'text-emerald-500' },
  { id: '7_day_streak', name: '7-Day Streak', emoji: '', description: 'Achieved a consecutive 7-day study streak', level: 0, maxLevel: 1, isMaxed: false, currentValue: 3, nextThreshold: 7, progress: 43, progressLabel: '3/7', color: 'from-orange-500/20 to-red-400/10', borderColor: 'border-orange-400/30', iconColor: 'text-orange-500' },
  { id: 'fortnight_focus', name: 'Fortnight Focus', emoji: '', description: 'Achieved a 14-day study streak', level: 0, maxLevel: 1, isMaxed: false, currentValue: 3, nextThreshold: 14, progress: 21, progressLabel: '3/14', color: 'from-red-500/20 to-orange-400/10', borderColor: 'border-red-400/30', iconColor: 'text-red-500' },
  { id: 'monthly_master', name: 'Monthly Master', emoji: '', description: 'Achieved a 30-day consistency streak', level: 0, maxLevel: 1, isMaxed: false, currentValue: 3, nextThreshold: 30, progress: 10, progressLabel: '3/30', color: 'from-yellow-500/20 to-amber-400/10', borderColor: 'border-yellow-400/30', iconColor: 'text-yellow-500' },
  { id: 'discipline_king', name: 'Discipline King', emoji: '', description: 'Achieved a 60-day consistency streak', level: 0, maxLevel: 1, isMaxed: false, currentValue: 3, nextThreshold: 60, progress: 5, progressLabel: '3/60', color: 'from-cyan-500/20 to-blue-400/10', borderColor: 'border-cyan-400/30', iconColor: 'text-cyan-500' },
  { id: 'century_legend', name: 'Century Legend', emoji: '', description: 'Achieved an epic 100-day consistency streak', level: 0, maxLevel: 1, isMaxed: false, currentValue: 3, nextThreshold: 100, progress: 3, progressLabel: '3/100', color: 'from-purple-500/20 to-yellow-400/10', borderColor: 'border-purple-400/30', iconColor: 'text-purple-500' },
  { id: 'master_tutor', name: 'Master Tutor', emoji: '', description: 'Recognized master tutor with exceptional feedback across sessions', level: 0, maxLevel: 3, isMaxed: false, currentValue: 1, nextThreshold: 10, progress: 10, progressLabel: '1/10', color: 'from-indigo-500/20 to-purple-400/10', borderColor: 'border-indigo-400/30', iconColor: 'text-indigo-500' },
];

describe('BadgeProgress Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authContext.useAuth.mockReturnValue({
      currentUser: { uid: 'clerk-user-1', name: 'Tester' },
    });
    gamificationHooks.useBadges.mockReturnValue({
      isLoading: false,
      data: {
        data: {
          badges: ALL_17_BADGES,
          totalEarned: 4,
          totalSessions: 2,
          sessionHistory: [],
          badgeHistory: [
            {
              id: 'spark_starter_manual_2026-11-26_lv1',
              badgeId: 'spark_starter',
              badgeName: 'Spark Starter',
              level: 1,
              earnedAt: '2026-11-26T10:00:00.000Z',
            },
            {
              id: 'weekly_warrior_2026-11-16_2026-11-22',
              badgeId: 'weekly_warrior',
              badgeName: 'Weekly Warrior',
              level: 1,
              earnedAt: '2026-11-23T00:00:00.000Z',
            },
          ],
        },
      },
    });
  });

  it('renders all 17 badges including the 8 previously ghost badges', () => {
    render(
      <MemoryRouter>
        <BadgeProgress />
      </MemoryRouter>,
    );

    ALL_17_BADGES.forEach((badge) => {
      expect(screen.getByText(badge.name)).toBeInTheDocument();
    });
  });

  it('renders earned badge history cards when Badges Earned is expanded', () => {
    render(
      <MemoryRouter>
        <BadgeProgress />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Badges Earned'));

    expect(screen.getByText('Spark Starter — Level 1')).toBeInTheDocument();
    expect(screen.getByText('Weekly Warrior — Level 1')).toBeInTheDocument();
  });
});
