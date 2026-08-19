import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { ReminderSettings } from './types';

const DAILY_REMINDER_ID = 'bp-daily-reminder';

export type ScheduleResult = 'scheduled' | 'cancelled' | 'denied' | 'unsupported';

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Expo Go on Android dropped the notifications native module in SDK 53, and
 * expo-notifications throws while it is being *imported* there - which takes the
 * whole app down. So the module is loaded lazily, and only where it can work.
 * Reminders need a development build on Android (`npx expo run:android`).
 */
export const remindersSupported = !(inExpoGo && Platform.OS === 'android');

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null = null;

function getNotifications(): NotificationsModule | null {
  if (!remindersSupported) return null;
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return cached;
}

async function ensureAndroidChannel(notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  await notifications.setNotificationChannelAsync('reminders', {
    name: 'Daily reminders',
    importance: notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/** Asks for permission the first time; returns true when we are allowed to notify. */
export async function requestPermission(): Promise<boolean> {
  const notifications = getNotifications();
  if (!notifications) return false;

  await ensureAndroidChannel(notifications);
  const current = await notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function cancelDailyReminder() {
  const notifications = getNotifications();
  if (!notifications) return;

  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === DAILY_REMINDER_ID)
      .map((n) => notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Replaces any existing reminder with one that repeats every day at the given
 * time, reporting why nothing was scheduled when that is the outcome.
 */
export async function scheduleDailyReminder(
  settings: ReminderSettings,
): Promise<ScheduleResult> {
  const notifications = getNotifications();
  if (!notifications) return 'unsupported';

  await cancelDailyReminder();
  if (!settings.enabled) return 'cancelled';

  const allowed = await requestPermission();
  if (!allowed) return 'denied';

  await notifications.scheduleNotificationAsync({
    content: {
      title: 'Blood pressure check',
      body: 'Time to take todays reading. Sit still for five minutes first.',
      data: { kind: DAILY_REMINDER_ID },
      ...(Platform.OS === 'android' ? { channelId: 'reminders' } : null),
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.hour,
      minute: settings.minute,
    },
  });
  return 'scheduled';
}
