import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { WeightEntry, WeightUnit } from '../types';
import {
  formatWeight,
  gramsToKg,
  gramsToStoneLbs,
  isPlausibleWeight,
  kgToGrams,
  MAX_GRAMS,
  MIN_GRAMS,
  POUNDS_PER_STONE,
  stoneLbsToGrams,
} from '../weight';
import NumberField from './NumberField';
import UnitChips from './UnitChips';

type Props = {
  unit: WeightUnit;
  onChangeUnit: (unit: WeightUnit) => void;
  onSave: (entry: Omit<WeightEntry, 'id'>) => void;
};

const MIN_STONES = Math.floor(MIN_GRAMS / 6350.29318);
const MAX_STONES = Math.floor(MAX_GRAMS / 6350.29318);
const MIN_KG = Math.round(gramsToKg(MIN_GRAMS));
const MAX_KG = Math.round(gramsToKg(MAX_GRAMS));

export default function WeightForm({ unit, onChangeUnit, onSave }: Props) {
  const [kg, setKg] = useState('');
  const [stones, setStones] = useState('');
  const [pounds, setPounds] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Grams for whatever is currently typed, or null when it is not usable yet. */
  const enteredGrams = (): number | null => {
    if (unit === 'kg') {
      if (kg === '' || kg === '.') return null;
      const value = Number(kg);
      return Number.isFinite(value) ? kgToGrams(value) : null;
    }
    if (stones === '') return null;
    const stonesValue = Number(stones);
    const poundsValue = pounds === '' || pounds === '.' ? 0 : Number(pounds);
    if (!Number.isFinite(stonesValue) || !Number.isFinite(poundsValue)) return null;
    return stoneLbsToGrams(stonesValue, poundsValue);
  };

  const grams = enteredGrams();

  /** Switching units re-expresses what is typed rather than discarding it. */
  const switchUnit = (next: WeightUnit) => {
    if (next === unit) return;
    setError(null);
    if (grams != null && isPlausibleWeight(grams)) {
      if (next === 'kg') {
        setKg(gramsToKg(grams).toFixed(1));
      } else {
        const split = gramsToStoneLbs(grams);
        setStones(String(split.stones));
        setPounds(split.pounds.toFixed(1));
      }
    }
    onChangeUnit(next);
  };

  const submit = () => {
    if (unit === 'st_lb') {
      const poundsValue = pounds === '' || pounds === '.' ? 0 : Number(pounds);
      if (poundsValue >= POUNDS_PER_STONE) {
        return setError('Pounds should be less than 14 — add a stone instead.');
      }
    }

    if (grams == null || !isPlausibleWeight(grams)) {
      return setError(
        unit === 'kg'
          ? `Weight should be between ${MIN_KG} and ${MAX_KG} kg.`
          : `Weight should be between ${MIN_STONES} and ${MAX_STONES} stone.`,
      );
    }

    setError(null);
    onSave({
      takenAt: new Date().toISOString(),
      grams,
      note: note.trim() || undefined,
    });
    setKg('');
    setStones('');
    setPounds('');
    setNote('');
    Keyboard.dismiss();
  };

  const ready = unit === 'kg' ? kg !== '' : stones !== '';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>New weight</Text>
        <UnitChips unit={unit} onChange={switchUnit} />
      </View>

      {unit === 'kg' ? (
        <View style={styles.row}>
          <NumberField
            label="Weight"
            hint="kg"
            value={kg}
            onChangeText={setKg}
            accent={colors.weight}
            keyboardType="decimal-pad"
            maxLength={5}
            allowDecimal
          />
          <View style={styles.spacer} />
        </View>
      ) : (
        <View style={styles.row}>
          <NumberField
            label="Stones"
            hint="st"
            value={stones}
            onChangeText={setStones}
            accent={colors.weight}
            maxLength={2}
          />
          <NumberField
            label="Pounds"
            hint="lb, optional"
            value={pounds}
            onChangeText={setPounds}
            accent={colors.weight}
            keyboardType="decimal-pad"
            maxLength={4}
            allowDecimal
          />
        </View>
      )}

      <TextInput
        style={styles.note}
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional) — e.g. before breakfast"
        placeholderTextColor={colors.muted}
      />

      {grams != null && isPlausibleWeight(grams) && (
        <Text style={styles.preview}>
          Saves as: {formatWeight(grams, unit === 'kg' ? 'st_lb' : 'kg')}
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, !ready && styles.buttonDisabled]}
        onPress={submit}
        disabled={!ready}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Save weight</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: 10 },
  spacer: { flex: 1 },
  note: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
  },
  preview: { marginTop: 12, fontSize: 13, color: colors.muted },
  error: { marginTop: 10, fontSize: 12, color: colors.danger },
  button: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
