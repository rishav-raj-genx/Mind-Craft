import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGlobalAlert } from '@/components/GlobalAlertProvider';
import { LOW_MEMORY_LIST_PROPS } from '@/constants/list';
import { palette, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { getRealtimeUrl } from '@/services/api';
import {
  fetchChatHistory,
  fetchChatThreads,
  markChatRead,
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
} from '@/services/mindcraft';

const timeText = (value: number) => {
  if (!value) return 'New';
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
};

const ThreadRow = memo(function ThreadRow({ thread, onPress }: { thread: ChatThread; onPress: (thread: ChatThread) => void }) {
  const name = thread.partner?.name || thread.partner?.email || 'Study Partner';
  return (
    <TouchableOpacity onPress={() => onPress(thread)} style={styles.threadRow} activeOpacity={0.84}>
      <Image
        source={{ uri: thread.partner?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=D9FF7A&color=201A2E` }}
        style={styles.avatar}
        cachePolicy="memory-disk"
        contentFit="cover"
      />
      <View style={styles.threadText}>
        <View style={styles.threadTop}>
          <Text style={[styles.threadName, thread.unread && styles.unreadText]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.threadTime, thread.unread && styles.unreadPurple]}>{timeText(thread.lastMessageTime)}</Text>
        </View>
        <Text style={[styles.preview, thread.unread && styles.unreadText]} numberOfLines={1}>
          {thread.lastMessage || 'Say hello and start learning together.'}
        </Text>
      </View>
      {thread.unread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
});

const Bubble = memo(function Bubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  return (
    <View style={[styles.bubble, isMine ? styles.myBubble : styles.peerBubble]}>
      <Text style={styles.bubbleText}>{message.text}</Text>
      <Text style={styles.bubbleTime}>{timeText(message.timestamp)}</Text>
    </View>
  );
});

export default function ChatScreen() {
  const { currentUser } = useAuth();
  const { showAlert } = useGlobalAlert();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const socketRef = useRef<WebSocket | null>(null);

  const loadThreads = useCallback(() => {
    return fetchChatThreads()
      .then(setThreads)
      .catch(() => setThreads([]));
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadThreads();
    });
    return () => task.cancel();
  }, [loadThreads]);

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.lastMessageTime - a.lastMessageTime),
    [threads],
  );

  const openThread = useCallback(async (thread: ChatThread) => {
    setActiveThread(thread);
    setThreads(current => current.map(item => item.matchId === thread.matchId ? { ...item, unread: false } : item));
    try {
      const history = await fetchChatHistory(thread.matchId);
      setMessages(history);
      await markChatRead(thread.matchId);
    } catch {
      setMessages([]);
    }

    try {
      const token = await currentUser?.getIdToken();
      if (!token) return;
      socketRef.current?.close();
      const ws = new WebSocket(`${getRealtimeUrl()}/ws?token=${encodeURIComponent(token)}`);
      socketRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join', matchId: thread.matchId }));
      ws.onmessage = (event) => {
        const payload = JSON.parse(String(event.data));
        if (payload.type === 'message' && payload.matchId === thread.matchId) {
          setMessages(current => [...current, {
            messageId: payload.messageId,
            senderUid: payload.senderUid,
            text: payload.text,
            timestamp: Number(payload.timestamp),
            localId: payload.localId,
          }]);
          markChatRead(thread.matchId).catch(() => {});
        }
      };
    } catch {
      showAlert({ type: 'warning', title: 'Realtime unavailable', message: 'Messages still send through the backend, but live updates may need refresh.' });
    }
  }, [currentUser, showAlert]);

  useEffect(() => () => socketRef.current?.close(), []);

  const closeThread = useCallback(() => {
    socketRef.current?.close();
    setActiveThread(null);
    setMessages([]);
    loadThreads();
  }, [loadThreads]);

  const handleSend = useCallback(async () => {
    if (!activeThread || !draft.trim() || !currentUser) return;
    const text = draft.trim();
    const localId = `local-${Date.now()}`;
    setDraft('');
    setMessages(current => [...current, { messageId: localId, localId, senderUid: currentUser.uid, text, timestamp: Date.now(), read: false }]);

    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'message', matchId: activeThread.matchId, text, localId }));
      } else {
        const saved = await sendChatMessage(activeThread.matchId, text);
        setMessages(current => current.map(message => message.localId === localId ? saved : message));
      }
    } catch {
      showAlert({ type: 'error', title: 'Message not sent', message: 'Please check your connection and try again.' });
    }
  }, [activeThread, currentUser, draft, showAlert]);

  const keyThread = useCallback((thread: ChatThread) => thread.matchId, []);
  const keyMessage = useCallback((message: ChatMessage) => message.messageId || message.localId || `${message.timestamp}`, []);
  const renderThread = useCallback(({ item }: { item: ChatThread }) => <ThreadRow thread={item} onPress={openThread} />, [openThread]);
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <Bubble message={item} isMine={item.senderUid === currentUser?.uid} />
  ), [currentUser?.uid]);

  if (activeThread) {
    const partnerName = activeThread.partner?.name || 'Study Partner';
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.chatWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={closeThread} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.chatTitle} numberOfLines={1}>{partnerName}</Text>
          </View>
          <FlatList
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            {...LOW_MEMORY_LIST_PROPS}
          />
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message"
              placeholderTextColor={palette.muted}
              style={styles.input}
              multiline
            />
            <TouchableOpacity onPress={handleSend} style={styles.sendButton} activeOpacity={0.84}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={sortedThreads}
        renderItem={renderThread}
        keyExtractor={keyThread}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Text style={styles.kicker}>Messages</Text>
            <Text style={styles.title}>Real-time study chat</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No chats yet. Start from Find and book a mate.</Text>}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...LOW_MEMORY_LIST_PROPS}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.surface },
  content: { padding: 20, paddingBottom: 120, gap: 12 },
  header: { backgroundColor: palette.lime, borderRadius: 32, padding: 22, marginBottom: 8 },
  kicker: { color: palette.ink, fontWeight: '900', fontSize: 14, textTransform: 'uppercase' },
  title: { color: palette.ink, fontSize: 30, fontWeight: '900', marginTop: 6 },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: palette.purpleSoft },
  threadText: { flex: 1 },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  threadName: { flex: 1, color: palette.ink, fontSize: 17, fontWeight: '800' },
  threadTime: { color: palette.muted, fontWeight: '700' },
  preview: { color: palette.muted, fontWeight: '700', marginTop: 5 },
  unreadText: { fontWeight: '900', color: palette.ink },
  unreadPurple: { color: palette.purple, fontWeight: '900' },
  unreadDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: palette.limeDeep },
  empty: { color: palette.muted, fontWeight: '800', textAlign: 'center', marginTop: 40 },
  chatWrap: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.purpleSoft },
  backText: { color: palette.purple, fontSize: 32, fontWeight: '900', marginTop: -3 },
  chatTitle: { flex: 1, color: palette.ink, fontSize: 20, fontWeight: '900' },
  messageList: { padding: 16, paddingBottom: 24, gap: 10 },
  bubble: { maxWidth: '78%', borderRadius: 24, padding: 13 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: palette.lime },
  peerBubble: { alignSelf: 'flex-start', backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line },
  bubbleText: { color: palette.ink, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  bubbleTime: { color: palette.muted, fontSize: 11, fontWeight: '800', marginTop: 4, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: palette.card },
  input: { flex: 1, maxHeight: 96, backgroundColor: palette.surface, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, color: palette.ink, fontWeight: '700' },
  sendButton: { alignSelf: 'flex-end', backgroundColor: palette.purple, borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 13 },
  sendText: { color: '#FFFFFF', fontWeight: '900' },
});
