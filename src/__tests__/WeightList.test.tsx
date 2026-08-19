import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import WeightList from '../components/WeightList';
import { WeightEntry } from '../types';

/** Newest first, as the app orders every list. */
const entries: WeightEntry[] = [
  {
    id: '1',
    takenAt: new Date().toISOString(),
    grams: 81193,
    note: 'before breakfast',
  },
  {
    id: '2',
    takenAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    grams: 82500,
  },
];

afterEach(() => jest.restoreAllMocks());

describe('WeightList', () => {
  it('says so when nothing is logged', async () => {
    await render(<WeightList entries={[]} unit="st_lb" onDelete={jest.fn()} />);

    expect(screen.getByText('No weights logged yet.')).toBeTruthy();
  });

  it('shows each weight in stones and pounds', async () => {
    await render(<WeightList entries={entries} unit="st_lb" onDelete={jest.fn()} />);

    expect(screen.getByText(/^12 st 11\.0 lb/)).toBeTruthy();
    expect(screen.getByText(/^12 st 13\.9 lb/)).toBeTruthy();
  });

  it('shows the same weights in kilograms when that is the preference', async () => {
    await render(<WeightList entries={entries} unit="kg" onDelete={jest.fn()} />);

    expect(screen.getByText(/^81\.2 kg/)).toBeTruthy();
    expect(screen.getByText(/^82\.5 kg/)).toBeTruthy();
  });

  it('shows the change against the previous weigh-in', async () => {
    await render(<WeightList entries={entries} unit="kg" onDelete={jest.fn()} />);

    expect(screen.getByText(/-1\.3 kg/)).toBeTruthy();
  });

  it('reports a change in pounds for stones users', async () => {
    await render(<WeightList entries={entries} unit="st_lb" onDelete={jest.fn()} />);

    expect(screen.getByText(/-2\.9 lb/)).toBeTruthy();
  });

  it('leaves the oldest entry without a change', async () => {
    await render(
      <WeightList entries={[entries[1]]} unit="kg" onDelete={jest.fn()} />,
    );

    expect(screen.queryByText(/kg[+-]/)).toBeNull();
    expect(screen.getByText(/^82\.5 kg/)).toBeTruthy();
  });

  it('shows a note when there is one', async () => {
    await render(<WeightList entries={entries} unit="kg" onDelete={jest.fn()} />);

    expect(screen.getByText('before breakfast')).toBeTruthy();
  });

  it('confirms before deleting, and deletes on confirm', async () => {
    const onDelete = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<WeightList entries={entries} unit="kg" onDelete={onDelete} />);

    await fireEvent(screen.getByText(/^81\.2 kg/), 'longPress');

    expect(alert).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Delete')?.onPress?.();

    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('keeps the weight when the confirmation is cancelled', async () => {
    const onDelete = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<WeightList entries={entries} unit="kg" onDelete={onDelete} />);

    await fireEvent(screen.getByText(/^82\.5 kg/), 'longPress');
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Cancel')?.onPress?.();

    expect(onDelete).not.toHaveBeenCalled();
  });
});
