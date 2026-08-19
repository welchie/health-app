import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TrendChart, { niceDomain, Series } from '../components/TrendChart';

const bp: Series[] = [
  { key: 'systolic', label: 'Systolic', color: '#d7263d', points: [130, 124, 128] },
  { key: 'diastolic', label: 'Diastolic', color: '#1b6ca8', points: [85, 80, 82] },
];

const props = {
  title: 'Blood pressure',
  unit: 'mmHg',
  labels: ['1 Aug, 08:00', '2 Aug, 08:00', '3 Aug, 08:00'],
  positions: [0, 0.5, 1],
  series: bp,
};

/** The chart only draws once it knows how wide it is. */
const layout = async (width = 320) =>
  fireEvent(screen.getByTestId('chart'), 'layout', {
    nativeEvent: { layout: { width, height: 186 } },
  });

const countByType = (node: unknown, type: string): number => {
  if (!node || typeof node !== 'object') return 0;
  const el = node as { type?: string; children?: unknown[] };
  const self = el.type === type ? 1 : 0;
  const kids = Array.isArray(el.children)
    ? el.children.reduce((sum: number, child) => sum + countByType(child, type), 0)
    : 0;
  return self + kids;
};

describe('TrendChart', () => {
  it('says so when there is nothing to plot', async () => {
    await render(<TrendChart {...props} series={[]} labels={[]} positions={[]} />);

    expect(screen.getByText('No readings in this period yet.')).toBeTruthy();
  });

  it('treats a series of only missing values as empty', async () => {
    await render(
      <TrendChart
        {...props}
        series={[{ key: 'pulse', label: 'Heart rate', color: '#8a4fd3', points: [null, null] }]}
      />,
    );

    expect(screen.getByText('No readings in this period yet.')).toBeTruthy();
  });

  it('draws one line per series once it has been measured', async () => {
    const view = await render(<TrendChart {...props} />);
    await layout();

    expect(countByType(view.toJSON(), 'RNSVGPath')).toBe(2);
  });

  it('shows a legend when there is more than one series', async () => {
    await render(<TrendChart {...props} />);

    expect(screen.getByText('Systolic')).toBeTruthy();
    expect(screen.getByText('Diastolic')).toBeTruthy();
  });

  it('leaves the legend out for a single series', async () => {
    await render(
      <TrendChart
        {...props}
        title="Heart rate"
        unit="bpm"
        series={[{ key: 'pulse', label: 'Heart rate', color: '#8a4fd3', points: [70, 72, 68] }]}
      />,
    );

    // Only the chart title carries the name - no legend row repeats it.
    expect(screen.getAllByText('Heart rate')).toHaveLength(1);
  });

  it('reads out the values of the reading you touch', async () => {
    await render(<TrendChart {...props} />);
    await layout();

    await fireEvent(screen.getByTestId('chart-surface'), 'responderGrant', {
      nativeEvent: { locationX: 400 },
    });

    expect(screen.getByText(/3 Aug, 08:00 — Systolic 128 · Diastolic 82/)).toBeTruthy();
  });

  it('picks the nearest point when you drag across the chart', async () => {
    await render(<TrendChart {...props} />);
    await layout();

    await fireEvent(screen.getByTestId('chart-surface'), 'responderGrant', {
      nativeEvent: { locationX: 400 },
    });
    await fireEvent(screen.getByTestId('chart-surface'), 'responderMove', {
      nativeEvent: { locationX: 0 },
    });

    expect(screen.getByText(/1 Aug, 08:00 — Systolic 130 · Diastolic 85/)).toBeTruthy();
  });

  it('marks a missing value as absent in the readout', async () => {
    await render(
      <TrendChart
        {...props}
        series={[{ key: 'pulse', label: 'Heart rate', color: '#8a4fd3', points: [70, null, 68] }]}
      />,
    );
    await layout();

    await fireEvent(screen.getByTestId('chart-surface'), 'responderGrant', {
      nativeEvent: { locationX: 160 },
    });

    expect(screen.getByText(/2 Aug, 08:00 — Heart rate —/)).toBeTruthy();
  });

  it('prompts you to interact before anything is selected', async () => {
    await render(<TrendChart {...props} />);

    expect(screen.getByText(/Tap or drag across the chart/)).toBeTruthy();
  });
});

