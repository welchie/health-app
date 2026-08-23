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


export async function loadReadings(): Promise<BloodPressureReading[]> {
  const raw = await AsyncStorage.getItem(READINGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BloodPressureReading[]) : [];
  } catch {
    return [];
  }
}

export async function saveReadings(readings: BloodPressureReading[]) {
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

