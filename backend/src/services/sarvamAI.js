/**
 * sarvamAI.js — Sarvam AI Service Wrapper
 *
 * Wraps Sarvam AI REST APIs for Indic speech-to-text and chat completion.
 *
 * @see https://docs.sarvam.ai/
 */

const axios    = require('axios');
const FormData = require('form-data');

const STT_URL  = process.env.SARVAM_STT_URL  || 'https://api.sarvam.ai/speech-to-text';
const CHAT_URL = process.env.SARVAM_CHAT_URL || 'https://api.sarvam.ai/v1/chat/completions';
const API_KEY  = process.env.SARVAM_API_KEY  || '';

/**
 * Supported language codes (BCP-47) for Sarvam AI STT.
 * Each maps to an Indian regional language.
 */
const SUPPORTED_LANGUAGES = {
  'hi-IN': 'Hindi',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'bn-IN': 'Bengali',
  'kn-IN': 'Kannada',
  'mr-IN': 'Marathi',
  'gu-IN': 'Gujarati',
  'ml-IN': 'Malayalam',
  'pa-IN': 'Punjabi',
  'or-IN': 'Odia',
  'as-IN': 'Assamese',
  'ur-IN': 'Urdu',
  'en-IN': 'English (India)',
};

/**
 * Transcribes an audio buffer using Sarvam AI's speech-to-text API.
 *
 * @param {Buffer} audioBuffer    — Raw audio file bytes
 * @param {string} originalName   — Original filename (e.g. 'query.wav')
 * @param {string} mimeType       — MIME type (e.g. 'audio/wav')
 * @param {object} [options]
 * @param {string} [options.languageCode='hi-IN'] — BCP-47 language code
 * @param {string} [options.model='saaras:v3']     — Sarvam model version
 * @returns {Promise<{ transcript: string, languageCode: string, confidence: number }>}
 */
async function transcribeAudio(audioBuffer, originalName, mimeType, options = {}) {
  const {
    languageCode = 'hi-IN',
    model        = 'saaras:v3',
  } = options;

  if (!API_KEY) {
    throw Object.assign(
      new Error('Sarvam AI API key not configured. Set SARVAM_API_KEY in .env'),
      { statusCode: 503 },
    );
  }

  // Build multipart form data
  const form = new FormData();
  form.append('file', audioBuffer, {
    filename:    originalName || 'audio.wav',
    contentType: mimeType     || 'audio/wav',
  });
  form.append('language_code', languageCode);
  form.append('model', model);
  form.append('with_timestamps', 'false');

  try {
    const response = await axios.post(STT_URL, form, {
      headers: {
        ...form.getHeaders(),
        'api-subscription-key': API_KEY,
      },
      timeout: 30_000, // 30 s timeout
      maxContentLength: 20 * 1024 * 1024, // 20 MB max response
    });

    const data = response.data;

    return {
      transcript:   data.transcript  || '',
      languageCode: data.language_code || languageCode,
      confidence:   data.confidence   || null,
    };
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const body   = err.response.data;

      console.error(`❌ Sarvam AI API error (${status}):`, body);

      throw Object.assign(
        new Error(
          `Sarvam AI transcription failed: ${body?.message || body?.error || 'Unknown error'}`,
        ),
        { statusCode: status >= 500 ? 503 : 400 },
      );
    }

    // Network / timeout error
    console.error('❌ Sarvam AI network error:', err.message);
    throw Object.assign(
      new Error('Unable to reach Sarvam AI service. Please try again.'),
      { statusCode: 503 },
    );
  }
}

/**
 * Generates a short bilingual study hint for a forum doubt using Sarvam's
 * Indic LLM chat-completion endpoint.
 *
 * @param {object} doubt
 * @param {string} doubt.title
 * @param {string} doubt.content
 * @param {string} [doubt.tag]
 * @param {object} [options]
 * @param {string} [options.model='sarvam-30b']
 * @returns {Promise<{ hint: string, model: string, usage: object | null }>}
 */
async function generateStudyHint(doubt, options = {}) {
  const {
    model = process.env.SARVAM_CHAT_MODEL || 'sarvam-30b',
  } = options;

  if (!API_KEY) {
    throw Object.assign(
      new Error('Sarvam AI API key not configured. Set SARVAM_API_KEY in .env'),
      { statusCode: 503 },
    );
  }

  const title = String(doubt?.title || '').trim();
  const content = String(doubt?.content || '').trim();
  const tag = String(doubt?.tag || 'General').trim();

  if (!title || !content) {
    return { hint: '', model, usage: null };
  }

  try {
    const response = await axios.post(CHAT_URL, {
      model,
      messages: [
        {
          role: 'system',
          content: [
            'You are MindCraft AI Assist for Indian college students.',
            'Generate a brief conceptual study hint, not a full solution.',
            'Respond bilingually with English and Hindi in simple language.',
            'Keep it under 90 words total.',
            'Use this exact format:',
            'English: <hint>',
            'Hindi: <hint in Devanagari>',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `Subject/tag: ${tag}`,
            `Question title: ${title}`,
            `Question details: ${content}`,
          ].join('\n'),
        },
      ],
      temperature: 0.2,
      max_tokens: 220,
    }, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'api-subscription-key': API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 20_000,
    });

    const data = response.data;
    const hint = data?.choices?.[0]?.message?.content?.trim() || '';

    return {
      hint,
      model: data?.model || model,
      usage: data?.usage || null,
    };
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const body = err.response.data;

      console.error(`❌ Sarvam AI chat API error (${status}):`, body);

      throw Object.assign(
        new Error(
          `Sarvam AI study hint failed: ${body?.message || body?.error || 'Unknown error'}`,
        ),
        { statusCode: status >= 500 ? 503 : 400 },
      );
    }

    console.error('❌ Sarvam AI chat network error:', err.message);
    throw Object.assign(
      new Error('Unable to reach Sarvam AI chat service. Please try again.'),
      { statusCode: 503 },
    );
  }
}

module.exports = {
  generateStudyHint,
  transcribeAudio,
  SUPPORTED_LANGUAGES,
};
