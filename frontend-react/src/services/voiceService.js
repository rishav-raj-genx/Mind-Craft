import api from '../config/api';

export const voiceService = {
  search: async (audioBlob, languageCode = 'en-IN') => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-search.webm');
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
