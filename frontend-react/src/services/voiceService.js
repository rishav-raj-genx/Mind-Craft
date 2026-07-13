import api from '../config/api';

export const voiceService = {
  search: async (audioBlob, languageCode = 'en-IN', fileName = 'voice-search.webm') => {
    const formData = new FormData();
    formData.append('audio', audioBlob, fileName);
    formData.append('languageCode', languageCode);

    const response = await api.post('/voice-search', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getLanguages: async () => {
    const response = await api.get('/voice-search/languages');
    return response.data;
  }
};
