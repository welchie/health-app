import { Reading } from './types';

export type Category =
  | 'Low'
  | 'Normal'
  | 'Elevated'
  | 'High (stage 1)'
  | 'High (stage 2)'
  | 'Very high';

/**
 * Plain-language banding of a single reading, following the widely published
 * adult blood pressure ranges. Informational only - it is not a diagnosis.
 */
export function categorise(systolic: number, diastolic: number): Category {
  if (systolic >= 180 || diastolic >= 120) return 'Very high';
  if (systolic >= 140 || diastolic >= 90) return 'High (stage 2)';
  if (systolic >= 130 || diastolic >= 80) return 'High (stage 1)';
  if (systolic >= 120) return 'Elevated';
  if (systolic < 90 || diastolic < 60) return 'Low';
  return 'Normal';
}

export function averageOf(readings: Reading[]) {
  if (readings.length === 0) return null;
  const sum = readings.reduce(
    (acc, r) => ({
      systolic: acc.systolic + r.systolic,
      diastolic: acc.diastolic + r.diastolic,
      heartRate: acc.heartRate + (r.heartRate ?? 0),
      pulseCount: acc.pulseCount + (r.heartRate == null ? 0 : 1),
    }),
    { systolic: 0, diastolic: 0, heartRate: 0, pulseCount: 0 },
  );
  return {
    systolic: Math.round(sum.systolic / readings.length),
    diastolic: Math.round(sum.diastolic / readings.length),
    heartRate: sum.pulseCount ? Math.round(sum.heartRate / sum.pulseCount) : null,
    count: readings.length,
  };
}

export function readingsWithinDays(readings: Reading[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return readings.filter((r) => new Date(r.takenAt).getTime() >= cutoff);
}

/** Newest first, which is the order the list is displayed in. */
export function sortByNewest(readings: Reading[]) {
  return [...readings].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000);
  if (sameDay) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

export function formatClock(hour: number, minute: number) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
