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
  },

  editMessage: async (matchId, messageId, text) => {
    const response = await api.patch(`/chat/${matchId}/message/${messageId}`, { text });
    return response.data;
  },

  deleteMessage: async (matchId, messageId) => {
    const response = await api.delete(`/chat/${matchId}/message/${messageId}`);
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

  markRead(matchId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'read', matchId }));
    }
  }

  editMessage(matchId, messageId, text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'edit_message', matchId, messageId, text }));
    } else {
      chatService.editMessage(matchId, messageId, text);
    }
  }

  deleteMessage(matchId, messageId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'delete_message', matchId, messageId }));
    } else {
      chatService.deleteMessage(matchId, messageId);
    }
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
