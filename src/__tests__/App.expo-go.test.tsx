/**
 * The app must still open, and say why, where reminders cannot work at all -
 * Expo Go on Android. Own file because it replaces the notifications module
 * before App is loaded.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('../notifications', () => ({
  remindersSupported: false,
  scheduleReminder: jest.fn(async () => 'unsupported'),
  cancelReminder: jest.fn(async () => undefined),
}));

const { scheduleReminder } = require('../notifications');
const App = require('../../App').default;

describe('where reminders are unsupported', () => {
  it('still opens the app', async () => {
    await render(<App />);

    await waitFor(() => expect(screen.getAllByText('Summary').length).toBeGreaterThan(0));
  });

  it('explains that Expo Go on Android cannot schedule reminders', async () => {
    await render(<App />);
    await waitFor(() => expect(screen.getAllByText('Summary').length).toBeGreaterThan(0));

    await fireEvent.press(screen.getAllByText('Settings')[0]);

    expect(
      screen.getByText(/Expo Go on Android cannot schedule notifications/),
    ).toBeTruthy();
  });

  it('does not claim a reminder is set in the header', async () => {
    await render(<App />);
    await waitFor(() => expect(screen.getAllByText('Summary').length).toBeGreaterThan(0));

    await fireEvent.press(screen.getAllByText('Settings')[0]);
    await fireEvent(screen.getByLabelText('Daily reminder'), 'valueChange', true);

    await waitFor(() => expect(scheduleReminder).toHaveBeenCalledWith('bp', expect.anything()));
    expect(screen.queryByText(/· reminder/)).toBeNull();
  });
});
