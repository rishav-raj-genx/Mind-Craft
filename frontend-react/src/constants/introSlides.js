import {
  Sparkles,
  Users,
  MessageSquare,
  Trophy,
} from 'lucide-react';

export const INTRO_SLIDES = [
  {
    id: 1,
    step: '1 / 4',
    title: 'Welcome to Mindcraft',
    subtitle: 'Peer-to-Peer Academic Playground',
    description:
      'Master complex concepts, exchange academic skills with peers, and elevate your learning through collaborative 1-on-1 peer tutoring.',
    highlights: [
      'Collaborative Peer Learning',
      'Mutual Skill Exchange',
      'Verified Campus Community',
    ],
    icon: Sparkles,
    gradient: 'from-emerald-400 to-[#DCFD8B]',
    shadowColor: 'shadow-[0_0_40px_rgba(220,253,139,0.35)]',
    tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  {
    id: 2,
    step: '2 / 4',
    title: 'Smart Peer Matching',
    subtitle: 'Find Mates Who Teach What You Learn',
    description:
      'Search naturally with Sarvam AI vernacular voice search in Indian languages. Our matchmaking engine pairs you with compatible peers based on mutual skills and schedule.',
    highlights: [
      'Vernacular Voice Search (Hindi, Tamil, Telugu)',
      'Smart Mutual Skill Compatibility',
      'Instant Match Discovery',
    ],
    icon: Users,
    gradient: 'from-cyan-400 to-blue-500',
    shadowColor: 'shadow-[0_0_40px_rgba(56,189,248,0.35)]',
    tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  {
    id: 3,
    step: '3 / 4',
    title: 'Doubt Forum & Live Sessions',
    subtitle: 'Bilingual AI Hints & Real-Time Chat',
    description:
      'Post challenging doubts to receive instant bilingual AI hints and peer solutions. Schedule interactive 1-on-1 tutoring sessions with real-time chat, code sharing, and calendar sync.',
    highlights: [
      'Bilingual AI Hint Engine',
      'Real-Time Chat & Code Sharing',
      'Calendar-Integrated Tutoring',
    ],
    icon: MessageSquare,
    gradient: 'from-purple-400 to-[#BC84EE]',
    shadowColor: 'shadow-[0_0_40px_rgba(188,132,238,0.35)]',
    tagColor: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  },
  {
    id: 4,
    step: '4 / 4',
    title: 'Gamified Progress',
    subtitle: 'Tokens, Streaks, Badges & Leaderboard',
    description:
      'Earn Mind Tokens by answering doubts and tutoring. Maintain daily streaks with freeze shield protection, unlock milestone achievement badges, and climb the campus leaderboard.',
    highlights: [
      'Mind Token Economy (Earn by Teaching)',
      'Daily Streaks with Freeze Shields',
      'Weekly Campus Leaderboard & Badges',
    ],
    icon: Trophy,
    gradient: 'from-amber-400 to-orange-500',
    shadowColor: 'shadow-[0_0_40px_rgba(245,158,11,0.35)]',
    tagColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
];
