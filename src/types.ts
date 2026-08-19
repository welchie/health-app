export type Reading = {
  id: string;
  /** ISO 8601 timestamp of when the reading was taken. */
  takenAt: string;
  systolic: number;
  diastolic: number;
  heartRate: number | null;
  note?: string;
};

export type ReminderSettings = {
  enabled: boolean;
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
};

export const defaultReminder: ReminderSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
};
