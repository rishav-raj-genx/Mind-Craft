import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

const isAndroidExpoGo =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
  Constants.expoVersion;

let notificationsPromise: Promise<NotificationsModule | null> | null = null;

async function getNotifications() {
  if (isAndroidExpoGo) return null;

  notificationsPromise ||= import('expo-notifications')
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      return Notifications;
    })
    .catch(() => null);

  return notificationsPromise;
}

export async function registerForLocalNotifications() {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('session-reminders', {
      name: 'Session Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#dcfd8b',
    });
  }

  return status === 'granted';
}

export async function scheduleSessionReminder({
  sessionId,
  mode,
  topic,
  scheduledAt,
}: {
  sessionId: string;
  mode: 'Online' | 'Offline' | 'In-Person';
  topic: string;
  scheduledAt: number;
}) {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const allowed = await registerForLocalNotifications();
  if (!allowed) return null;

  const reminderAt = scheduledAt - 15 * 60 * 1000;
  if (reminderAt <= Date.now()) return null;

  const readableMode = mode === 'In-Person' ? 'Offline' : mode;

  return Notifications.scheduleNotificationAsync({
    identifier: `mindcraft-session-${sessionId}`,
    content: {
      title: 'Mindcraft Session Reminder',
      body: `Your ${readableMode} session on ${topic} starts in 15 minutes!`,
      data: { sessionId, type: 'session_reminder' },
    },
    trigger: {
      channelId: 'session-reminders',
      date: new Date(reminderAt),
    } as import('expo-notifications').NotificationTriggerInput,
  });
}
