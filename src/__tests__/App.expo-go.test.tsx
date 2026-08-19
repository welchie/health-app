/**
 * The app must still open, and say why, where reminders cannot work at all -
 * Expo Go on Android. Own file because it replaces the notifications module
 * before App is loaded.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('../notifications', () => ({
  remindersSupported: false,
  scheduleDailyReminder: jest.fn(async () => 'unsupported'),
}));

const { scheduleDailyReminder } = require('../notifications');
const App = require('../../App').default;

describe('where reminders are unsupported', () => {
  it('still opens the app', async () => {
    await render(<App />);

    await waitFor(() => expect(screen.getByText('New reading')).toBeTruthy());
  });

  it('explains that Expo Go on Android cannot schedule reminders', async () => {
    await render(<App />);
    await waitFor(() => expect(screen.getByText('New reading')).toBeTruthy());

    await fireEvent.press(screen.getByText('Reminder'));

    expect(
      screen.getByText(/Expo Go on Android cannot schedule notifications/),
    ).toBeTruthy();
  });

  it('does not claim a reminder is set in the header', async () => {
    await render(<App />);
    await waitFor(() => expect(screen.getByText('New reading')).toBeTruthy());

    await fireEvent.press(screen.getByText('Reminder'));
    await fireEvent(screen.getByRole('switch'), 'valueChange', true);

    await waitFor(() => expect(scheduleDailyReminder).toHaveBeenCalled());
    expect(screen.queryByText(/· reminder/)).toBeNull();
  });
});
