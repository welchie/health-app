export type BloodPressureReading = {
  id: string;
  /** ISO 8601 timestamp of when the reading was taken. */
  takenAt: string;
  systolic: number;
  diastolic: number;
  heartRate: number | null;
  note?: string;
  
  // Sync fields
  updatedAt?: string;
  synced?: boolean;
  deleted?: boolean;
};

/**
 * Weight is stored in whole grams, whatever units it was entered in. Grams are
 * the single source of truth: the unit preference below only decides how a
 * value is rendered, so switching units re-expresses a weight rather than
 * rewriting it, and repeated kg <-> st/lb switches cannot drift.
 */
export type WeightEntry = {
  id: string;
  /** ISO 8601 timestamp of when the weight was taken. */
  takenAt: string;
  grams: number;
  note?: string;

  // Sync fields
  updatedAt?: string;
  synced?: boolean;
  deleted?: boolean;
};

export type WeightUnit = 'kg' | 'st_lb';

export const defaultWeightUnit: WeightUnit = 'st_lb';

export type ReminderSettings = {
  enabled: boolean;
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
  /** Weekly reminders only. 1 = Sunday, matching expo-notifications. */
  weekday?: number;
};

export const defaultReminder: ReminderSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
};

/** Monday morning, the usual weigh-in slot. */
export const defaultWeightReminder: ReminderSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
  weekday: 2,
};

export type MedicationReminder = {
  id: string;
  name: string;
  enabled: boolean;
  times: { hour: number; minute: number }[];
  instruction: string;
};

