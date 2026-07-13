import { api, getStoredUserId } from './api';

const avatarFor = (name: string, background = 'D9FF7A', color = '201A2E') =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${background}&color=${color}`;

export type Mate = {
  id: string;
  name: string;
  skill: string;
  coordinate: { latitude: number; longitude: number };
  college?: string;
  matchReason: string;
  photoUrl?: string;
};

export type Doubt = {
  id: string;
  tag: string;
  title: string;
  content?: string;
  hint: string;
  images: DoubtImage[];
};

export type DoubtImage = {
  id: string;
  order?: number;
  mimeType?: string;
  fileName?: string;
  width?: number;
  height?: number;
  size?: number;
  dataUri: string;
  createdAt?: number;
};

export type ProfileSummary = {
  name: string;
  meta: string;
  tokens: number;
  streakDays: number;
  doubtsSolved: number;
  badges: string[];
  photoUrl?: string;
};

export type ChatThread = {
  matchId: string;
  partner: {
    uid: string;
    name?: string;
    email?: string;
    photoUrl?: string;
  };
  lastMessage: string;
  lastMessageTime: number;
  lastMessageSender?: string;
  unread: boolean;
};

export type ChatMessage = {
  messageId: string;
  senderUid: string;
  text: string;
  timestamp: number;
  read?: boolean;
  localId?: string;
};

export type SessionMode = 'Online' | 'Offline';

export type StudySession = {
  sessionId: string;
  matchId: string;
  teacherUid: string;
  learnerUid: string;
  skill: string;
  scheduledAt: number;
  mode: SessionMode | 'In-Person';
  meetLink?: string;
  location?: string;
  notes?: string;
  status: string;
  peerName?: string;
};

export type TokenTransaction = {
  id: string;
  amount: number;
  reason: string;
  timestamp: number;
};

export type WalletSummary = {
  balance: number;
  transactions: TokenTransaction[];
};

export const fallbackMates: Mate[] = [
  { id: '1', name: 'Rishav', skill: 'JavaScript', coordinate: { latitude: 28.6139, longitude: 77.209 }, college: 'MIRAI School', matchReason: 'Shared Web Dev topic', photoUrl: avatarFor('Rishav') },
  { id: '2', name: 'Anya', skill: 'Organic Chem', coordinate: { latitude: 28.62, longitude: 77.23 }, college: 'Campus North', matchReason: 'Teaches what you learn', photoUrl: avatarFor('Anya', 'FFD2B8') },
  { id: '3', name: 'Raja', skill: 'DSA', coordinate: { latitude: 28.602, longitude: 77.19 }, college: 'Tech Block', matchReason: 'Strong DSA overlap', photoUrl: avatarFor('Raja', '9B7BFF', 'FFFFFF') },
];

export const fallbackDoubts: Doubt[] = [
  { id: '1', tag: '#DSA', title: 'What is a base case?', content: 'Recursion stopping condition', hint: 'Think of the smallest input where recursion can stop.', images: [] },
  { id: '2', tag: '#WebDev', title: 'What is closure in JS?', content: 'JavaScript scope doubt', hint: 'A function remembers variables from its outer scope.', images: [] },
  { id: '3', tag: '#Math', title: 'How do limits work?', content: 'Calculus concept', hint: 'Watch what value the function approaches, not always reaches.', images: [] },
];

export const fallbackProfile: ProfileSummary = {
  name: 'Mindcraft Learner',
  meta: 'CSE • Year 1 • 7 day streak',
  tokens: 1240,
  streakDays: 7,
  doubtsSolved: 18,
  badges: ['Weekly Warrior', 'Session Pro', 'Problem Solver'],
  photoUrl: avatarFor('Mindcraft', '9B7BFF', 'FFFFFF'),
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
    const name = tutor.name || 'Study Mate';
    return {
      id: tutor.uid || `${index}`,
      name,
      skill,
      college: tutor.college || tutor.department,
      photoUrl: tutor.photoUrl || avatarFor(name, index % 2 ? 'FFD2B8' : 'D9FF7A'),
      coordinate: {
        latitude: Number(tutor.latitude) || 28.6139 + index * 0.006,
        longitude: Number(tutor.longitude) || 77.209 + index * 0.006,
      },
      matchReason: sharedSkills.length ? `${sharedSkills.length} shared topic${sharedSkills.length > 1 ? 's' : ''}` : 'Recommended by Mindcraft',
    };
  });
}

export async function fetchDoubts(tag?: string): Promise<Doubt[]> {
  const url = tag ? `/doubt?tag=${encodeURIComponent(tag)}` : '/doubt';
  const response = await api.get(url);
  const rows = response.data?.data || [];

  return rows.map((doubt: any) => ({
    id: doubt.id,
    tag: doubt.tag || '#General',
    title: doubt.title || doubt.content || 'Untitled doubt',
    content: doubt.content || '',
    hint: doubt.aiHint || 'AI Assist is waiting for the Sarvam study hint.',
    images: Array.isArray(doubt.images) ? doubt.images : [],
  }));
}

export async function fetchTrendingTopics(): Promise<{ tag: string, count: number }[]> {
  try {
    const response = await api.get('/doubt/trending');
    return response.data?.data || [];
  } catch {
    return [];
  }
}

export type NewDoubtImage = {
  uri: string;
  name: string;
  type: string;
};

export async function createDoubt(payload: {
  title: string;
  content: string;
  tag: string;
  images?: NewDoubtImage[];
}): Promise<Doubt> {
  const form = new FormData();
  form.append('title', payload.title);
  form.append('content', payload.content);
  form.append('tag', payload.tag);

  for (const image of payload.images || []) {
    form.append('images', {
      uri: image.uri,
      name: image.name,
      type: image.type,
    } as unknown as Blob);
  }

  const response = await api.post('/doubt', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const doubt = response.data?.data || {};

  return {
    id: doubt.id,
    tag: doubt.tag || payload.tag,
    title: doubt.title || payload.title,
    content: doubt.content || payload.content,
    hint: doubt.aiHint || 'AI Assist is waiting for the Sarvam study hint.',
    images: Array.isArray(doubt.images) ? doubt.images : [],
  };
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
  const results = [profileRes, tokensRes, streakRes, badgesRes];
  if (results.every(result => result.status === 'rejected')) {
    throw new Error('Unable to reach Mindcraft backend.');
  }

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
    photoUrl: user.photoUrl || avatarFor(user.name || fallbackProfile.name, '9B7BFF', 'FFFFFF'),
  };
}

export async function createChatThread(partnerUid: string) {
  const response = await api.post('/chat/thread', { partnerUid });
  return response.data?.matchId || response.data?.data?.match?.matchId;
}

export async function fetchChatThreads(): Promise<ChatThread[]> {
  const uid = await getStoredUserId();
  if (!uid) return [];

  const response = await api.get(`/chat/threads/${uid}`, { params: { limit: 20 } });
  const rows = response.data?.data || [];
  return rows.map((row: any) => ({
    matchId: row.matchId,
    partner: row.partner || {},
    lastMessage: row.lastMessage || '',
    lastMessageTime: Number(row.lastMessageTime || 0),
    lastMessageSender: row.lastMessageSender || '',
    unread: Boolean(row.unread && row.lastMessageSender !== uid),
  }));
}

export async function fetchChatHistory(matchId: string): Promise<ChatMessage[]> {
  const response = await api.get(`/chat/${matchId}/history`, { params: { limit: 20 } });
  return (response.data?.data || []).map((message: any) => ({
    messageId: message.messageId,
    senderUid: message.senderUid,
    text: message.text || '',
    timestamp: Number(message.timestamp || 0),
    read: Boolean(message.read),
  }));
}

export async function sendChatMessage(matchId: string, text: string): Promise<ChatMessage> {
  const response = await api.post(`/chat/${matchId}/send`, { text });
  const message = response.data?.data || response.data?.message || response.data;
  return {
    messageId: message.messageId || message.id || `${Date.now()}`,
    senderUid: message.senderUid || message.senderId || '',
    text: message.text || text,
    timestamp: Number(message.timestamp || Date.now()),
    read: Boolean(message.read),
  };
}

export async function markChatRead(matchId: string) {
  await api.patch(`/chat/${matchId}/read`);
}

export async function fetchSessions(status?: string): Promise<StudySession[]> {
  const uid = await getStoredUserId();
  if (!uid) return [];

  const response = await api.get(`/session/${uid}`, { params: { status, limit: 20 } });
  return (response.data?.data || []).map((session: any) => ({
    ...session,
    scheduledAt: Number(session.scheduledAt || 0),
    mode: session.mode === 'In-Person' ? 'Offline' : session.mode,
  }));
}

export async function bookStudySession(payload: {
  partnerUid: string;
  skill: string;
  scheduledAt: number;
  mode: SessionMode;
  location?: string;
  notes?: string;
}) {
  const learnerUid = await getStoredUserId();
  if (!learnerUid) throw new Error('Please log in again before booking a session.');

  const matchId = await createChatThread(payload.partnerUid);
  if (!matchId) throw new Error('Could not create a chat thread for this session.');

  const response = await api.post('/session/book', {
    matchId,
    teacherUid: payload.partnerUid,
    learnerUid,
    skill: payload.skill,
    scheduledAt: payload.scheduledAt,
    mode: payload.mode === 'Offline' ? 'In-Person' : 'Online',
    meetLink: payload.mode === 'Online' ? 'https://meet.google.com/abc-defg-hij' : '',
    location: payload.mode === 'Offline' ? payload.location || '' : '',
    notes: payload.notes || '',
  });

  const session = response.data?.data;
  return {
    ...session,
    mode: session?.mode === 'In-Person' ? 'Offline' : session?.mode,
    scheduledAt: Number(session?.scheduledAt || payload.scheduledAt),
  } as StudySession;
}

export async function acceptStudySession(sessionId: string) {
  const response = await api.patch(`/session/${sessionId}/accept`, {});
  return response.data;
}

export async function fetchWallet(): Promise<WalletSummary> {
  const uid = await getStoredUserId();
  if (!uid) return { balance: 0, transactions: [] };

  const response = await api.get(`/tokens/${uid}`, { params: { limit: 20 } });
  const data = response.data?.data || {};
  const transactions = data.transactions || data.history || data.recentTransactions || [];
  return {
    balance: Number(data.balance ?? data.mind_tokens ?? data.tokenBalance ?? 0),
    transactions: transactions.map((transaction: any, index: number) => ({
      id: transaction.id || transaction.transactionId || `${transaction.reason}-${transaction.timestamp}`,
      amount: Number(transaction.amount || 0),
      reason: transaction.reason || 'Mindcraft reward',
      timestamp: Number(transaction.timestamp || transaction.createdAt || Date.now() - index * 3600000),
    })),
  };
}

export async function fetchLeaderboard() {
  const response = await api.get('/user/search', { params: { q: '', limit: 50 } });
  const users = response.data?.data || [];
  const leaders = users
    .map((user: any) => ({
      uid: user.uid,
      name: user.name || user.email || 'Mindcraft Learner',
      tokens: Number(user.mind_tokens ?? user.tokenBalance ?? user.tokens ?? user.balance ?? 0),
      department: user.department || user.badge || 'Peer Tutor',
      photoUrl: user.photoUrl || avatarFor(user.name || 'Learner', 'D9FF7A', '201A2E'),
    }))
    .sort((a: any, b: any) => b.tokens - a.tokens)
    .map((user: any, index: number) => ({ ...user, rank: index + 1 }));

  return leaders.length ? leaders : [
    { uid: 'demo-1', rank: 1, name: 'Muskan', tokens: 1200, department: 'Master Tutor', photoUrl: avatarFor('Muskan', 'DCFD8B', '151F00') },
    { uid: 'demo-2', rank: 2, name: 'Satya', tokens: 850, department: 'Top Contributor', photoUrl: avatarFor('Satya', 'DEB7FF', '2D0050') },
    { uid: 'demo-3', rank: 3, name: 'Kavita', tokens: 760, department: 'Rising Star', photoUrl: avatarFor('Kavita', 'FDD5BD', '432B1B') },
    { uid: 'demo-4', rank: 4, name: 'Sneha', tokens: 720, department: 'Helpful', photoUrl: avatarFor('Sneha') },
  ];
}
