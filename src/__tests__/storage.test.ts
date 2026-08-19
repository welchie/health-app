import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadReadings, loadReminder, saveReadings, saveReminder } from '../storage';
import { defaultReminder, Reading } from '../types';

const sample: Reading[] = [
  { id: '1', takenAt: '2026-08-01T08:00:00.000Z', systolic: 122, diastolic: 79, heartRate: 68 },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('reading storage', () => {
  it('returns an empty list before anything is saved', async () => {
    await expect(loadReadings()).resolves.toEqual([]);
  });

  it('round-trips readings', async () => {
    await saveReadings(sample);
    await expect(loadReadings()).resolves.toEqual(sample);
  });

  it('survives corrupted storage instead of throwing', async () => {
    await AsyncStorage.setItem('bp-tracker/readings/v1', '{not json');
    await expect(loadReadings()).resolves.toEqual([]);
  });

  it('ignores stored values that are not a list', async () => {
    await AsyncStorage.setItem('bp-tracker/readings/v1', '{"systolic":120}');
    await expect(loadReadings()).resolves.toEqual([]);
  });
});

describe('reminder storage', () => {
  it('falls back to the default reminder', async () => {
    await expect(loadReminder()).resolves.toEqual(defaultReminder);
  });

  it('round-trips reminder settings', async () => {
    await saveReminder({ enabled: true, hour: 21, minute: 15 });
    await expect(loadReminder()).resolves.toEqual({ enabled: true, hour: 21, minute: 15 });
  });

  it('fills in missing fields from the default', async () => {
    await AsyncStorage.setItem('bp-tracker/reminder/v1', '{"enabled":true}');
    await expect(loadReminder()).resolves.toEqual({
      ...defaultReminder,
      enabled: true,
    });
  });

  it('survives corrupted reminder storage', async () => {
    await AsyncStorage.setItem('bp-tracker/reminder/v1', 'nope');
    await expect(loadReminder()).resolves.toEqual(defaultReminder);
  });
});
