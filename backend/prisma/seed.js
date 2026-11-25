/**
 * Database Seed Script — Mindcraft Platform
 * Idempotently populates colleges, departments, skills, and standard badges.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COLLEGES = [
  { name: 'Stanford University', location: 'Stanford, CA, USA' },
  { name: 'Massachusetts Institute of Technology', location: 'Cambridge, MA, USA' },
  { name: 'Indian Institute of Technology Bombay', location: 'Mumbai, Maharashtra, India' },
  { name: 'Indian Institute of Technology Delhi', location: 'New Delhi, Delhi, India' },
  { name: 'BITS Pilani', location: 'Pilani, Rajasthan, India' },
  { name: 'Indian Institute of Technology Madras', location: 'Chennai, Tamil Nadu, India' },
  { name: 'University of California, Berkeley', location: 'Berkeley, CA, USA' },
  { name: 'Harvard University', location: 'Cambridge, MA, USA' },
  { name: 'Carnegie Mellon University', location: 'Pittsburgh, PA, USA' },
  { name: 'National University of Singapore', location: 'Queenstown, Singapore' },
  { name: 'University of Oxford', location: 'Oxford, United Kingdom' },
  { name: 'Indian Institute of Science', location: 'Bengaluru, Karnataka, India' },
];

const DEPARTMENTS = [
  { name: 'Computer Science & Engineering' },
  { name: 'Electrical & Electronics Engineering' },
  { name: 'Mechanical Engineering' },
  { name: 'Mathematics & Computing' },
  { name: 'Data Science & Artificial Intelligence' },
  { name: 'Physics & Applied Physics' },
  { name: 'Chemistry & Chemical Engineering' },
  { name: 'Civil & Environmental Engineering' },
  { name: 'Economics & Finance' },
  { name: 'Biotechnology & Bioinformatics' },
];

// Categorized Academic & Technical Skills (30+ skills)
const SKILLS = [
  // Computer Science & Programming
  { name: 'Data Structures' },
  { name: 'Algorithms' },
  { name: 'Python' },
  { name: 'JavaScript' },
  { name: 'TypeScript' },
  { name: 'C++' },
  { name: 'Java' },
  { name: 'SQL & Database Systems' },
  { name: 'Operating Systems' },
  { name: 'Computer Networks' },
  { name: 'Machine Learning' },
  { name: 'System Design' },

  // Mathematics
  { name: 'Calculus' },
  { name: 'Linear Algebra' },
  { name: 'Discrete Mathematics' },
  { name: 'Probability & Statistics' },
  { name: 'Differential Equations' },
  { name: 'Numerical Analysis' },

  // Electrical & Electronics Engineering
  { name: 'Digital Logic Design' },
  { name: 'Signals & Systems' },
  { name: 'Microprocessors & Microcontrollers' },
  { name: 'Analog Electronics' },
  { name: 'Control Systems' },

  // Mechanical & Physical Sciences
  { name: 'Engineering Mechanics' },
  { name: 'Thermodynamics' },
  { name: 'Fluid Mechanics' },
  { name: 'Organic Chemistry' },
  { name: 'Inorganic Chemistry' },
  { name: 'Quantum Physics' },
  { name: 'Electromagnetism' },
  { name: 'Biochemistry' },
  { name: 'Molecular Genetics' },
];

const BADGES = [
  // Streak & Milestone Badges
  {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    level: 1,
    emoji: '⚡',
    description: 'Maintained a perfect 7-day study streak this week',
  },
  {
    id: '7_day_streak',
    name: '7-Day Streak',
    level: 2,
    emoji: '🔥',
    description: 'Achieved a consecutive 7-day study streak',
  },
  {
    id: 'spark_starter',
    name: 'Spark Starter',
    level: 1,
    emoji: '🌱',
    description: 'Achieved a 3-day daily consistency streak',
  },
  {
    id: 'fortnight_focus',
    name: 'Fortnight Focus',
    level: 3,
    emoji: '🔥',
    description: 'Achieved a 14-day study streak',
  },
  {
    id: 'monthly_master',
    name: 'Monthly Master',
    level: 4,
    emoji: '🏆',
    description: 'Achieved a 30-day consistency streak',
  },
  {
    id: 'discipline_king',
    name: 'Discipline King',
    level: 5,
    emoji: '💎',
    description: 'Achieved a 60-day consistency streak',
  },
  {
    id: 'century_legend',
    name: 'Century Legend',
    level: 6,
    emoji: '👑',
    description: 'Achieved an epic 100-day consistency streak',
  },

  // Tutoring & Gamification Badges
  {
    id: 'master_tutor',
    name: 'Master Tutor',
    level: 3,
    emoji: '🎖️',
    description: 'Recognized master tutor with exceptional feedback across sessions',
  },
  {
    id: 'streak_champion',
    name: 'Streak Champion',
    level: 1,
    emoji: '🔥',
    description: 'Maintain a daily streak',
  },
  {
    id: 'session_pro',
    name: 'Session Pro',
    level: 1,
    emoji: '📚',
    description: 'Complete tutoring sessions',
  },
  {
    id: 'dsa_master',
    name: 'DSA Master',
    level: 1,
    emoji: '💻',
    description: 'DSA-related sessions',
  },
  {
    id: 'late_night_learner',
    name: 'Late Night Learner',
    level: 1,
    emoji: '🌙',
    description: 'Sessions after midnight',
  },
  {
    id: 'problem_solver',
    name: 'Problem Solver',
    level: 1,
    emoji: '🐛',
    description: 'Answer doubts in the forum',
  },
  {
    id: 'mentor',
    name: 'Mentor',
    level: 1,
    emoji: '🎓',
    description: 'Teach sessions as a tutor',
  },
  {
    id: 'top_rated',
    name: 'Top Rated',
    level: 1,
    emoji: '⭐',
    description: 'Earn high ratings (avg ≥ 4.0)',
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    level: 1,
    emoji: '🤝',
    description: 'Study with unique mates',
  },
  {
    id: 'wealthy_mind',
    name: 'Wealthy Mind',
    level: 1,
    emoji: '🪙',
    description: 'Accumulate Mind Tokens',
  },
];

async function main() {
  console.log('🌱 Starting idempotent database seed...');

  console.log(`Seeding ${COLLEGES.length} colleges...`);
  for (const college of COLLEGES) {
    await prisma.college.upsert({
      where: { name: college.name },
      update: { location: college.location },
      create: college,
    });
  }

  console.log(`Seeding ${DEPARTMENTS.length} departments...`);
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
  }

  console.log(`Seeding ${SKILLS.length} skills...`);
  for (const skill of SKILLS) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: {},
      create: skill,
    });
  }

  console.log(`Seeding ${BADGES.length} badges...`);
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { id: badge.id },
      update: {
        name: badge.name,
        level: badge.level,
        emoji: badge.emoji,
        description: badge.description,
      },
      create: badge,
    });
  }

  console.log('✅ Idempotent database seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
