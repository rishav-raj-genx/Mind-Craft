import { api, getStoredUserId } from './api';

export type Mate = {
  id: string;
  name: string;
  skill: string;
  coordinate: { latitude: number; longitude: number };
  college?: string;
  matchReason: string;
};

export type Doubt = {
  id: string;
  tag: string;
  title: string;
  hint: string;
};

export type ProfileSummary = {
  name: string;
  meta: string;
  tokens: number;
  streakDays: number;
  doubtsSolved: number;
  badges: string[];
};

export const fallbackMates: Mate[] = [
  { id: '1', name: 'Rishav', skill: 'JavaScript', coordinate: { latitude: 28.6139, longitude: 77.209 }, college: 'MIRAI School', matchReason: 'Shared Web Dev topic' },
  { id: '2', name: 'Anya', skill: 'Organic Chem', coordinate: { latitude: 28.62, longitude: 77.23 }, college: 'Campus North', matchReason: 'Teaches what you learn' },
  { id: '3', name: 'Raja', skill: 'DSA', coordinate: { latitude: 28.602, longitude: 77.19 }, college: 'Tech Block', matchReason: 'Strong DSA overlap' },
];

export const fallbackDoubts: Doubt[] = [
  { id: '1', tag: '#DSA', title: 'What is a base case?', hint: 'Think of the smallest input where recursion can stop.' },
  { id: '2', tag: '#WebDev', title: 'What is closure in JS?', hint: 'A function remembers variables from its outer scope.' },
  { id: '3', tag: '#Math', title: 'How do limits work?', hint: 'Watch what value the function approaches, not always reaches.' },
];

export const fallbackProfile: ProfileSummary = {
  name: 'Mindcraft Learner',
  meta: 'CSE • Year 1 • 7 day streak',
  tokens: 1240,
  streakDays: 7,
  doubtsSolved: 18,
  badges: ['Weekly Warrior', 'Session Pro', 'Problem Solver'],
};

export async function fetchMates(): Promise<Mate[]> {
  const uid = await getStoredUserId();
  if (!uid) return fallbackMates;

  const response = await api.get(`/match/${uid}/broad`, { params: { limit: 12 } });
  const rows = response.data?.data || [];

  return rows.map((row: any, index: number) => {
    const tutor = row.tutor || row.user || row;
    const sharedSkills = row.sharedSkills || tutor.sharedSkills || tutor.teaches || [];
    const skill = sharedSkills[0] || tutor.teaches?.[0] || 'Peer Study';
    return {
      id: tutor.uid || `${index}`,
      name: tutor.name || 'Study Mate',
      skill,
      college: tutor.college || tutor.department,
      coordinate: {
        latitude: Number(tutor.latitude) || 28.6139 + index * 0.006,
        longitude: Number(tutor.longitude) || 77.209 + index * 0.006,
      },
      matchReason: sharedSkills.length ? `${sharedSkills.length} shared topic${sharedSkills.length > 1 ? 's' : ''}` : 'Recommended by Mindcraft',
    };
  });
}

export async function fetchDoubts(): Promise<Doubt[]> {
  const response = await api.get('/doubt');
  const rows = response.data?.data || [];

  return rows.map((doubt: any) => ({
    id: doubt.id,
    tag: doubt.tag || '#General',
    title: doubt.title || doubt.content || 'Untitled doubt',
    hint: doubt.aiHint || 'AI Assist is waiting for the Sarvam study hint.',
  }));
}

export async function fetchProfileSummary(): Promise<ProfileSummary> {
  const uid = await getStoredUserId();
  if (!uid) return fallbackProfile;

  const [profileRes, tokensRes, streakRes, badgesRes] = await Promise.allSettled([
    api.get(`/user/${uid}/profile`),
    api.get(`/tokens/${uid}`),
    api.get(`/streak/${uid}`),
    api.get(`/badges/${uid}`),
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data?.data : null;
  const user = profile?.user || {};
  const tokenData = tokensRes.status === 'fulfilled' ? tokensRes.value.data?.data : null;
  const streakData = streakRes.status === 'fulfilled' ? streakRes.value.data?.data : profile?.streak;
  const badgesData = badgesRes.status === 'fulfilled' ? badgesRes.value.data?.data : null;
  const earnedBadges = badgesData?.badges || profile?.badges || [];
  const badgeNames = earnedBadges
    .filter((badge: any) => !('level' in badge) || badge.level > 0)
    .map((badge: any) => badge.name || badge.badgeName || badge.id)
    .filter(Boolean);

  return {
    name: user.name || fallbackProfile.name,
    meta: [user.department, user.year, user.college].filter(Boolean).join(' • ') || fallbackProfile.meta,
    tokens: Number(tokenData?.balance ?? profile?.tokenBalance ?? fallbackProfile.tokens),
    streakDays: Number(streakData?.currentStreak ?? fallbackProfile.streakDays),
    doubtsSolved: Number(profile?.stats?.doubtsAnswered ?? fallbackProfile.doubtsSolved),
    badges: badgeNames.length ? badgeNames.slice(0, 4) : fallbackProfile.badges,
  };
}