/**
 * The axis step used to be hardcoded to 10, which suits mmHg but flattens a
 * stones scale into a single line.
 */
describe('niceDomain', () => {
  it('keeps the familiar 10 mmHg step for blood pressure', () => {
    const withGuides = niceDomain([130, 124, 128, 85, 80, 82, 120, 80]);

    expect(withGuides).toEqual({ lower: 70, upper: 140, step: 10 });
  });

  it('gives a stones range a step that separates the points', () => {
    const domain = niceDomain([12.5, 12.79, 13.2]);

    expect(domain.step).toBe(0.2);
    expect(domain.lower).toBeLessThanOrEqual(12.5);
    expect(domain.upper).toBeGreaterThanOrEqual(13.2);
  });

  it('gives a kilogram range a half-kilo step', () => {
    expect(niceDomain([79.2, 81.4, 80.1]).step).toBe(0.5);
  });

  it('now resolves a narrow heart rate spread finely, rather than 60-80', () => {
    expect(niceDomain([70, 72, 68])).toEqual({ lower: 67, upper: 73, step: 1 });
  });

  it('still spans a domain when every value is identical', () => {
    const domain = niceDomain([81.4]);

    expect(domain.upper).toBeGreaterThan(domain.lower);
  });

  it('keeps fractional ticks free of floating point noise', () => {
    const domain = niceDomain([12.5, 13.2]);

    expect(Number.isInteger(domain.lower * 10)).toBe(true);
    expect(Number.isInteger(domain.upper * 10)).toBe(true);
  });
});

describe('formatValue', () => {
  const weight: Series[] = [
    { key: 'weight', label: 'Weight', color: '#8a4fd3', points: [12.5, 12.79, 13.2] },
  ];
  const weightProps = {
    ...props,
    title: 'Weight',
    unit: 'st',
    series: weight,
    formatValue: (value: number, context: 'compact' | 'full') =>
      context === 'compact' ? value.toFixed(1) : `${value.toFixed(2)} st`,
  };

  it('keeps the label beside the newest point compact, so it is not clipped', async () => {
    const view = await render(<TrendChart {...weightProps} />);
    await layout();

    const drawn = JSON.stringify(view.toJSON());
    expect(drawn).toContain('13.2');
    expect(drawn).not.toContain('13.20 st');
  });

  it('writes the value out in full in the touch readout', async () => {
    await render(<TrendChart {...weightProps} />);
    await layout();

    await fireEvent(screen.getByTestId('chart-surface'), 'responderGrant', {
      nativeEvent: { locationX: 400 },
    });

    expect(screen.getByText(/3 Aug, 08:00 — Weight 13.20 st/)).toBeTruthy();
  });

  it('marks a missing value as absent without calling the formatter', async () => {
    await render(
      <TrendChart
        {...weightProps}
        series={[{ ...weight[0], points: [12.5, null, 13.2] }]}
      />,
    );
    await layout();

    await fireEvent(screen.getByTestId('chart-surface'), 'responderGrant', {
      nativeEvent: { locationX: 160 },
    });

    expect(screen.getByText(/2 Aug, 08:00 — Weight —/)).toBeTruthy();
  });

  it('falls back to whole numbers when no formatter is given', async () => {
    await render(<TrendChart {...props} />);
    await layout();

    await fireEvent(screen.getByTestId('chart-surface'), 'responderGrant', {
      nativeEvent: { locationX: 400 },
    });

    expect(screen.getByText(/Systolic 128 · Diastolic 82/)).toBeTruthy();
  });
});
