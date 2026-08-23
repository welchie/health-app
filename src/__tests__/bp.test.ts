import {
  averageOf,
  categorise,
  formatClock,
  formatWhen,
  readingsWithinDays,
  sortByNewest,
} from '../bp';
import { BloodPressureReading } from '../types';

const reading = (over: Partial<BloodPressureReading> = {}): BloodPressureReading => ({
  id: over.id ?? 'r1',
  takenAt: over.takenAt ?? new Date().toISOString(),
  systolic: over.systolic ?? 120,
  diastolic: over.diastolic ?? 78,
  heartRate: over.heartRate === undefined ? 70 : over.heartRate,
  note: over.note,
});

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe('categorise', () => {
  it.each([
    [110, 70, 'Normal'],
    [119, 79, 'Normal'],
    [120, 79, 'Elevated'],
    [129, 79, 'Elevated'],
    [130, 79, 'High (stage 1)'],
    [118, 80, 'High (stage 1)'],
    [139, 89, 'High (stage 1)'],
    [140, 85, 'High (stage 2)'],
    [135, 90, 'High (stage 2)'],
    [179, 119, 'High (stage 2)'],
    [180, 100, 'Very high'],
    [150, 120, 'Very high'],
    [88, 70, 'Low'],
    [100, 55, 'Low'],
  ])('bands %i/%i as %s', (systolic, diastolic, expected) => {
    expect(categorise(systolic, diastolic)).toBe(expected);
  });

  it('lets the higher of the two numbers decide the band', () => {
    expect(categorise(115, 95)).toBe('High (stage 2)');
  });

  it('treats a very high diastolic as very high even with a modest systolic', () => {
    expect(categorise(125, 121)).toBe('Very high');
  });
});

describe('averageOf', () => {
  it('returns null with no readings', () => {
    expect(averageOf([])).toBeNull();
  });

  it('rounds the mean of each measure', () => {
    const result = averageOf([
      reading({ id: 'a', systolic: 120, diastolic: 80, heartRate: 60 }),
      reading({ id: 'b', systolic: 131, diastolic: 85, heartRate: 71 }),
    ]);
    expect(result).toEqual({ systolic: 126, diastolic: 83, heartRate: 66, count: 2 });
  });

  it('averages heart rate only over readings that recorded one', () => {
    const result = averageOf([
      reading({ id: 'a', heartRate: 60 }),
      reading({ id: 'b', heartRate: null }),
      reading({ id: 'c', heartRate: 80 }),
    ]);
    expect(result?.heartRate).toBe(70);
    expect(result?.count).toBe(3);
  });

  it('reports no heart rate when none was recorded', () => {
    const result = averageOf([reading({ heartRate: null })]);
    expect(result?.heartRate).toBeNull();
  });
});

describe('readingsWithinDays', () => {
  const readings = [
    reading({ id: 'today', takenAt: daysAgo(0) }),
    reading({ id: 'week', takenAt: daysAgo(5) }),
    reading({ id: 'month', takenAt: daysAgo(20) }),
    reading({ id: 'old', takenAt: daysAgo(90) }),
  ];

  it('keeps only readings inside the window', () => {
    expect(readingsWithinDays(readings, 7).map((r) => r.id)).toEqual(['today', 'week']);
    expect(readingsWithinDays(readings, 30).map((r) => r.id)).toEqual([
      'today',
      'week',
      'month',
    ]);
  });

  it('does not mutate the input', () => {
    readingsWithinDays(readings, 7);
    expect(readings).toHaveLength(4);
  });
});

describe('sortByNewest', () => {
  it('orders newest first without mutating the input', () => {
    const readings = [
      reading({ id: 'old', takenAt: daysAgo(3) }),
      reading({ id: 'new', takenAt: daysAgo(0) }),
      reading({ id: 'mid', takenAt: daysAgo(1) }),
    ];
    expect(sortByNewest(readings).map((r) => r.id)).toEqual(['new', 'mid', 'old']);
    expect(readings.map((r) => r.id)).toEqual(['old', 'new', 'mid']);
  });
});

describe('formatWhen', () => {
  it('labels today and yesterday', () => {
    const now = new Date();
    now.setHours(9, 5, 0, 0);
    expect(formatWhen(now.toISOString())).toMatch(/^Today, /);

    const yesterday = new Date(now.getTime() - 86400000);
    expect(formatWhen(yesterday.toISOString())).toMatch(/^Yesterday, /);
  });

  it('uses a date for anything older', () => {
    const older = new Date(Date.now() - 5 * 86400000);
    const label = formatWhen(older.toISOString());
    expect(label).not.toMatch(/Today|Yesterday/);
    expect(label).toContain(',');
  });
});

describe('formatClock', () => {
  it('renders a wall-clock time for the reminder', () => {
    expect(formatClock(8, 30)).toMatch(/8[:.]30/);
  });
});
