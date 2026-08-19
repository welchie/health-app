import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cancelReminder, requestPermission, scheduleReminder } from '../notifications';

const mocked = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => {
  jest.clearAllMocks();
  (mocked.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
});

// The Android channel test replaces Platform.OS, which would otherwise leak.
afterEach(() => jest.restoreAllMocks());

describe('scheduleReminder', () => {
  it('schedules a repeating daily notification at the chosen time', async () => {
    const result = await scheduleReminder('bp', { enabled: true, hour: 7, minute: 45 });

    expect(result).toBe('scheduled');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: { type: 'daily', hour: 7, minute: 45 },
      }),
    );
  });

  it('schedules nothing when the reminder is switched off', async () => {
    const result = await scheduleReminder('bp', { enabled: false, hour: 7, minute: 45 });

    expect(result).toBe('cancelled');
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels the previous reminder before scheduling a new one', async () => {
    (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'old-1', content: { data: { kind: 'bp-daily-reminder' } } },
      { identifier: 'someone-elses', content: { data: { kind: 'other' } } },
    ]);

    await scheduleReminder('bp', { enabled: true, hour: 9, minute: 0 });

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-1');
  });

  it('reports refusal and schedules nothing when permission is denied', async () => {
    (mocked.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    (mocked.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    const result = await scheduleReminder('bp', { enabled: true, hour: 9, minute: 0 });

    expect(result).toBe('denied');
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('sets up an Android channel before scheduling', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    await scheduleReminder('bp', { enabled: true, hour: 6, minute: 30 });

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      'reminders',
      expect.objectContaining({ name: 'Daily reminders' }),
    );
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ channelId: 'reminders' }),
      }),
    );
  });
});

describe('requestPermission', () => {
  it('does not re-prompt when permission is already granted', async () => {
    await expect(requestPermission()).resolves.toBe(true);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('gives up without prompting when the OS will not ask again', async () => {
    (mocked.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });

    await expect(requestPermission()).resolves.toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('cancelReminder', () => {
  it('cancels only this apps reminders', async () => {
    (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'mine', content: { data: { kind: 'bp-daily-reminder' } } },
      { identifier: 'theirs', content: { data: {} } },
    ]);

    await cancelReminder('bp');

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('mine');
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('the weekly weight reminder', () => {
  it('schedules on a weekday rather than every day', async () => {
    const result = await scheduleReminder('weight', {
      enabled: true,
      hour: 7,
      minute: 30,
      weekday: 6,
    });

    expect(result).toBe('scheduled');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: { type: 'weekly', weekday: 6, hour: 7, minute: 30 },
      }),
    );
  });

  it('defaults to Monday when no day was chosen', async () => {
    await scheduleReminder('weight', { enabled: true, hour: 8, minute: 0 });

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ weekday: 2 }),
      }),
    );
  });

  it('carries its own wording, not the blood pressure wording', async () => {
    await scheduleReminder('weight', { enabled: true, hour: 8, minute: 0 });

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: 'Weekly weigh-in',
          data: { kind: 'weight-weekly-reminder' },
        }),
      }),
    );
  });
});

/** Two reminders share the notification queue, so cancelling must be surgical. */
describe('the two reminders coexisting', () => {
  const queue = [
    { identifier: 'bp-1', content: { data: { kind: 'bp-daily-reminder' } } },
    { identifier: 'weight-1', content: { data: { kind: 'weight-weekly-reminder' } } },
    { identifier: 'other-app', content: { data: { kind: 'something-else' } } },
  ];

  beforeEach(() => {
    (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(queue);
  });

  it('switching off the weigh-in leaves the blood pressure reminder alone', async () => {
    await scheduleReminder('weight', { enabled: false, hour: 8, minute: 0 });

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weight-1');
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('switching off blood pressure leaves the weigh-in alone', async () => {
    await scheduleReminder('bp', { enabled: false, hour: 8, minute: 0 });

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('bp-1');
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('rescheduling one kind only replaces that kind', async () => {
    await scheduleReminder('weight', {
      enabled: true,
      hour: 9,
      minute: 0,
      weekday: 3,
    });

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weight-1');
    expect(mocked.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('bp-1');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
