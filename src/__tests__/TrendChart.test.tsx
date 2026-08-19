import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import TrendChart, { Series } from '../components/TrendChart';

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
