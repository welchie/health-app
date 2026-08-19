import {
  averageGrams,
  formatChartAxis,
  formatChartPoint,
  formatWeight,
  formatWeightDelta,
  gramsToKg,
  gramsToPounds,
  gramsToStoneLbs,
  GRAMS_PER_POUND,
  isPlausibleWeight,
  kgToGrams,
  poundsToGrams,
  splitStoneLbs,
  stoneLbsToGrams,
  toChartValue,
  unitLabel,
  weightChange,
} from '../weight';
import { WeightEntry } from '../types';

const entry = (grams: number, daysAgo = 0, id = `w${grams}`): WeightEntry => ({
  id,
  takenAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  grams,
});

describe('kilogram conversion', () => {
  it('stores whole grams', () => {
    expect(kgToGrams(81.4)).toBe(81400);
    expect(kgToGrams(80)).toBe(80000);
  });

  it('round-trips', () => {
    expect(gramsToKg(kgToGrams(72.3))).toBeCloseTo(72.3, 5);
  });

  it('rounds sub-gram input rather than storing a fraction', () => {
    expect(Number.isInteger(kgToGrams(81.4567))).toBe(true);
  });
});

describe('pound and stone conversion', () => {
  it('converts pounds to grams', () => {
    expect(poundsToGrams(1)).toBe(Math.round(GRAMS_PER_POUND));
    expect(poundsToGrams(179)).toBe(81193);
  });

  it('converts stones and pounds to grams', () => {
    expect(stoneLbsToGrams(12, 11)).toBe(81193);
    expect(stoneLbsToGrams(0, 0)).toBe(0);
  });

  it('round-trips stones and pounds', () => {
    expect(gramsToStoneLbs(stoneLbsToGrams(12, 11))).toEqual({ stones: 12, pounds: 11 });
    expect(gramsToStoneLbs(stoneLbsToGrams(9, 0))).toEqual({ stones: 9, pounds: 0 });
  });

  it('splits kilograms into stones and pounds', () => {
    expect(gramsToStoneLbs(80000)).toEqual({ stones: 12, pounds: 8.4 });
  });

  it('converts grams to a pound total', () => {
    expect(gramsToPounds(81193)).toBeCloseTo(179, 2);
  });
});

/**
 * Rounding the pounds figure after settling the stones figure produces the
 * impossible "13 st 14.0 lb", so the carry is asserted directly.
 */
describe('the stones rounding carry', () => {
  it('carries 13 st 13.97 lb up to 14 st 0.0 lb', () => {
    expect(gramsToStoneLbs(poundsToGrams(13 * 14 + 13.97))).toEqual({
      stones: 14,
      pounds: 0,
    });
  });

  it('leaves 13 st 13.9 lb alone', () => {
    expect(gramsToStoneLbs(poundsToGrams(13 * 14 + 13.9))).toEqual({
      stones: 13,
      pounds: 13.9,
    });
  });

  it('never reports 14 or more pounds, across a full stone of grams', () => {
    const start = stoneLbsToGrams(12, 0);
    for (let grams = start; grams <= start + 6400; grams += 7) {
      const { pounds } = gramsToStoneLbs(grams);
      expect(pounds).toBeGreaterThanOrEqual(0);
      expect(pounds).toBeLessThan(14);
    }
  });

  it('handles a negative pound total for deltas', () => {
    expect(splitStoneLbs(-16.2)).toEqual({ stones: -1, pounds: 2.2 });
  });
});

describe('formatWeight', () => {
  it('renders kilograms to one decimal', () => {
    expect(formatWeight(81400, 'kg')).toBe('81.4 kg');
    expect(formatWeight(80000, 'kg')).toBe('80.0 kg');
  });

  it('renders stones and pounds', () => {
    expect(formatWeight(81193, 'st_lb')).toBe('12 st 11.0 lb');
    expect(formatWeight(80000, 'st_lb')).toBe('12 st 8.4 lb');
  });

  it('describes one stored weight in either unit', () => {
    expect(formatWeight(81193, 'kg')).toBe('81.2 kg');
    expect(formatWeight(81193, 'st_lb')).toBe('12 st 11.0 lb');
  });
});

describe('chart values', () => {
  it('plots kilograms directly', () => {
    expect(toChartValue(81400, 'kg')).toBeCloseTo(81.4, 5);
  });

  it('plots stones with a decimal part', () => {
    expect(toChartValue(81193, 'st_lb')).toBeCloseTo(12.7857, 3);
  });

  it('labels the axis with the number alone', () => {
    expect(formatChartAxis(12.7857)).toBe('12.8');
    expect(formatChartAxis(81.4)).toBe('81.4');
  });

  it('spells a plotted point out in full', () => {
    expect(formatChartPoint(81.4, 'kg')).toBe('81.4 kg');
    expect(formatChartPoint(12.7857, 'st_lb')).toBe('12 st 11.0 lb');
  });

  it('names the axis unit', () => {
    expect(unitLabel('kg')).toBe('kg');
    expect(unitLabel('st_lb')).toBe('st');
  });
});

describe('formatWeightDelta', () => {
  it('signs a gain and a loss', () => {
    expect(formatWeightDelta(1400, 'kg')).toBe('+1.4 kg');
    expect(formatWeightDelta(-1400, 'kg')).toBe('-1.4 kg');
  });

  it('reports no change without a sign', () => {
    expect(formatWeightDelta(0, 'kg')).toBe('0.0 kg');
  });

  it('uses pounds for stones users, being the readable unit for a change', () => {
    expect(formatWeightDelta(1400, 'st_lb')).toBe('+3.1 lb');
    expect(formatWeightDelta(-1400, 'st_lb')).toBe('-3.1 lb');
  });
});

describe('isPlausibleWeight', () => {
  it.each([
    [20_000, true],
    [300_000, true],
    [81_193, true],
    [19_999, false],
    [300_001, false],
    [0, false],
    [NaN, false],
  ])('treats %p as %p', (grams, expected) => {
    expect(isPlausibleWeight(grams)).toBe(expected);
  });
});

describe('averageGrams', () => {
  it('returns null with nothing to average', () => {
    expect(averageGrams([])).toBeNull();
  });

  it('rounds the mean to whole grams', () => {
    expect(averageGrams([entry(80000), entry(81001)])).toBe(80501);
  });
});

describe('weightChange', () => {
  it('needs two entries to report a change', () => {
    expect(weightChange([])).toBeNull();
    expect(weightChange([entry(80000)])).toBeNull();
  });

  it('reports the newest against the oldest of the period', () => {
    const newestFirst = [entry(81400, 0), entry(80700, 3), entry(80000, 7)];

    expect(weightChange(newestFirst)).toBe(1400);
  });

  it('reports a loss as negative', () => {
    expect(weightChange([entry(79000, 0), entry(80000, 7)])).toBe(-1000);
  });
});
