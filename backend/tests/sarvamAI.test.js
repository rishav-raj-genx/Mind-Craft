jest.mock('axios', () => ({
  post: jest.fn(),
}));

process.env.SARVAM_API_KEY = 'test-key';

const axios = require('axios');
const { transcribeAudio } = require('../src/services/sarvamAI');

describe('Sarvam AI service resilience', () => {
  beforeEach(() => {
    process.env.SARVAM_STT_MAX_ATTEMPTS = '2';
    process.env.SARVAM_RETRY_BASE_DELAY_MS = '1';
    process.env.SARVAM_RETRY_MAX_DELAY_MS = '1';
  });

  it('rejects oversized audio before making a provider request', async () => {
    await expect(transcribeAudio(Buffer.alloc(10 * 1024 * 1024 + 1), 'large.wav', 'audio/wav'))
      .rejects.toMatchObject({ code: 'AUDIO_TOO_LARGE', statusCode: 413 });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('retries transient provider failures', async () => {
    axios.post
      .mockRejectedValueOnce({ response: { status: 503, data: {} } })
      .mockResolvedValueOnce({ data: { transcript: 'hello', language_code: 'en-IN' } });
    const result = await transcribeAudio(Buffer.from('audio'), 'voice.wav', 'audio/wav');
    expect(result.transcript).toBe('hello');
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry permanent 4xx errors (400, 401, 403, 413)', async () => {
    const errorCodes = [400, 401, 403, 413];
    for (const status of errorCodes) {
      axios.post.mockReset();
      axios.post.mockRejectedValue({ response: { status, data: { message: `Error ${status}` } } });
      await expect(transcribeAudio(Buffer.from('audio'), 'voice.wav', 'audio/wav'))
        .rejects.toThrow();
      expect(axios.post).toHaveBeenCalledTimes(1);
    }
  });
});
