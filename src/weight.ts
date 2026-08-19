import { WeightEntry, WeightUnit } from './types';

export const GRAMS_PER_POUND = 453.59237;
export const POUNDS_PER_STONE = 14;
export const GRAMS_PER_STONE = GRAMS_PER_POUND * POUNDS_PER_STONE;

/** Plausible adult range, used by the entry form in both unit systems. */
export const MIN_GRAMS = 20_000;
export const MAX_GRAMS = 300_000;

const round1 = (value: number) => Math.round(value * 10) / 10;

export const kgToGrams = (kg: number) => Math.round(kg * 1000);
export const gramsToKg = (grams: number) => grams / 1000;
export const poundsToGrams = (pounds: number) => Math.round(pounds * GRAMS_PER_POUND);
export const gramsToPounds = (grams: number) => grams / GRAMS_PER_POUND;

export const stoneLbsToGrams = (stones: number, pounds: number) =>
  Math.round(stones * GRAMS_PER_STONE + pounds * GRAMS_PER_POUND);

export type StoneLbs = { stones: number; pounds: number };

/**
 * Splits a pound total into stones and pounds. The pounds figure is rounded to
 * one decimal *before* the stones figure is settled, so 13 st 13.97 lb reads as
 * 14 st 0.0 lb rather than the impossible 13 st 14.0 lb.
 */
export function splitStoneLbs(totalPounds: number): StoneLbs {
  const sign = totalPounds < 0 ? -1 : 1;
  const magnitude = Math.abs(totalPounds);
  let stones = Math.floor(magnitude / POUNDS_PER_STONE);
  let pounds = round1(magnitude - stones * POUNDS_PER_STONE);
  if (pounds >= POUNDS_PER_STONE) {
    stones += 1;
    pounds = 0;
  }
  return { stones: stones * sign, pounds };
}

export const gramsToStoneLbs = (grams: number) => splitStoneLbs(gramsToPounds(grams));

export const isPlausibleWeight = (grams: number) =>
  Number.isFinite(grams) && grams >= MIN_GRAMS && grams <= MAX_GRAMS;

/** The number a chart plots: kilograms, or stones with a decimal part. */
export const toChartValue = (grams: number, unit: WeightUnit) =>
  unit === 'kg' ? gramsToKg(grams) : gramsToPounds(grams) / POUNDS_PER_STONE;

export const unitLabel = (unit: WeightUnit) => (unit === 'kg' ? 'kg' : 'st');

export function formatWeight(grams: number, unit: WeightUnit) {
  if (unit === 'kg') return `${gramsToKg(grams).toFixed(1)} kg`;
  const { stones, pounds } = gramsToStoneLbs(grams);
  return `${stones} st ${pounds.toFixed(1)} lb`;
}

/** Chart axis ticks are tight on space, so they carry the number alone. */
export const formatChartAxis = (value: number) => value.toFixed(1);

/** A plotted point spells the value out in full, as the readout has room. */
export function formatChartPoint(value: number, unit: WeightUnit) {
  if (unit === 'kg') return `${value.toFixed(1)} kg`;
  const { stones, pounds } = splitStoneLbs(value * POUNDS_PER_STONE);
  return `${stones} st ${pounds.toFixed(1)} lb`;
}

/**
 * A change is easier to read in the smaller unit, so stones-and-pounds users
 * see a pound figure rather than "0 st 2.4 lb".
 */
export function formatWeightDelta(grams: number, unit: WeightUnit) {
  const sign = grams > 0 ? '+' : grams < 0 ? '-' : '';
  const magnitude = Math.abs(grams);
  if (unit === 'kg') return `${sign}${gramsToKg(magnitude).toFixed(1)} kg`;
  return `${sign}${round1(gramsToPounds(magnitude)).toFixed(1)} lb`;
}

export function averageGrams(entries: WeightEntry[]) {
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, entry) => sum + entry.grams, 0);
  return Math.round(total / entries.length);
}

/**
 * Net change across the period, in grams. Entries arrive newest first, as
 * everywhere else in the app.
 */
export function weightChange(entries: WeightEntry[]) {
  if (entries.length < 2) return null;
  return entries[0].grams - entries[entries.length - 1].grams;
}
