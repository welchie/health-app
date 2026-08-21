import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MedicationList from '../components/MedicationList';
import { MedicationReminder } from '../types';

const medications: MedicationReminder[] = [
  {
    id: 'm1',
    name: 'Metformin',
    enabled: true,
    times: [
      { hour: 8, minute: 0 },
      { hour: 20, minute: 30 },
    ],
    instruction: 'With food',
  },
  {
    id: 'm2',
    name: 'Aspirin',
    enabled: false,
    times: [{ hour: 9, minute: 15 }],
    instruction: '',
  },
];

afterEach(() => jest.restoreAllMocks());

describe('MedicationList', () => {
  it('renders empty card when there are no medications', async () => {
    const onAdd = jest.fn();
    await render(
      <MedicationList
        medications={[]}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onToggle={jest.fn()}
        onAdd={onAdd}
      />,
    );

    expect(screen.getByText('No medication reminders set up yet.')).toBeTruthy();
    
    // Tap on setup button
    fireEvent.press(screen.getByText('Set up medication reminder'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('renders medication items with details', async () => {
    await render(
      <MedicationList
        medications={medications}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onToggle={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    expect(screen.getByText('Metformin')).toBeTruthy();
    expect(screen.getByText('Aspirin')).toBeTruthy();
    expect(screen.getByText('Take: With food')).toBeTruthy();
    
    // Check formatted frequency label
    expect(screen.getByText(/Twice daily\s+at\s+08:00 AM, 08:30 PM/)).toBeTruthy();
    expect(screen.getByText(/Once daily\s+at\s+09:15 AM/)).toBeTruthy();
  });

  it('triggers onToggle when switch is toggled', async () => {
    const onToggle = jest.fn();
    await render(
      <MedicationList
        medications={medications}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onToggle={onToggle}
        onAdd={jest.fn()}
      />,
    );

    const toggle = screen.getByLabelText('Toggle reminder for Metformin');
    fireEvent(toggle, 'valueChange', false);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(medications[0], false);
  });

  it('triggers onEdit when edit action is pressed', async () => {
    const onEdit = jest.fn();
    await render(
      <MedicationList
        medications={medications}
        onEdit={onEdit}
        onDelete={jest.fn()}
        onToggle={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Edit Metformin'));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(medications[0]);
  });

  it('prompts confirmation and deletes a medication', async () => {
    const onDelete = jest.fn();
    await render(
      <MedicationList
        medications={medications}
        onEdit={jest.fn()}
        onDelete={onDelete}
        onToggle={jest.fn()}
        onAdd={jest.fn()}
      />,
    );

    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    fireEvent.press(screen.getByLabelText('Delete Metformin'));

    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Delete medication reminder?');

    // Simulate clicking delete
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await buttons.find((b) => b.text === 'Delete')?.onPress?.();

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('m1');
  });
});
