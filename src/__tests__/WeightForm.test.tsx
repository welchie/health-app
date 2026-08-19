import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import WeightForm from '../components/WeightForm';
import { WeightUnit } from '../types';

const setup = async (unit: WeightUnit = 'st_lb') => {
  const onSave = jest.fn();
  const onChangeUnit = jest.fn();
  await render(<WeightForm unit={unit} onChangeUnit={onChangeUnit} onSave={onSave} />);
  return { onSave, onChangeUnit };
};

const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

const save = () => fireEvent.press(screen.getByText('Save weight'));

describe('stones and pounds entry', () => {
  it('saves stones and pounds as grams', async () => {
    const { onSave } = await setup();

    await type('Stones st', '12');
    await type('Pounds lb, optional', '11');
    await save();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].grams).toBe(81193);
    expect(Date.parse(onSave.mock.calls[0][0].takenAt)).not.toBeNaN();
  });

  it('treats pounds as optional', async () => {
    const { onSave } = await setup();

    await type('Stones st', '12');
    await save();

    expect(onSave.mock.calls[0][0].grams).toBe(76204);
  });

  it('accepts a fractional pound', async () => {
    const { onSave } = await setup();

    await type('Stones st', '12');
    await type('Pounds lb, optional', '11.5');
    await save();

    expect(onSave.mock.calls[0][0].grams).toBe(81420);
  });

  it('rejects 14 or more pounds, pointing at the stone instead', async () => {
    const { onSave } = await setup();

    await type('Stones st', '12');
    await type('Pounds lb, optional', '14');
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Pounds should be less than 14/)).toBeTruthy();
  });

  it('rejects an implausible weight', async () => {
    const { onSave } = await setup();

    await type('Stones st', '2');
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Weight should be between 3 and 47 stone/)).toBeTruthy();
  });

  it('cannot be submitted before stones are entered', async () => {
    const { onSave } = await setup();

    await type('Pounds lb, optional', '11');
    await save();

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('kilogram entry', () => {
  it('saves kilograms as grams', async () => {
    const { onSave } = await setup('kg');

    await type('Weight kg', '81.4');
    await save();

    expect(onSave.mock.calls[0][0].grams).toBe(81400);
  });

  it('accepts a whole number', async () => {
    const { onSave } = await setup('kg');

    await type('Weight kg', '80');
    await save();

    expect(onSave.mock.calls[0][0].grams).toBe(80000);
  });

  it('keeps only one decimal point', async () => {
    await setup('kg');

    await type('Weight kg', '81.4.7');

    expect(screen.getByLabelText('Weight kg').props.value).toBe('81.4');
  });

  it('strips letters', async () => {
    await setup('kg');

    await type('Weight kg', '8a1');

    expect(screen.getByLabelText('Weight kg').props.value).toBe('81');
  });

  it.each([
    ['19', 'below the minimum'],
    ['301', 'above the maximum'],
  ])('rejects %s kg, %s', async (value) => {
    const { onSave } = await setup('kg');

    await type('Weight kg', value);
    await save();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Weight should be between 20 and 300 kg/)).toBeTruthy();
  });
});

describe('switching units', () => {
  it('carries the entered weight across, rather than discarding it', async () => {
    const onSave = jest.fn();
    const onChangeUnit = jest.fn();
    const view = await render(
      <WeightForm unit="st_lb" onChangeUnit={onChangeUnit} onSave={onSave} />,
    );

    await type('Stones st', '12');
    await type('Pounds lb, optional', '11');
    await fireEvent.press(screen.getByText('kg'));
    expect(onChangeUnit).toHaveBeenCalledWith('kg');

    // The parent owns the unit, so re-render as it would.
    await view.rerender(
      <WeightForm unit="kg" onChangeUnit={onChangeUnit} onSave={onSave} />,
    );

    expect(screen.getByLabelText('Weight kg').props.value).toBe('81.2');

    await save();
    expect(onSave.mock.calls[0][0].grams).toBe(81200);
  });

  it('carries a kilogram entry back into stones and pounds', async () => {
    const onSave = jest.fn();
    const onChangeUnit = jest.fn();
    const view = await render(
      <WeightForm unit="kg" onChangeUnit={onChangeUnit} onSave={onSave} />,
    );

    await type('Weight kg', '81.2');
    await fireEvent.press(screen.getByText('st/lb'));
    await view.rerender(
      <WeightForm unit="st_lb" onChangeUnit={onChangeUnit} onSave={onSave} />,
    );

    expect(screen.getByLabelText('Stones st').props.value).toBe('12');
    expect(screen.getByLabelText('Pounds lb, optional').props.value).toBe('11.0');
  });

  it('leaves the fields alone when the entry is not usable yet', async () => {
    const onSave = jest.fn();
    const onChangeUnit = jest.fn();
    const view = await render(
      <WeightForm unit="st_lb" onChangeUnit={onChangeUnit} onSave={onSave} />,
    );

    await type('Stones st', '2');
    await fireEvent.press(screen.getByText('kg'));
    await view.rerender(
      <WeightForm unit="kg" onChangeUnit={onChangeUnit} onSave={onSave} />,
    );

    expect(screen.getByLabelText('Weight kg').props.value).toBe('');
  });

  it('does not report a change when the current unit is tapped', async () => {
    const { onChangeUnit } = await setup();

    await fireEvent.press(screen.getByText('st/lb'));

    expect(onChangeUnit).not.toHaveBeenCalled();
  });

  it('previews the weight in the other unit while typing', async () => {
    await setup();

    await type('Stones st', '12');
    await type('Pounds lb, optional', '11');

    expect(screen.getByText('Saves as: 81.2 kg')).toBeTruthy();
  });
});

describe('after saving', () => {
  it('clears the fields', async () => {
    await setup();

    await type('Stones st', '12');
    await type('Pounds lb, optional', '11');
    await save();

    expect(screen.getByLabelText('Stones st').props.value).toBe('');
    expect(screen.getByLabelText('Pounds lb, optional').props.value).toBe('');
  });

  it('keeps an optional note', async () => {
    const { onSave } = await setup();

    await type('Stones st', '12');
    await fireEvent.changeText(
      screen.getByPlaceholderText(/Note \(optional\)/),
      '  before breakfast  ',
    );
    await save();

    expect(onSave.mock.calls[0][0].note).toBe('before breakfast');
  });
});
