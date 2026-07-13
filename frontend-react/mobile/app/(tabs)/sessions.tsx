import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  InteractionManager,
  Linking,
  Modal,
  Pressable,
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
import { scheduleSessionReminder } from '@/services/notifications';
import {
  acceptStudySession,
  bookStudySession,
  fallbackMates,
  fetchMates,
  fetchSessions,
  type Mate,
  type SessionMode,
  type StudySession,
} from '@/services/mindcraft';

const defaultDateTime = () => {
  const value = new Date(Date.now() + 24 * 60 * 60 * 1000);
  value.setMinutes(0, 0, 0);
  return value.toISOString().slice(0, 16);
};

const parseLocalDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

const SessionCard = memo(function SessionCard({
  session,
  isHost,
  onAccept,
}: {
  session: StudySession;
  isHost: boolean;
  onAccept: (session: StudySession) => void;
}) {
  const isOnline = session.mode === 'Online';
  const when = session.scheduledAt ? new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Time pending';

  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionTop}>
        <Text style={styles.modeBadge}>{isOnline ? 'Online' : 'Offline'}</Text>
        <Text style={styles.status}>{session.status}</Text>
      </View>
      <Text style={styles.sessionTitle}>{session.skill}</Text>
      <Text style={styles.sessionMeta}>With {session.peerName || 'Study Partner'} • {when}</Text>
      {isOnline ? (
        <TouchableOpacity onPress={() => session.meetLink && Linking.openURL(session.meetLink)} style={styles.linkBox}>
          <Text style={styles.linkLabel}>Meeting Link</Text>
          <Text style={styles.linkText}>{session.meetLink || 'Link appears after acceptance'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.locationBox}>
          <Text style={styles.linkLabel}>Meeting Location</Text>
          <Text style={styles.linkText}>{session.location || 'Campus location pending'}</Text>
        </View>
      )}
      {session.status === 'Pending' && isHost && (
        <TouchableOpacity onPress={() => onAccept(session)} style={styles.acceptButton}>
          <Text style={styles.acceptText}>Accept Session</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const BookSessionModal = memo(function BookSessionModal({
  visible,
  mates,
  loading,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  mates: Mate[];
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: { partnerUid: string; skill: string; scheduledAt: number; mode: SessionMode; location: string; notes: string }) => void;
}) {
  const { showAlert } = useGlobalAlert();
  const [partnerUid, setPartnerUid] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<SessionMode>('Online');
  const [dateTime, setDateTime] = useState(defaultDateTime());
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPartnerUid(mates[0]?.id || '');
    setTopic(mates[0]?.skill || '');
    setMode('Online');
    setDateTime(defaultDateTime());
    setLocation('');
    setNotes('');
  }, [mates, visible]);

  const submit = useCallback(() => {
    const scheduledAt = parseLocalDate(dateTime);
    if (!partnerUid || !topic.trim() || !scheduledAt) {
      showAlert({ type: 'warning', title: 'Session details needed', message: 'Choose a mate, topic, and valid date/time.' });
      return;
    }
    if (mode === 'Offline' && !location.trim()) {
      showAlert({ type: 'warning', title: 'Location needed', message: 'Offline sessions need a meeting location.' });
      return;
    }
    onSubmit({ partnerUid, skill: topic.trim(), scheduledAt, mode, location: location.trim(), notes: notes.trim() });
  }, [dateTime, location, mode, notes, onSubmit, partnerUid, showAlert, topic]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.composer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Book Session</Text>
              <Text style={styles.modalSub}>Online gets a Meet link. Offline needs a location.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>x</Text>
            </Pressable>
          </View>

          <FlatList
            data={mates}
            horizontal
            keyExtractor={(mate) => mate.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setPartnerUid(item.id);
                  setTopic(current => current || item.skill);
                }}
                style={[styles.matePill, partnerUid === item.id && styles.matePillActive]}>
                <Text style={[styles.matePillText, partnerUid === item.id && styles.matePillTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.pillList}
            showsHorizontalScrollIndicator={false}
            {...LOW_MEMORY_LIST_PROPS}
          />

          <View style={styles.segment}>
            {(['Online', 'Offline'] as SessionMode[]).map((item) => (
              <TouchableOpacity key={item} onPress={() => setMode(item)} style={[styles.segmentButton, mode === item && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === item && styles.segmentTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput value={topic} onChangeText={setTopic} placeholder="Topic, e.g. DSA" placeholderTextColor={palette.muted} style={styles.input} />
          <TextInput value={dateTime} onChangeText={setDateTime} placeholder="YYYY-MM-DDTHH:mm" placeholderTextColor={palette.muted} style={styles.input} />
          {mode === 'Online' ? (
            <View style={styles.linkBox}>
              <Text style={styles.linkLabel}>Meeting Link</Text>
              <Text style={styles.linkText}>https://meet.google.com/abc-defg-hij</Text>
            </View>
          ) : (
            <TextInput value={location} onChangeText={setLocation} placeholder="Meeting Location" placeholderTextColor={palette.muted} style={styles.input} />
          )}
          <TextInput value={notes} onChangeText={setNotes} placeholder="Notes" placeholderTextColor={palette.muted} style={[styles.input, styles.notes]} multiline />

          <TouchableOpacity onPress={submit} disabled={loading} style={styles.submitButton}>
            <Text style={styles.submitText}>{loading ? 'Booking...' : 'Book Session'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

export default function SessionsScreen() {
  const { currentUser } = useAuth();
  const { showAlert } = useGlobalAlert();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [mates, setMates] = useState<Mate[]>(fallbackMates);
  const [showBooker, setShowBooker] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    return Promise.all([fetchSessions(), fetchMates()])
      .then(([sessionRows, mateRows]) => {
        setSessions(sessionRows);
        setMates(mateRows.length ? mateRows : fallbackMates);
      })
      .catch(() => {
        setSessions([]);
        setMates(fallbackMates);
      });
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(load);
    return () => task.cancel();
  }, [load]);

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => a.scheduledAt - b.scheduledAt), [sessions]);

  const handleBook = useCallback(async (payload: { partnerUid: string; skill: string; scheduledAt: number; mode: SessionMode; location: string; notes: string }) => {
    setLoading(true);
    try {
      const created = await bookStudySession(payload);
      await scheduleSessionReminder({
        sessionId: created.sessionId,
        mode: payload.mode,
        topic: payload.skill,
        scheduledAt: payload.scheduledAt,
      });
      setSessions(current => [created, ...current]);
      setShowBooker(false);
      showAlert({ type: 'success', title: 'Session requested', message: 'A local reminder is set for 15 minutes before the session.' });
    } catch {
      // Axios interceptor shows network/backend failures.
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  const handleAccept = useCallback(async (session: StudySession) => {
    try {
      await acceptStudySession(session.sessionId);
      await scheduleSessionReminder({
        sessionId: session.sessionId,
        mode: session.mode,
        topic: session.skill,
        scheduledAt: session.scheduledAt,
      });
      setSessions(current => current.map(item => item.sessionId === session.sessionId ? { ...item, status: 'Upcoming', meetLink: item.meetLink || 'https://meet.google.com/abc-defg-hij' } : item));
      showAlert({ type: 'success', title: 'Session accepted', message: 'Reminder scheduled for both online and offline prep.' });
    } catch {
      // Shared interceptor handles the alert.
    }
  }, [showAlert]);

  const renderSession = useCallback(({ item }: { item: StudySession }) => (
    <SessionCard session={item} isHost={item.teacherUid === currentUser?.uid} onAccept={handleAccept} />
  ), [currentUser?.uid, handleAccept]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={sortedSessions}
        renderItem={renderSession}
        keyExtractor={(item) => item.sessionId}
        ListHeaderComponent={(
          <>
            <View style={styles.header}>
              <Text style={styles.kicker}>Sessions</Text>
              <Text style={styles.title}>Plan your study meetups</Text>
            </View>
            <TouchableOpacity onPress={() => setShowBooker(true)} style={styles.bookButton}>
              <Text style={styles.bookText}>Book a Session</Text>
            </TouchableOpacity>
          </>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No sessions yet. Book your first one with a recommended mate.</Text>}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...LOW_MEMORY_LIST_PROPS}
      />
      <BookSessionModal visible={showBooker} mates={mates} loading={loading} onClose={() => setShowBooker(false)} onSubmit={handleBook} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.surface },
  content: { padding: 20, paddingBottom: 120, gap: 14 },
  header: { backgroundColor: palette.peach, borderRadius: 32, padding: 22 },
  kicker: { color: palette.ink, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: palette.ink, fontSize: 30, fontWeight: '900', marginTop: 6 },
  bookButton: { backgroundColor: palette.lime, borderRadius: radii.pill, paddingVertical: 15, alignItems: 'center' },
  bookText: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  sessionCard: { backgroundColor: palette.card, borderRadius: radii.xl, padding: 18, borderWidth: 1, borderColor: palette.line },
  sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeBadge: { color: palette.ink, backgroundColor: palette.purpleSoft, borderRadius: radii.pill, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 6, fontWeight: '900' },
  status: { color: palette.muted, fontWeight: '900' },
  sessionTitle: { color: palette.ink, fontSize: 22, fontWeight: '900', marginTop: 16 },
  sessionMeta: { color: palette.muted, fontWeight: '700', marginTop: 6 },
  linkBox: { backgroundColor: palette.cyanSoft, borderRadius: radii.xl, padding: 14, marginTop: 14 },
  locationBox: { backgroundColor: palette.peachSoft, borderRadius: radii.xl, padding: 14, marginTop: 14 },
  linkLabel: { color: palette.ink, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  linkText: { color: palette.ink, fontSize: 15, fontWeight: '800', marginTop: 5 },
  acceptButton: { marginTop: 14, alignSelf: 'flex-start', backgroundColor: palette.purple, borderRadius: radii.pill, paddingHorizontal: 18, paddingVertical: 11 },
  acceptText: { color: '#FFFFFF', fontWeight: '900' },
  empty: { color: palette.muted, textAlign: 'center', fontWeight: '800', marginTop: 36 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 26, 46, 0.42)' },
  composer: { backgroundColor: palette.surface, borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 20, gap: 14, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { color: palette.ink, fontSize: 24, fontWeight: '900' },
  modalSub: { color: palette.muted, fontWeight: '700', marginTop: 3, maxWidth: 250 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: palette.muted, fontSize: 24, fontWeight: '900', marginTop: -2 },
  pillList: { gap: 10 },
  matePill: { backgroundColor: palette.card, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: palette.line },
  matePillActive: { backgroundColor: palette.purple, borderColor: palette.purple },
  matePillText: { color: palette.muted, fontWeight: '900' },
  matePillTextActive: { color: '#FFFFFF' },
  segment: { flexDirection: 'row', backgroundColor: palette.card, borderRadius: radii.pill, padding: 5 },
  segmentButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radii.pill },
  segmentActive: { backgroundColor: palette.ink },
  segmentText: { color: palette.muted, fontWeight: '900' },
  segmentTextActive: { color: '#FFFFFF' },
  input: { backgroundColor: palette.card, borderRadius: radii.xl, padding: 15, color: palette.ink, fontWeight: '800', borderWidth: 1, borderColor: palette.line },
  notes: { minHeight: 84, textAlignVertical: 'top' },
  submitButton: { backgroundColor: palette.lime, borderRadius: radii.pill, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: palette.ink, fontSize: 16, fontWeight: '900' },
});
