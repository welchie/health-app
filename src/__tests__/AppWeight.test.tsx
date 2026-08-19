/** The weight half of the app, end to end. */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { WeightEntry } from '../types';

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const history: WeightEntry[] = [
  { id: 'w1', takenAt: daysAgo(40), grams: 84000 },
  { id: 'w2', takenAt: daysAgo(7), grams: 82500 },
  { id: 'w3', takenAt: daysAgo(1), grams: 81193 },
];

const storeWeights = (entries: WeightEntry[]) =>
  AsyncStorage.setItem('bp-tracker/weights/v1', JSON.stringify(entries));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

const openWeight = async () => {
  await render(<App />);
  await waitFor(() => expect(screen.getByText('New reading')).toBeTruthy());
  await fireEvent.press(screen.getAllByText('Weight')[0]);
  await waitFor(() => expect(screen.getByText('New weight')).toBeTruthy());
};

const logWeight = async (stones: string, pounds?: string) => {
  await fireEvent.changeText(screen.getByLabelText('Stones st'), stones);
  if (pounds) {
    await fireEvent.changeText(screen.getByLabelText('Pounds lb, optional'), pounds);
  }
  await fireEvent.press(screen.getByText('Save weight'));
};

describe('logging a weight', () => {
  it('starts from the blood pressure form and switches to weight', async () => {
    await render(<App />);
    await waitFor(() => expect(screen.getByText('New reading')).toBeTruthy());

    await fireEvent.press(screen.getAllByText('Weight')[0]);

    expect(screen.getByText('New weight')).toBeTruthy();
    expect(screen.queryByText('New reading')).toBeNull();
  });

  it('shows a saved weight as the latest', async () => {
    await openWeight();

    await logWeight('12', '11');

    expect(screen.getByText('12 st 11.0 lb')).toBeTruthy();
    expect(screen.getByText(/Last weight today/)).toBeTruthy();
  });

  it('persists it in grams, so it survives a restart', async () => {
    await openWeight();
    await logWeight('12', '11');

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('bp-tracker/weights/v1');
      expect(JSON.parse(raw as string)).toEqual([
        expect.objectContaining({ grams: 81193 }),
      ]);
    });
  });

  it('leaves blood pressure readings untouched', async () => {
    await openWeight();
    await logWeight('12', '11');

    await expect(AsyncStorage.getItem('bp-tracker/readings/v1')).resolves.toBeNull();
  });
});

describe('weight trends', () => {
  it('charts and lists the weights in the period', async () => {
    await storeWeights(history);
    await openWeight();
    await fireEvent.press(screen.getByText('Trends'));

    expect(screen.getAllByText('Weight').length).toBeGreaterThan(0);
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getAllByText(/^12 st 11\.0 lb/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^12 st 13\.9 lb/)).toBeTruthy();
    // The 40-day-old weigh-in sits outside the default 30 day period.
    expect(screen.queryByText(/^13 st 3\.2 lb/)).toBeNull();
    expect(screen.queryByText('No readings in this period yet.')).toBeNull();
  });

  it('summarises the change across the period', async () => {
    await storeWeights(history);
    await openWeight();
    await fireEvent.press(screen.getByText('Trends'));

    expect(screen.getByText('Over this period')).toBeTruthy();
    // Once in the period summary, once as the newest row's change.
    expect(screen.getAllByText('-2.9 lb')).toHaveLength(2);
  });

  it('widens the period to include older weigh-ins', async () => {
    await storeWeights(history);
    await openWeight();
    await fireEvent.press(screen.getByText('Trends'));
    await fireEvent.press(screen.getByText('All'));

    expect(screen.getAllByText(/^13 st 3\.2 lb/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('-6.2 lb').length).toBeGreaterThan(0);
  });

  it('keeps blood pressure trends on their own side of the switcher', async () => {
    await storeWeights(history);
    await openWeight();
    await fireEvent.press(screen.getByText('Trends'));

    expect(screen.queryByText('Heart rate')).toBeNull();

    await fireEvent.press(screen.getAllByText('Blood pressure')[0]);

    expect(screen.getAllByText('Heart rate').length).toBeGreaterThan(0);
    expect(screen.queryByText('Over this period')).toBeNull();
  });
});

describe('the unit preference', () => {
  it('re-expresses stored weights without rewriting them', async () => {
    await storeWeights([history[2]]);
    await openWeight();
    expect(screen.getByText('12 st 11.0 lb')).toBeTruthy();

    await fireEvent.press(screen.getByText('Settings'));
    await fireEvent.press(screen.getByText('kg'));
    await fireEvent.press(screen.getByText('Log'));

    expect(screen.getByText('81.2 kg')).toBeTruthy();
    expect(screen.queryByText('12 st 11.0 lb')).toBeNull();

    // The stored grams are the same number they always were.
    const raw = await AsyncStorage.getItem('bp-tracker/weights/v1');
    expect(JSON.parse(raw as string)).toEqual([
      expect.objectContaining({ grams: 81193 }),
    ]);
  });

  it('remembers the choice for next launch', async () => {
    await openWeight();
    await fireEvent.press(screen.getByText('kg'));

    await waitFor(async () => {
      await expect(AsyncStorage.getItem('bp-tracker/units/v1')).resolves.toBe('kg');
    });
  });

  it('loads the saved preference on launch', async () => {
    await AsyncStorage.setItem('bp-tracker/units/v1', 'kg');
    await storeWeights([history[2]]);

    await openWeight();

    expect(screen.getByText('81.2 kg')).toBeTruthy();
    expect(screen.getByLabelText('Weight kg')).toBeTruthy();
  });
});

describe('deleting a weight', () => {
  it('removes it and forgets it', async () => {
    await storeWeights([history[2]]);
    await openWeight();
    await fireEvent.press(screen.getByText('Trends'));

    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent(screen.getByTestId('weight-row-w3'), 'longPress');
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await buttons.find((b) => b.text === 'Delete')?.onPress?.();

    await waitFor(() => expect(screen.getByText('No weights logged yet.')).toBeTruthy());
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('bp-tracker/weights/v1');
      expect(JSON.parse(raw as string)).toEqual([]);
    });
    alert.mockRestore();
  });
});
