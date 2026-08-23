import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ReadingList from '../components/ReadingList';
import { BloodPressureReading } from '../types';

const readings: BloodPressureReading[] = [
  {
    id: '1',
    takenAt: new Date().toISOString(),
    systolic: 145,
    diastolic: 92,
    heartRate: 74,
    note: 'after coffee',
  },
  {
    id: '2',
    takenAt: new Date(Date.now() - 86400000).toISOString(),
    systolic: 118,
    diastolic: 74,
    heartRate: null,
  },
];

afterEach(() => jest.restoreAllMocks());

describe('ReadingList', () => {
  it('tells you when there is nothing logged', async () => {
    await render(<ReadingList readings={[]} onDelete={jest.fn()} />);

    expect(screen.getByText('Nothing logged yet.')).toBeTruthy();
  });

  it('shows each reading with its band', async () => {
    await render(<ReadingList readings={readings} onDelete={jest.fn()} />);

    expect(screen.getByText(/^145\/92/)).toBeTruthy();
    expect(screen.getByText(/^118\/74/)).toBeTruthy();
    expect(screen.getByText(/High \(stage 2\)/)).toBeTruthy();
    expect(screen.getByText(/Normal/)).toBeTruthy();
  });

  it('shows the pulse only when one was recorded', async () => {
    await render(<ReadingList readings={readings} onDelete={jest.fn()} />);

    expect(screen.getByText(/74 bpm/)).toBeTruthy();
    expect(screen.queryByText(/null bpm/)).toBeNull();
  });

  it('shows a note when there is one', async () => {
    await render(<ReadingList readings={readings} onDelete={jest.fn()} />);

    expect(screen.getByText('after coffee')).toBeTruthy();
  });

  it('asks for confirmation before deleting and deletes on confirm', async () => {
    const onDelete = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<ReadingList readings={readings} onDelete={onDelete} />);

    await fireEvent(screen.getByText(/^145\/92/), 'longPress');

    expect(alert).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Delete')?.onPress?.();

    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('keeps the reading when the confirmation is cancelled', async () => {
    const onDelete = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<ReadingList readings={readings} onDelete={onDelete} />);

    await fireEvent(screen.getByText(/^118\/74/), 'longPress');
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Cancel')?.onPress?.();

    expect(onDelete).not.toHaveBeenCalled();
  });
});
