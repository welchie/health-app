import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultReminder, Reading, ReminderSettings } from './types';

const READINGS_KEY = 'bp-tracker/readings/v1';
const REMINDER_KEY = 'bp-tracker/reminder/v1';

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
