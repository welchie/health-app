import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { Reading } from '../types';

const mocked = Notifications as jest.Mocked<typeof Notifications>;

const stored = (readings: Reading[]) =>
  AsyncStorage.setItem('bp-tracker/readings/v1', JSON.stringify(readings));

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const history: Reading[] = [
  { id: 'a', takenAt: daysAgo(40), systolic: 150, diastolic: 95, heartRate: 80 },
  { id: 'b', takenAt: daysAgo(3), systolic: 124, diastolic: 80, heartRate: 70 },
  { id: 'c', takenAt: daysAgo(1), systolic: 118, diastolic: 76, heartRate: 60 },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (mocked.getPermissionsAsync as jest.Mock).mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
});

const openApp = async () => {
  await render(<App />);
  await waitFor(() => expect(screen.getByText('New reading')).toBeTruthy());
};

const logReading = async (systolic: string, diastolic: string, pulse?: string) => {
  await fireEvent.changeText(screen.getByLabelText('Systolic top'), systolic);
  await fireEvent.changeText(screen.getByLabelText('Diastolic bottom'), diastolic);
  if (pulse) await fireEvent.changeText(screen.getByLabelText('Pulse optional'), pulse);
  await fireEvent.press(screen.getByText('Save reading'));
};

describe('App', () => {
  it('starts on the log tab prompting for a first reading', async () => {
    await openApp();

    expect(screen.getByText('Log your first reading below')).toBeTruthy();
    expect(screen.queryByText('Latest')).toBeNull();
  });

  it('shows a saved reading as the latest, with its band', async () => {
    await openApp();

    await logReading('128', '82', '66');

    expect(screen.getByText('Latest')).toBeTruthy();
    expect(screen.getAllByText(/^128/).length).toBeGreaterThan(0);
    expect(screen.getByText('High (stage 1)')).toBeTruthy();
    expect(screen.getByText(/66 bpm/)).toBeTruthy();
  });

  it('persists a reading so it survives a restart', async () => {
    await openApp();
    await logReading('128', '82', '66');

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('bp-tracker/readings/v1');
      expect(JSON.parse(raw as string)).toEqual([
        expect.objectContaining({ systolic: 128, diastolic: 82, heartRate: 66 }),
      ]);
    });
  });

  it('loads readings saved by a previous run', async () => {
    await stored(history);
    await openApp();

    expect(screen.getByText(/Last reading yesterday/)).toBeTruthy();
    expect(screen.getByText('Average of your last 2 readings')).toBeTruthy();
  });

  it('averages only the readings inside the selected period', async () => {
    await stored(history);
    await openApp();

    // Default period is 30 days, so the 40-day-old 150/95 is left out.
    expect(screen.getByText('121')).toBeTruthy();
    expect(screen.getByText('78')).toBeTruthy();

    await fireEvent.press(screen.getByText('Trends'));
    await fireEvent.press(screen.getByText('All'));

    expect(screen.getByText('131')).toBeTruthy();
    expect(screen.getByText('84')).toBeTruthy();
  });

  it('lists the history on the trends tab', async () => {
    await stored(history);
    await openApp();

    await fireEvent.press(screen.getByText('Trends'));

    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByText(/^118\/76/)).toBeTruthy();
    expect(screen.getByText(/^124\/80/)).toBeTruthy();
    expect(screen.queryByText(/^150\/95/)).toBeNull();

    await fireEvent.press(screen.getByText('7 days'));

    expect(screen.queryByText(/^124\/80/)).toBeTruthy();
  });

  it('plots both charts on the trends tab', async () => {
    await stored(history);
    await openApp();

    await fireEvent.press(screen.getByText('Trends'));

    // Both the screen heading and the chart heading use this name.
    expect(screen.getAllByText('Blood pressure').length).toBe(2);
    expect(screen.getAllByText('Heart rate').length).toBeGreaterThan(0);
    expect(screen.queryByText('No readings in this period yet.')).toBeNull();
  });

  it('schedules a daily reminder when the switch is turned on', async () => {
    await openApp();
    await fireEvent.press(screen.getByText('Reminder'));

    await fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() =>
      expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: { type: 'daily', hour: 8, minute: 0 } }),
      ),
    );
    expect(screen.getByText(/reminder 0?8[:.]00/)).toBeTruthy();
  });

  it('remembers the reminder and cancels it when switched off', async () => {
    await AsyncStorage.setItem(
      'bp-tracker/reminder/v1',
      JSON.stringify({ enabled: true, hour: 21, minute: 30 }),
    );
    await openApp();

    expect(screen.getByText(/reminder 0?9[:.]30/)).toBeTruthy();
    await waitFor(() => expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1));

    // Pretend the launch-time reminder is now sitting in the OS queue.
    (mocked.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'queued', content: { data: { kind: 'bp-daily-reminder' } } },
    ]);

    await fireEvent.press(screen.getByText('Reminder'));
    await fireEvent(screen.getByRole('switch'), 'valueChange', false);

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('bp-tracker/reminder/v1');
      expect(JSON.parse(raw as string).enabled).toBe(false);
    });
    await waitFor(() =>
      expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('queued'),
    );
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('re-arms a saved reminder on launch', async () => {
    await AsyncStorage.setItem(
      'bp-tracker/reminder/v1',
      JSON.stringify({ enabled: true, hour: 7, minute: 15 }),
    );

    await openApp();

    await waitFor(() =>
      expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: { type: 'daily', hour: 7, minute: 15 } }),
      ),
    );
  });

  it('schedules nothing on launch when no reminder is set', async () => {
    await openApp();

    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('warns when the device refuses notification permission', async () => {
    (mocked.getPermissionsAsync as jest.Mock).mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    (mocked.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

    await openApp();
    await fireEvent.press(screen.getByText('Reminder'));
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() =>
      expect(screen.getByText(/Notifications are blocked for this app/)).toBeTruthy(),
    );
  });

  it('deletes a reading and forgets it', async () => {
    await stored([history[2]]);
    await openApp();
    await fireEvent.press(screen.getByText('Trends'));

    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent(screen.getByText(/^118\/76/), 'longPress');
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await buttons.find((b) => b.text === 'Delete')?.onPress?.();

    await waitFor(() => expect(screen.getByText('Nothing logged yet.')).toBeTruthy());
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem('bp-tracker/readings/v1');
      expect(JSON.parse(raw as string)).toEqual([]);
    });
    alert.mockRestore();
  });
});
