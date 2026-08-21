import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { ReminderSettings, MedicationReminder } from './types';

export type ReminderKind = 'bp' | 'weight';

type ReminderSpec = {
  /** Tags the scheduled notification so each kind can be cancelled alone. */
  id: string;
  title: string;
  body: string;
  cadence: 'daily' | 'weekly';
};

const SPECS: Record<ReminderKind, ReminderSpec> = {
  bp: {
    id: 'bp-daily-reminder',
    title: 'Blood pressure check',
    body: 'Time to take todays reading. Sit still for five minutes first.',
    cadence: 'daily',
  },
  weight: {
    id: 'weight-weekly-reminder',
    title: 'Weekly weigh-in',
    body: 'Time to weigh yourself, before breakfast if you can.',
    cadence: 'weekly',
  },
};

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

/** Type-only, so it does not pull the native module in at runtime. */
type TriggerInput = Parameters<
  NotificationsModule['scheduleNotificationAsync']
>[0]['trigger'];

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

/** Cancels one kind of reminder, leaving the other kind and other apps alone. */
export async function cancelReminder(kind: ReminderKind) {
  const notifications = getNotifications();
  if (!notifications) return;

  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === SPECS[kind].id)
      .map((n) => notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Replaces any existing reminder of this kind with one that repeats at the given
 * time - daily for blood pressure, weekly for weight - reporting why nothing was
 * scheduled when that is the outcome.
 */
export async function scheduleReminder(
  kind: ReminderKind,
  settings: ReminderSettings,
): Promise<ScheduleResult> {
  const notifications = getNotifications();
  if (!notifications) return 'unsupported';

  const spec = SPECS[kind];
  await cancelReminder(kind);
  if (!settings.enabled) return 'cancelled';

  const allowed = await requestPermission();
  if (!allowed) return 'denied';

  const trigger: TriggerInput =
    spec.cadence === 'weekly'
      ? {
          type: notifications.SchedulableTriggerInputTypes.WEEKLY,
          // expo-notifications counts weekdays from 1 = Sunday.
          weekday: settings.weekday ?? 2,
          hour: settings.hour,
          minute: settings.minute,
        }
      : {
          type: notifications.SchedulableTriggerInputTypes.DAILY,
          hour: settings.hour,
          minute: settings.minute,
        };

  await notifications.scheduleNotificationAsync({
    content: {
      title: spec.title,
      body: spec.body,
      data: { kind: spec.id },
      ...(Platform.OS === 'android' ? { channelId: 'reminders' } : null),
    },
    trigger,
  });
  return 'scheduled';
}

export async function cancelMedicationReminders(medicationId: string) {
  const notifications = getNotifications();
  if (!notifications) return;

  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.medicationId === medicationId)
      .map((n) => notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function scheduleMedicationReminders(
  medication: MedicationReminder,
): Promise<ScheduleResult> {
  const notifications = getNotifications();
  if (!notifications) return 'unsupported';

  await cancelMedicationReminders(medication.id);
  if (!medication.enabled) return 'cancelled';

  const allowed = await requestPermission();
  if (!allowed) return 'denied';

  await Promise.all(
    medication.times.map((time, index) =>
      notifications.scheduleNotificationAsync({
        identifier: `med-${medication.id}-${index}`,
        content: {
          title: `Medication: ${medication.name}`,
          body: medication.instruction
            ? `Time to take your medication (${medication.instruction}).`
            : 'Time to take your medication.',
          data: { kind: 'medication', medicationId: medication.id, timeIndex: index },
          ...(Platform.OS === 'android' ? { channelId: 'reminders' } : null),
        },
        trigger: {
          type: notifications.SchedulableTriggerInputTypes.DAILY,
          hour: time.hour,
          minute: time.minute,
        },
      }),
    ),
  );
  return 'scheduled';
}

export async function rearmAllMedicationReminders(
  medications: MedicationReminder[],
): Promise<void> {
  const notifications = getNotifications();
  if (!notifications) return;

  for (const med of medications) {
    if (med.enabled) {
      await scheduleMedicationReminders(med);
    } else {
      await cancelMedicationReminders(med.id);
    }
  }
}

