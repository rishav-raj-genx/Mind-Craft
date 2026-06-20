/**
 * constants.js — App-wide constants mirrored from the Android client
 *
 * Keeps the backend in sync with the Kotlin Constants.kt values so that
 * Firestore documents written by either side are always compatible.
 *
 * @see app/src/main/java/com/mindcraft/app/utils/Constants.kt
 */

// ── Firestore Collection Names ────────────────────────────────────────
const COLLECTION_USERS          = 'users';
const COLLECTION_MATCH_REQUESTS = 'matchRequests';
const COLLECTION_MATCHES        = 'matches';
const COLLECTION_MESSAGES       = 'messages';
const COLLECTION_CHATS          = 'chats';
const COLLECTION_SESSIONS       = 'sessions';
const COLLECTION_TOKEN_LEDGER   = 'tokenLedger';
const COLLECTION_ACTIVITY_LOG   = 'activityLog';

// ── Match Request Status ──────────────────────────────────────────────
const STATUS_PENDING  = 'pending';
const STATUS_ACCEPTED = 'accepted';
const STATUS_DECLINED = 'declined';

// ── Session Status ────────────────────────────────────────────────────
const SESSION_UPCOMING  = 'upcoming';
const SESSION_COMPLETED = 'completed';
const SESSION_CANCELLED = 'cancelled';

// ── Session Mode ──────────────────────────────────────────────────────
const MODE_ONLINE    = 'Online';
const MODE_IN_PERSON = 'In-Person';

// ── Token Economy Rewards ─────────────────────────────────────────────
const TOKENS_FORUM_ANSWER      = 10;
const TOKENS_SESSION_COMPLETE   = 25;
const TOKENS_STREAK_5           = 15;
const TOKENS_STREAK_10          = 30;
const TOKENS_STREAK_30          = 100;

// ── Predefined Skills (matches Android SKILLS_LIST) ───────────────────
const SKILLS_LIST = [
  'Python',
  'Java',
  'Kotlin',
  'DSA',
  'Machine Learning',
  'Web Dev',
  'React',
  'SQL',
  'UI/UX Design',
  'Figma',
  'Mathematics',
  'Physics',
  'Chemistry',
  'English Communication',
  'Public Speaking',
  'Graphic Design',
  'Video Editing',
  'Excel/Sheets',
  'Cybersecurity',
  'Cloud Computing',
  'Arduino/IoT',
  'Circuit Design',
  'CAD',
  'Economics',
  'Accounting',
];

// ── Year Options ──────────────────────────────────────────────────────
const YEAR_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Faculty',
];

// ── Accepted Audio MIME Types for Voice Search ────────────────────────
const ALLOWED_AUDIO_MIMES = [
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
];

// ── Max Audio Upload Size (10 MB) ─────────────────────────────────────
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

module.exports = {
  // Collections
  COLLECTION_USERS,
  COLLECTION_MATCH_REQUESTS,
  COLLECTION_MATCHES,
  COLLECTION_MESSAGES,
  COLLECTION_CHATS,
  COLLECTION_SESSIONS,
  COLLECTION_TOKEN_LEDGER,
  COLLECTION_ACTIVITY_LOG,

  // Statuses
  STATUS_PENDING,
  STATUS_ACCEPTED,
  STATUS_DECLINED,
  SESSION_UPCOMING,
  SESSION_COMPLETED,
  SESSION_CANCELLED,
  MODE_ONLINE,
  MODE_IN_PERSON,

  // Tokens
  TOKENS_FORUM_ANSWER,
  TOKENS_SESSION_COMPLETE,
  TOKENS_STREAK_5,
  TOKENS_STREAK_10,
  TOKENS_STREAK_30,

  // Lists
  SKILLS_LIST,
  YEAR_OPTIONS,

  // Audio validation
  ALLOWED_AUDIO_MIMES,
  MAX_AUDIO_SIZE_BYTES,
};
