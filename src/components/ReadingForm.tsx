import React, { useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { categorise } from '../bp';
import { categoryColors, colors } from '../theme';
import { Reading } from '../types';

type Props = {
  onSave: (reading: Omit<Reading, 'id'>) => void;
};

const RANGES = {
  systolic: { min: 60, max: 260 },
  diastolic: { min: 30, max: 200 },
  heartRate: { min: 30, max: 220 },
};

export default function ReadingForm({ onSave }: Props) {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sys = Number(systolic);
  const dia = Number(diastolic);
  const preview =
    systolic && diastolic && Number.isFinite(sys) && Number.isFinite(dia)
      ? categorise(sys, dia)
      : null;

  const submit = () => {
    const hr = heartRate.trim() === '' ? null : Number(heartRate);

    if (!Number.isInteger(sys) || sys < RANGES.systolic.min || sys > RANGES.systolic.max) {
      return setError(`Systolic should be between ${RANGES.systolic.min} and ${RANGES.systolic.max}.`);
    }
    if (!Number.isInteger(dia) || dia < RANGES.diastolic.min || dia > RANGES.diastolic.max) {
      return setError(`Diastolic should be between ${RANGES.diastolic.min} and ${RANGES.diastolic.max}.`);
    }
    if (dia >= sys) {
      return setError('Systolic (the top number) should be higher than diastolic.');
    }
    if (
      hr != null &&
      (!Number.isInteger(hr) || hr < RANGES.heartRate.min || hr > RANGES.heartRate.max)
    ) {
      return setError(`Heart rate should be between ${RANGES.heartRate.min} and ${RANGES.heartRate.max}.`);
    }

    setError(null);
    onSave({
      takenAt: new Date().toISOString(),
      systolic: sys,
      diastolic: dia,
      heartRate: hr,
      note: note.trim() || undefined,
    });
    setSystolic('');
    setDiastolic('');
    setHeartRate('');
    setNote('');
    Keyboard.dismiss();
  };

  const ready = systolic !== '' && diastolic !== '';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>New reading</Text>

      <View style={styles.row}>
        <Field
          label="Systolic"
          hint="top"
          value={systolic}
          onChangeText={setSystolic}
          accent={colors.systolic}
        />
        <Field
          label="Diastolic"
          hint="bottom"
          value={diastolic}
          onChangeText={setDiastolic}
          accent={colors.diastolic}
        />
        <Field
          label="Pulse"
          hint="optional"
          value={heartRate}
          onChangeText={setHeartRate}
          accent={colors.pulse}
        />
      </View>

      <TextInput
        style={styles.note}
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional) — e.g. after a walk, left arm"
        placeholderTextColor={colors.muted}
      />

      {preview && (
        <View style={styles.previewRow}>
          <View style={[styles.dot, { backgroundColor: categoryColors[preview] }]} />
          <Text style={styles.previewText}>Reads as: {preview}</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, !ready && styles.buttonDisabled]}
        onPress={submit}
        disabled={!ready}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Save reading</Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({
  label,
  hint,
  value,
  onChangeText,
  accent,
}: {
  label: string;
  hint: string;
  value: string;
  onChangeText: (v: string) => void;
  accent: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor: value ? accent : colors.border }]}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={3}
        placeholder="--"
        placeholderTextColor={colors.muted}
        accessibilityLabel={`${label} ${hint}`}
      />
      <Text style={styles.fieldHint}>{hint}</Text>
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  fieldHint: { fontSize: 10, color: colors.muted, marginTop: 3 },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: '#fbfcfe',
  },
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
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  previewText: { fontSize: 13, color: colors.text },
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
