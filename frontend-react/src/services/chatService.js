import api, { API_BASE_URL } from '../config/api';

export const chatService = {
  getHistory: async (matchId, before = null) => {
    const params = before ? { before } : {};
    const response = await api.get(`/chat/${matchId}/history`, { params });
    return response.data;
  },

  sendMessage: async (matchId, text) => {
    const response = await api.post(`/chat/${matchId}/send`, { text });
    return response.data;
  },

  getThreads: async (uid) => {
    const response = await api.get(`/chat/threads/${uid}`);
    return response.data;
  },

  getThreadDetail: async (matchId) => {
    const response = await api.get(`/chat/${matchId}/detail`);
    return response.data;
  },

  getOrCreateThread: async (partnerUid) => {
    const response = await api.post(`/chat/thread`, { partnerUid });
    return response.data;
  }
};

export class ChatWebSocket {
  constructor(matchId, token, onMessage, onTyping, onPresence) {
    this.matchId = matchId;
    this.token = token;
    this.onMessage = onMessage;
    this.onTyping = onTyping;
    this.onPresence = onPresence;
    this.shouldReconnect = true;
    
    // Replace http:// or https:// with ws:// or wss://
    const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws');
    this.wsUrl = `${wsBaseUrl}/ws?token=${encodeURIComponent(token)}`;
    
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.joinRoom();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && this.onMessage) {
          this.onMessage(data);
        } else if (data.type === 'typing' && this.onTyping) {
          this.onTyping(data);
        } else if ((data.type === 'presence' || data.type === 'user_status') && this.onPresence) {
          this.onPresence(data);
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    this.ws.onclose = () => {
      if (!this.shouldReconnect) return;
      console.log('WebSocket disconnected. Reconnecting in 3s...');
      setTimeout(() => {
        if (this.shouldReconnect) this.connect();
      }, 3000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.ws.close();
    };
  }

  joinRoom() {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'join', matchId: this.matchId }));
    }
  }

  sendMessage(text) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'message', matchId: this.matchId, text }));
      return true;
    } else {
      console.warn('WebSocket not open. Cannot send message.');
      return false;
    }
  }

  sendTyping() {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing', matchId: this.matchId }));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.onclose = null; // Prevent auto-reconnect
      this.ws.close();
    }
  }
}
