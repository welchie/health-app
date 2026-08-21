import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MedicationForm from '../components/MedicationForm';

const setup = async () => {
  const onSave = jest.fn();
  const onCancel = jest.fn();
  await render(<MedicationForm onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel };
};

const type = async (label: string, value: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), value);
};

const save = async () => {
  await fireEvent.press(screen.getByText('Save reminder'));
};

describe('MedicationForm', () => {
  it('saves name and default once daily time', async () => {
    const { onSave } = await setup();

    await type('Medication name', 'Aspirin');
    await save();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'Aspirin',
      times: [{ hour: 8, minute: 0 }],
      instruction: '',
    });
  });

  it('validates that medication name is required', async () => {
    const { onSave } = await setup();

    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Medication name is required.')).toBeTruthy();
  });

  it('allows selecting frequency and updates times list accordingly', async () => {
    const { onSave } = await setup();

    await type('Medication name', 'Ibuprofen');
    
    // Switch to Twice daily
    await fireEvent.press(screen.getByLabelText('2 times a day'));
    
    // Wait for Time 2 row to be rendered, ensuring state update is complete
    await screen.findByText('Time 2');

    await save();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].times).toEqual([
      { hour: 8, minute: 0 },
      { hour: 20, minute: 0 },
    ]);
  });

  it('allows adding instructions and using suggestion chips', async () => {
    const { onSave } = await setup();

    await type('Medication name', 'Metformin');
    
    // Tap on the 'After food' suggestion chip
    await fireEvent.press(screen.getByLabelText('Set instruction to After food'));
    await save();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].instruction).toBe('After food');
  });

  it('triggers onCancel when cancel is pressed', async () => {
    const { onCancel } = await setup();

    await fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
