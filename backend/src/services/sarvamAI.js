/**
 * sarvamAI.js — Sarvam AI Speech-to-Text Service Wrapper
 *
 * Wraps the Sarvam AI REST API for converting regional language
 * audio into text. Supports 22 Indian languages via BCP-47 codes.
 *
 * @see https://docs.sarvam.ai/
 */

const axios    = require('axios');
const FormData = require('form-data');

const STT_URL = process.env.SARVAM_STT_URL || 'https://api.sarvam.ai/speech-to-text';
const API_KEY = process.env.SARVAM_API_KEY  || '';

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

module.exports = {
  transcribeAudio,
  SUPPORTED_LANGUAGES,
};
