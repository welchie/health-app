import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadReadings,
  loadReminder,
  loadWeightReminder,
  loadWeights,
  loadWeightUnit,
  saveReadings,
  saveReminder,
  saveWeightReminder,
  saveWeights,
  saveWeightUnit,
  loadMedications,
  saveMedications,
} from '../storage';
import {
  defaultReminder,
  defaultWeightReminder,
  BloodPressureReading,
  WeightEntry,
  MedicationReminder,
} from '../types';

const sample: BloodPressureReading[] = [
  { id: '1', takenAt: '2026-08-01T08:00:00.000Z', systolic: 122, diastolic: 79, heartRate: 68, updatedAt: '2026-08-01T08:00:00.000Z', synced: false, deleted: false },
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
    await AsyncStorage.setItem('health-app/readings/v1', '{not json');
    await expect(loadReadings()).resolves.toEqual([]);
  });

  it('ignores stored values that are not a list', async () => {
    await AsyncStorage.setItem('health-app/readings/v1', '{"systolic":120}');
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
    await AsyncStorage.setItem('health-app/reminder/v1', '{"enabled":true}');
    await expect(loadReminder()).resolves.toEqual({
      ...defaultReminder,
      enabled: true,
    });
  });

  it('survives corrupted reminder storage', async () => {
    await AsyncStorage.setItem('health-app/reminder/v1', 'nope');
    await expect(loadReminder()).resolves.toEqual(defaultReminder);
  });
});

const weights: WeightEntry[] = [
  { id: 'w1', takenAt: '2026-08-01T07:30:00.000Z', grams: 81193, updatedAt: '2026-08-01T07:30:00.000Z', synced: false, deleted: false },
];

describe('weight storage', () => {
  it('returns an empty list before anything is saved', async () => {
    await expect(loadWeights()).resolves.toEqual([]);
  });

  it('round-trips weights', async () => {
    await saveWeights(weights);
    await expect(loadWeights()).resolves.toEqual(weights);
  });

  it('survives corrupted storage instead of throwing', async () => {
    await AsyncStorage.setItem('health-app/weights/v1', '{not json');
    await expect(loadWeights()).resolves.toEqual([]);
  });

  it('ignores stored values that are not a list', async () => {
    await AsyncStorage.setItem('health-app/weights/v1', '{"grams":81193}');
    await expect(loadWeights()).resolves.toEqual([]);
  });

  it('keeps weights separate from blood pressure readings', async () => {
    await saveReadings(sample);
    await saveWeights(weights);

    await expect(loadReadings()).resolves.toEqual(sample);
    await expect(loadWeights()).resolves.toEqual(weights);
  });
});

describe('weight unit preference', () => {
  it('defaults to stones and pounds', async () => {
    await expect(loadWeightUnit()).resolves.toBe('st_lb');
  });

  it('round-trips a choice', async () => {
    await saveWeightUnit('kg');
    await expect(loadWeightUnit()).resolves.toBe('kg');
  });

  it('falls back to the default for an unrecognised value', async () => {
    await AsyncStorage.setItem('health-app/units/v1', 'pounds-only');
    await expect(loadWeightUnit()).resolves.toBe('st_lb');
  });
});

describe('weight reminder storage', () => {
  it('defaults to a Monday morning weigh-in, switched off', async () => {
    await expect(loadWeightReminder()).resolves.toEqual(defaultWeightReminder);
    expect(defaultWeightReminder.weekday).toBe(2);
  });

  it('round-trips settings', async () => {
    await saveWeightReminder({ enabled: true, hour: 7, minute: 0, weekday: 6 });
    await expect(loadWeightReminder()).resolves.toEqual({
      enabled: true,
      hour: 7,
      minute: 0,
      weekday: 6,
    });
  });

  it('is stored separately from the blood pressure reminder', async () => {
    await saveReminder({ enabled: true, hour: 9, minute: 15 });
    await saveWeightReminder({ enabled: true, hour: 7, minute: 0, weekday: 2 });

    await expect(loadReminder()).resolves.toMatchObject({ hour: 9, minute: 15 });
    await expect(loadWeightReminder()).resolves.toMatchObject({ hour: 7, weekday: 2 });
  });

  it('fills in missing fields from the default', async () => {
    await AsyncStorage.setItem('health-app/weight-reminder/v1', '{"enabled":true}');
    await expect(loadWeightReminder()).resolves.toEqual({
      ...defaultWeightReminder,
      enabled: true,
    });
  });
});

const sampleMedications: MedicationReminder[] = [
  {
    id: 'm1',
    name: 'Aspirin',
    enabled: true,
    times: [{ hour: 8, minute: 30 }],
    instruction: 'After food',
  },
];

describe('medication storage', () => {
  it('returns an empty list before anything is saved', async () => {
    await expect(loadMedications()).resolves.toEqual([]);
  });

  it('round-trips medications', async () => {
    await saveMedications(sampleMedications);
    await expect(loadMedications()).resolves.toEqual(sampleMedications);
  });

  it('survives corrupted storage instead of throwing', async () => {
    await AsyncStorage.setItem('health-app/medications/v1', '{not json');
    await expect(loadMedications()).resolves.toEqual([]);
  });

  it('ignores stored values that are not a list', async () => {
    await AsyncStorage.setItem('health-app/medications/v1', '{"name":"Aspirin"}');
    await expect(loadMedications()).resolves.toEqual([]);
  });
});

