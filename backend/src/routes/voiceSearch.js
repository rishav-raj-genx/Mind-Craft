/**
 * voiceSearch.js — Sarvam AI Vernacular Voice Search Route
 *
 * Receives audio blobs via multipart upload, validates MIME type and
 * file size at the API gate, transcribes via Sarvam AI, extracts the
 * skill intent, and feeds it into the peer matching engine.
 *
 * Endpoints:
 *   POST /api/voice-search — Upload audio → transcript → skill → matches
 */

const express = require('express');
const multer  = require('multer');
const rateLimit = require('express-rate-limit');
const router  = express.Router();

const { requireAuth } = require('../middleware/auth');
const { transcribeAudio, SUPPORTED_LANGUAGES } = require('../services/sarvamAI');
const { extractSkillIntent }  = require('../services/intentParser');
const { findMatches }         = require('../services/matchingEngine');
const {
  ALLOWED_AUDIO_MIMES,
  MAX_AUDIO_SIZE_BYTES,
} = require('../utils/constants');

// Rate limiting on voice search uploads (HIGH-10)
const voiceSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each user / IP to 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => req.user?.uid || req.user?.clerkUserId || req.ip,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many voice search requests. Please wait a minute before trying again.',
    });
  },
});

const isAllowedAudioMime = (mime) => {
  if (!mime) return false;
  const normalized = mime.toLowerCase().trim();
  const baseType = normalized.split(';')[0].trim();
  return ALLOWED_AUDIO_MIMES.includes(normalized) || ALLOWED_AUDIO_MIMES.includes(baseType);
};

// ── Multer configuration with strict validation ───────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAudioMime(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(
        `Invalid audio format: "${file.mimetype}". ` +
        `Accepted formats: audio/webm, audio/webm;codecs=opus, audio/wav, audio/mpeg, audio/ogg`,
      );
      err.statusCode = 415; // Unsupported Media Type
      cb(err, false);
    }
  },
});

/**
 * MIME-type and file-size verification middleware.
 *
 * Runs BEFORE the multer upload to catch oversized or wrongly-typed
 * requests at the API gate with clean error messages.
 */
function validateAudioHeaders(req, res, next) {
  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({
      success: false,
      error: 'Request must be multipart/form-data with an audio file.',
    });
  }

  // Check Content-Length if provided
  const contentLength = parseInt(req.headers['content-length'], 10);
  if (contentLength && contentLength > MAX_AUDIO_SIZE_BYTES) {
    return res.status(413).json({
      success: false,
      error: `Audio file too large. Maximum size: ${MAX_AUDIO_SIZE_BYTES / (1024 * 1024)} MB.`,
    });
  }

  next();
}

// ── POST /api/voice-search ────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  voiceSearchLimiter,
  validateAudioHeaders,
  upload.single('audio'),
  async (req, res, next) => {
    try {
      // ── Validate file presence ──────────────────────────────────
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No audio file provided. Send as multipart field named "audio".',
        });
      }

      const languageCode = req.body.languageCode || 'hi-IN';

      // Validate language code
      if (!SUPPORTED_LANGUAGES[languageCode]) {
        return res.status(400).json({
          success: false,
          error: `Unsupported language: "${languageCode}". Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`,
        });
      }

      const cleanMime = (req.file.mimetype || 'audio/webm').split(';')[0].trim().toLowerCase();
      let ext = '.webm';
      if (cleanMime === 'audio/wav' || cleanMime === 'audio/x-wav' || cleanMime === 'audio/wave') {
        ext = '.wav';
      } else if (cleanMime === 'audio/mpeg' || cleanMime === 'audio/mp3') {
        ext = '.mp3';
      } else if (cleanMime === 'audio/ogg') {
        ext = '.ogg';
      } else if (cleanMime === 'audio/mp4') {
        ext = '.m4a';
      }

      const originalName = req.file.originalname && req.file.originalname.includes('.')
        ? req.file.originalname
        : `voice-query${ext}`;

      // ── Step 1: Transcribe audio via Sarvam AI ──────────────────
      const transcription = await transcribeAudio(
        req.file.buffer,
        originalName,
        cleanMime,
        { languageCode },
      );

      // ── Step 2: Extract skill intent from transcript ────────────
      const intent = extractSkillIntent(transcription.transcript);

      // ── Step 3: Query matching engine if skill detected ─────────
      let matches = [];
      if (intent.skill) {
        try {
          matches = await findMatches(req.user.uid, {
            limit: 10,
            skillFilter: intent.skill,
          });
        } catch (err) {
          console.warn('⚠️  Match query skipped:', err.message);
        }
      }

      res.json({
        success: true,
        data: {
          transcript: transcription.transcript,
          language:   SUPPORTED_LANGUAGES[languageCode],
          detectedSkill: intent.skill,
          confidence:    intent.confidence,
          matchMethod:   intent.method,
          matches,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/voice-search/languages ───────────────────────────────────
router.get('/languages', (_req, res) => {
  res.json({
    success: true,
    data:    SUPPORTED_LANGUAGES,
  });
});

module.exports = router;
