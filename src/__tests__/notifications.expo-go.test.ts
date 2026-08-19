/**
 * Importing expo-notifications inside Expo Go on Android throws and takes the
 * whole app down, so the module must never be loaded there. These tests load
 * `../notifications` fresh per environment, which is why they live in their own
 * file - a top-level import would cache it before the mocks are in place.
 */
const loadIn = (os: string, executionEnvironment: string) => {
  let module: typeof import('../notifications') | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { executionEnvironment },
      ExecutionEnvironment: { Bare: 'bare', StoreClient: 'storeClient' },
    }));
    // A proxy keeps react-native's exports lazy - spreading them here would
    // pull in native-only modules that do not exist under Jest.
    jest.doMock('react-native', () => {
      const actual = jest.requireActual('react-native') as Record<string, unknown>;
      return new Proxy(actual, {
        get: (target, prop) => (prop === 'Platform' ? { OS: os } : target[prop as string]),
      });
    });
    jest.doMock('expo-notifications', () => {
      throw new Error('Android Push notifications were removed from Expo Go');
    });
    module = require('../notifications');
  });
  return module as typeof import('../notifications');
};

describe('inside Expo Go on Android', () => {
  it('reports reminders as unsupported without importing the module', () => {
    expect(loadIn('android', 'storeClient').remindersSupported).toBe(false);
  });

  it('returns unsupported instead of throwing when asked to schedule', async () => {
    const notifications = loadIn('android', 'storeClient');

    await expect(
      notifications.scheduleReminder('bp', { enabled: true, hour: 8, minute: 0 }),
    ).resolves.toBe('unsupported');
    await expect(notifications.requestPermission()).resolves.toBe(false);
    await expect(notifications.cancelReminder('bp')).resolves.toBeUndefined();
    await expect(
      notifications.scheduleReminder('weight', { enabled: true, hour: 8, minute: 0 }),
    ).resolves.toBe('unsupported');
  });
});

describe('everywhere else', () => {
  it('supports reminders in Expo Go on iOS', () => {
    expect(loadIn('ios', 'storeClient').remindersSupported).toBe(true);
  });

  it('supports reminders in an Android development build', () => {
    expect(loadIn('android', 'bare').remindersSupported).toBe(true);
  });

  it('supports reminders in a standalone iOS build', () => {
    expect(loadIn('ios', 'standalone').remindersSupported).toBe(true);
  });
});
