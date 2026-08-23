import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultReminder,
  defaultWeightReminder,
  defaultWeightUnit,
  BloodPressureReading,
  ReminderSettings,
  WeightEntry,
  WeightUnit,
  MedicationReminder,
} from './types';

// Renamed with the app. Safe to do because the Android package and iOS bundle id
// changed at the same time, so the renamed app starts with its own empty storage
// and there is no older data to orphan.
const READINGS_KEY = 'health-app/readings/v1';
const REMINDER_KEY = 'health-app/reminder/v1';
const WEIGHTS_KEY = 'health-app/weights/v1';
const WEIGHT_UNIT_KEY = 'health-app/units/v1';
const WEIGHT_REMINDER_KEY = 'health-app/weight-reminder/v1';
const MEDICATIONS_KEY = 'health-app/medications/v1';
const DEVICE_TOKEN_KEY = 'health-app/device-token/v1';


export async function loadRawReadings(): Promise<BloodPressureReading[]> {
  const raw = await AsyncStorage.getItem(READINGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BloodPressureReading[]) : [];
  } catch {
    return [];
  }
}

export async function saveRawReadings(readings: BloodPressureReading[]) {
  await AsyncStorage.setItem(READINGS_KEY, JSON.stringify(readings));
}

export async function loadReadings(): Promise<BloodPressureReading[]> {
  const raw = await loadRawReadings();
  return raw.filter((r) => !r.deleted);
}

export async function saveReadings(readings: BloodPressureReading[]) {
  const raw = await loadRawReadings();
  const deleted = raw.filter((r) => r.deleted);

  const nextReadings = readings.map((r) => {
    if (r.updatedAt !== undefined && r.synced !== undefined) {
      return r;
    }
    return {
      ...r,
      updatedAt: new Date().toISOString(),
      synced: false,
      deleted: false,
    };
  });

  const combined = [...nextReadings, ...deleted];
  await saveRawReadings(combined);
}

export async function loadReminder(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(REMINDER_KEY);
  if (!raw) return defaultReminder;
  try {
    return { ...defaultReminder, ...JSON.parse(raw) } as ReminderSettings;
  } catch {
    return defaultReminder;
  }
}

export async function saveReminder(settings: ReminderSettings) {
  await AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(settings));
}

export async function loadRawWeights(): Promise<WeightEntry[]> {
  const raw = await AsyncStorage.getItem(WEIGHTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WeightEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveRawWeights(weights: WeightEntry[]) {
  await AsyncStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}

export async function loadWeights(): Promise<WeightEntry[]> {
  const raw = await loadRawWeights();
  return raw.filter((w) => !w.deleted);
}

export async function saveWeights(weights: WeightEntry[]) {
  const raw = await loadRawWeights();
  const deleted = raw.filter((w) => w.deleted);

  const nextWeights = weights.map((w) => {
    if (w.updatedAt !== undefined && w.synced !== undefined) {
      return w;
    }
    return {
      ...w,
      updatedAt: new Date().toISOString(),
      synced: false,
      deleted: false,
    };
  });

  const combined = [...nextWeights, ...deleted];
  await saveRawWeights(combined);
}

export async function tombstoneReading(id: string) {
  const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  const raw = await loadRawReadings();
  let next;
  if (token) {
    next = raw.map((r) =>
      r.id === id
        ? { ...r, deleted: true, synced: false, updatedAt: new Date().toISOString() }
        : r
    );
  } else {
    next = raw.filter((r) => r.id !== id);
  }
  await saveRawReadings(next);
}

export async function tombstoneWeight(id: string) {
  const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
  const raw = await loadRawWeights();
  let next;
  if (token) {
    next = raw.map((w) =>
      w.id === id
        ? { ...w, deleted: true, synced: false, updatedAt: new Date().toISOString() }
        : w
    );
  } else {
    next = raw.filter((w) => w.id !== id);
  }
  await saveRawWeights(next);
}

export async function loadWeightUnit(): Promise<WeightUnit> {
  const raw = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
  return raw === 'kg' || raw === 'st_lb' ? raw : defaultWeightUnit;
}

export async function saveWeightUnit(unit: WeightUnit) {
  await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
}

export async function loadWeightReminder(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(WEIGHT_REMINDER_KEY);
  if (!raw) return defaultWeightReminder;
  try {
    return { ...defaultWeightReminder, ...JSON.parse(raw) } as ReminderSettings;
  } catch {
    return defaultWeightReminder;
  }
}

export async function saveWeightReminder(settings: ReminderSettings) {
  await AsyncStorage.setItem(WEIGHT_REMINDER_KEY, JSON.stringify(settings));
}

export async function loadMedications(): Promise<MedicationReminder[]> {
  const raw = await AsyncStorage.getItem(MEDICATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MedicationReminder[]) : [];
  } catch {
    return [];
  }
}

export async function saveMedications(meds: MedicationReminder[]) {
  await AsyncStorage.setItem(MEDICATIONS_KEY, JSON.stringify(meds));
}

