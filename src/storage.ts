import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  defaultReminder,
  defaultWeightReminder,
  defaultWeightUnit,
  Reading,
  ReminderSettings,
  WeightEntry,
  WeightUnit,
} from './types';

// Keys keep the original prefix: renaming them would orphan data already on the
// device, which is not worth a migration for a cosmetic change.
const READINGS_KEY = 'bp-tracker/readings/v1';
const REMINDER_KEY = 'bp-tracker/reminder/v1';
const WEIGHTS_KEY = 'bp-tracker/weights/v1';
const WEIGHT_UNIT_KEY = 'bp-tracker/units/v1';
const WEIGHT_REMINDER_KEY = 'bp-tracker/weight-reminder/v1';

export async function loadReadings(): Promise<Reading[]> {
  const raw = await AsyncStorage.getItem(READINGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Reading[]) : [];
  } catch {
    return [];
  }
}

export async function saveReadings(readings: Reading[]) {
  await AsyncStorage.setItem(READINGS_KEY, JSON.stringify(readings));
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

export async function loadWeights(): Promise<WeightEntry[]> {
  const raw = await AsyncStorage.getItem(WEIGHTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WeightEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveWeights(weights: WeightEntry[]) {
  await AsyncStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
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
