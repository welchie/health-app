import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ReadingForm from '../components/ReadingForm';

const setup = async () => {
  const onSave = jest.fn();
  await render(<ReadingForm onSave={onSave} />);
  return { onSave };
};

const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

const save = () => fireEvent.press(screen.getByText('Save reading'));

describe('ReadingForm', () => {
  it('saves systolic, diastolic and heart rate', async () => {
    const { onSave } = await setup();

    await type('Systolic top', '128');
    await type('Diastolic bottom', '82');
    await type('Pulse optional', '66');
    await save();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      systolic: 128,
      diastolic: 82,
      heartRate: 66,
    });
    expect(Date.parse(onSave.mock.calls[0][0].takenAt)).not.toBeNaN();
  });

  it('treats heart rate as optional', async () => {
    const { onSave } = await setup();

    await type('Systolic top', '118');
    await type('Diastolic bottom', '76');
    await save();

    expect(onSave.mock.calls[0][0].heartRate).toBeNull();
  });

  it('keeps an optional note', async () => {
    const { onSave } = await setup();

    await type('Systolic top', '118');
    await type('Diastolic bottom', '76');
    await fireEvent.changeText(
      screen.getByPlaceholderText(/Note \(optional\)/),
      '  after a walk  ',
    );
    await save();

    expect(onSave.mock.calls[0][0].note).toBe('after a walk');
  });

  it('clears the fields after saving', async () => {
    await setup();

    await type('Systolic top', '128');
    await type('Diastolic bottom', '82');
    await save();

    expect(screen.getByLabelText('Systolic top').props.value).toBe('');
    expect(screen.getByLabelText('Diastolic bottom').props.value).toBe('');
  });

  it('strips anything that is not a digit', async () => {
    await setup();

    await type('Systolic top', '1a2!0');

    expect(screen.getByLabelText('Systolic top').props.value).toBe('120');
  });

  it('cannot be submitted until both pressures are entered', async () => {
    const { onSave } = await setup();

    await type('Systolic top', '128');
    await save();

    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects a systolic outside the plausible range', async () => {
    const { onSave } = await setup();

    await type('Systolic top', '300');
    await type('Diastolic bottom', '80');
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Systolic should be between 60 and 260/)).toBeTruthy();
  });

  it('rejects a diastolic outside the plausible range', async () => {
    const { onSave } = await setup();

    await type('Systolic top', '120');
    await type('Diastolic bottom', '20');
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Diastolic should be between 30 and 200/)).toBeTruthy();
  });

  it('rejects the two numbers being the wrong way round', async () => {
    const { onSave } = await setup();

    await type('Systolic top', '80');
    await type('Diastolic bottom', '120');
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/should be higher than diastolic/)).toBeTruthy();
  });

  it('rejects an implausible heart rate', async () => {
    const { onSave } = await setup();

    await type('Systolic top', '120');
    await type('Diastolic bottom', '80');
    await type('Pulse optional', '250');
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Heart rate should be between 30 and 220/)).toBeTruthy();
  });

  it('previews the band as you type', async () => {
    await setup();

    await type('Systolic top', '145');
    await type('Diastolic bottom', '92');

    expect(screen.getByText('Reads as: High (stage 2)')).toBeTruthy();
  });
});
