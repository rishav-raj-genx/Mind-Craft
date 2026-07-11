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

const extractChatContent = (data) => {
  const message = data?.choices?.[0]?.message;
  const content = message?.content ?? data?.choices?.[0]?.text ?? data?.output_text ?? data?.content;

  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        return part?.text || part?.content || '';
      })
      .join('')
      .trim();
  }

  return '';
};

const normalizeHint = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const isGenericStudyHint = (hint, { title, content, tag }) => {
  const text = normalizeHint(hint);
  if (!text) return true;

  const genericMarkers = [
    'start by identifying the core idea',
    'break the question into definitions',
    'key variables, and one simple example',
    'पहले',
    'मुख्य अवधारणा',
    'परिभाषा, ज़रूरी बिंदुओं',
  ];
  const markerHits = genericMarkers.filter(marker => text.includes(normalizeHint(marker))).length;

  const anchors = [title, content, tag]
    .join(' ')
    .split(/[^a-zA-Z0-9+#]+/)
    .map(token => token.trim().toLowerCase())
    .filter(token => token.length >= 4 && !['what', 'when', 'where', 'which', 'this', 'that', 'with', 'from'].includes(token));
  const uniqueAnchors = Array.from(new Set(anchors)).slice(0, 8);
  const anchorHits = uniqueAnchors.filter(token => text.includes(token.replace(/^#/, ''))).length;

  return markerHits >= 2 && anchorHits <= 1;
};

const createFallbackStudyHint = ({ title, content, tag }) => {
  const source = `${title || ''} ${content || ''}`.toLowerCase();
  const topic = title || content || 'this concept';
  const subject = tag && tag !== '#Other' ? tag.replace(/^#/, '') : 'the topic';
  const includes = (...terms) => terms.some(term => source.includes(term));

  if (includes('closure')) {
    return [
      'English: A closure happens when an inner function remembers variables from its outer function even after the outer function has finished. Trace which variables are being captured.',
      'Hindi: Closure में inner function, outer function के खत्म होने के बाद भी उसकी variables को याद रखता है। पहले देखें कौन-सी variables capture हो रही हैं।',
    ].join('\n');
  }

  if (includes('base case', 'recursion', 'recursive')) {
    return [
      'English: In recursion, the base case is the stopping condition. Identify the smallest input where the answer is already known, then build the recursive step from there.',
      'Hindi: Recursion में base case रोकने की शर्त होती है। सबसे छोटा input पहचानें जिसका answer सीधे पता हो, फिर recursive step बनाएं।',
    ].join('\n');
  }

  if (includes('semantic tag', 'semantic html', 'html')) {
    return [
      'English: Semantic HTML tags describe meaning, not just layout. Think of tags like header, nav, main, article, section, and footer as labels for page structure.',
      'Hindi: Semantic HTML tags layout नहीं, meaning बताते हैं। header, nav, main, article, section और footer page structure को साफ़ बनाते हैं।',
    ].join('\n');
  }

  if (includes('balance', 'microeconomic', 'microeconomics', 'equilibrium', 'demand', 'supply')) {
    return [
      'English: In microeconomics, balance usually means equilibrium: the point where demand and supply are equal. Compare what buyers want with what sellers offer.',
      'Hindi: Microeconomics में balance अक्सर equilibrium होता है, जहाँ demand और supply बराबर होती हैं। Buyers की demand और sellers की supply मिलाकर सोचें।',
    ].join('\n');
  }

  if (includes('list', 'array', 'linked list')) {
    return [
      'English: A list stores items in order. Focus on how elements are added, accessed, removed, and whether positions/indexes matter in the problem.',
      'Hindi: List items को order में store करती है। देखें elements कैसे add, access और remove होते हैं, और index/position क्यों important है।',
    ].join('\n');
  }

  if (includes('fork', 'process', 'os', 'operating system')) {
    return [
      'English: Fork creates a new child process from an existing process. Track parent and child separately because both may continue executing after the fork call.',
      'Hindi: Fork existing process से नया child process बनाता है। Parent और child को अलग-अलग trace करें क्योंकि दोनों आगे execute कर सकते हैं।',
    ].join('\n');
  }

  return [
    `English: For ${subject}, focus on "${topic}". Write the exact definition, connect it to the given question, and test it with one tiny example before answering.`,
    `Hindi: ${subject} में "${topic}" पर ध्यान दें। पहले सही definition लिखें, उसे question से जोड़ें, फिर एक छोटा example बनाकर answer सोचें।`,
  ].join('\n');
};

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

  const title = String(doubt?.title || '').trim();
  const content = String(doubt?.content || '').trim();
  const tag = String(doubt?.tag || 'General').trim();

  if (!title || !content) {
    return { hint: '', model, usage: null };
  }

  if (!API_KEY) {
    if (process.env.SARVAM_HINT_FALLBACK !== 'false') {
      return {
        hint: createFallbackStudyHint({ title, content, tag }),
        model,
        usage: null,
        fallback: true,
        warning: 'Sarvam AI API key not configured. Set SARVAM_API_KEY in .env',
      };
    }

    throw Object.assign(
      new Error('Sarvam AI API key not configured. Set SARVAM_API_KEY in .env'),
      { statusCode: 503 },
    );
  }

  const callSarvamChat = async (selectedModel) => {
    const response = await axios.post(CHAT_URL, {
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: [
            'You are MindCraft AI Assist for Indian college students.',
            'Generate a brief conceptual study hint, not a full solution.',
            'Respond bilingually with English and Hindi in simple language.',
            'Keep it under 90 words total.',
            'Make the hint specific to the exact title, details, and tag.',
            'Do not use generic wording like "identify the core idea" unless you name the actual concept from the doubt.',
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
      reasoning_effort: 'none',
      max_tokens: 220,
    }, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'api-subscription-key': API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: Number(process.env.SARVAM_CHAT_TIMEOUT_MS || 10_000),
    });

    const data = response.data;
    const hint = extractChatContent(data);

    return {
      hint,
      model: data?.model || selectedModel,
      usage: data?.usage || null,
      raw: data,
    };
  };

  try {
    let result = await callSarvamChat(model);
    if (!result.hint && model !== 'sarvam-105b') {
      console.warn(`Sarvam AI returned empty hint with ${model}; retrying with sarvam-105b`);
      result = await callSarvamChat('sarvam-105b');
    }

    if (!result.hint || isGenericStudyHint(result.hint, { title, content, tag })) {
      return {
        hint: createFallbackStudyHint({ title, content, tag }),
        model: result.model || model,
        usage: result.usage || null,
        fallback: true,
        warning: result.hint ? 'Sarvam AI returned a generic repeated hint.' : 'Sarvam AI returned an empty response.',
      };
    }

    return {
      hint: result.hint,
      model: result.model,
      usage: result.usage,
      fallback: false,
    };
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const body = err.response.data;

      console.error(`❌ Sarvam AI chat API error (${status}):`, body);

      if (process.env.SARVAM_HINT_FALLBACK !== 'false') {
        return {
          hint: createFallbackStudyHint({ title, content, tag }),
          model,
          usage: null,
          fallback: true,
          warning: `Sarvam AI study hint failed: ${body?.message || body?.error || 'Unknown error'}`,
        };
      }

      throw Object.assign(new Error(`Sarvam AI study hint failed: ${body?.message || body?.error || 'Unknown error'}`), { statusCode: status >= 500 ? 503 : 400 });
    }

    console.error('❌ Sarvam AI chat network error:', err.message);
    if (process.env.SARVAM_HINT_FALLBACK !== 'false') {
      return {
        hint: createFallbackStudyHint({ title, content, tag }),
        model,
        usage: null,
        fallback: true,
        warning: 'Unable to reach Sarvam AI chat service.',
      };
    }

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
  isGenericStudyHint,
};
