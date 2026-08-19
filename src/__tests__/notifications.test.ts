import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cancelDailyReminder, requestPermission, scheduleDailyReminder } from '../notifications';

const mocked = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(() => {
  jest.clearAllMocks();
  (mocked.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
});

describe('scheduleDailyReminder', () => {
  it('schedules a repeating daily notification at the chosen time', async () => {
    const result = await scheduleDailyReminder({ enabled: true, hour: 7, minute: 45 });

    expect(result).toBe('scheduled');
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: { type: 'daily', hour: 7, minute: 45 },
      }),
    );
  });

  it('schedules nothing when the reminder is switched off', async () => {
    const result = await scheduleDailyReminder({ enabled: false, hour: 7, minute: 45 });

    expect(result).toBe('cancelled');
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels the previous reminder before scheduling a new one', async () => {
    (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'old-1', content: { data: { kind: 'bp-daily-reminder' } } },
      { identifier: 'someone-elses', content: { data: { kind: 'other' } } },
    ]);

    await scheduleDailyReminder({ enabled: true, hour: 9, minute: 0 });

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-1');
  });

  it('reports refusal and schedules nothing when permission is denied', async () => {
    (mocked.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    (mocked.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    const result = await scheduleDailyReminder({ enabled: true, hour: 9, minute: 0 });

    expect(result).toBe('denied');
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('sets up an Android channel before scheduling', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');

    await scheduleDailyReminder({ enabled: true, hour: 6, minute: 30 });

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

describe('cancelDailyReminder', () => {
  it('cancels only this apps reminders', async () => {
    (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'mine', content: { data: { kind: 'bp-daily-reminder' } } },
      { identifier: 'theirs', content: { data: {} } },
    ]);

    await cancelDailyReminder();

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('mine');
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  });
});
