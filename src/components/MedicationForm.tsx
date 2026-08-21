import React, { useState, useEffect } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { formatClock } from '../bp';
import { colors } from '../theme';
import { MedicationReminder } from '../types';

type Props = {
  onSave: (medication: Omit<MedicationReminder, 'id'>) => void;
  onCancel: () => void;
  initialData?: MedicationReminder | null;
};

const SUGGESTED_INSTRUCTIONS = ['Before food', 'After food', 'With food', 'Before bed'];

export default function MedicationForm({ onSave, onCancel, initialData }: Props) {
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState('');
  const [times, setTimes] = useState<{ hour: number; minute: number }[]>([{ hour: 8, minute: 0 }]);
  const [pickingIndex, setPickingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setInstruction(initialData.instruction);
      setTimes(initialData.times);
    }
  }, [initialData]);

  const handleFrequencyChange = (count: number) => {
    let nextTimes = [...times];
    if (count === 1) {
      nextTimes = [times[0] || { hour: 8, minute: 0 }];
    } else if (count === 2) {
      nextTimes = [
        times[0] || { hour: 8, minute: 0 },
        times[1] || { hour: 20, minute: 0 },
      ];
    } else if (count === 3) {
      nextTimes = [
        times[0] || { hour: 8, minute: 0 },
        times[1] || { hour: 20, minute: 0 },
        times[2] || { hour: 14, minute: 0 },
      ];
    }
    setTimes(nextTimes);
  };

  const onTimeValueChange = (index: number) => (event: DateTimePickerChangeEvent, date: Date) => {
    if (Platform.OS === 'android') {
      setPickingIndex(null);
    }
    if (!date) return;

    const next = [...times];
    next[index] = { hour: date.getHours(), minute: date.getMinutes() };
    setTimes(next);
  };

  const onTimeDismiss = () => {
    if (Platform.OS === 'android') {
      setPickingIndex(null);
    }
  };

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return setError('Medication name is required.');
    }
    setError(null);
    onSave({
      name: trimmedName,
      enabled: initialData ? initialData.enabled : true,
      times,
      instruction: instruction.trim(),
    });
    setName('');
    setInstruction('');
    setTimes([{ hour: 8, minute: 0 }]);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {initialData ? 'Edit medication reminder' : 'New medication reminder'}
      </Text>

      <Text style={styles.label}>Medication name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Paracetamol"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        accessibilityLabel="Medication name"
      />

      <Text style={styles.label}>Frequency</Text>
      <View style={styles.chipsRow}>
        {([1, 2, 3] as const).map((count) => {
          const selected = times.length === count;
          return (
            <TouchableOpacity
              key={count}
              style={[styles.chip, selected && styles.chipActive]}
              onPress={() => handleFrequencyChange(count)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${count} time${count > 1 ? 's' : ''} a day`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {count === 1 ? 'Once daily' : count === 2 ? 'Twice daily' : 'Three times daily'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Reminder times</Text>
      {times.map((t, idx) => {
        const date = new Date();
        date.setHours(t.hour, t.minute, 0, 0);

        return (
          <View key={idx} style={styles.timeRow}>
            <Text style={styles.timeLabel}>Time {idx + 1}</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={date}
                mode="time"
                display="compact"
                onValueChange={onTimeValueChange(idx)}
                onDismiss={onTimeDismiss}
              />
            ) : (
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setPickingIndex(idx)}
                accessibilityRole="button"
                accessibilityLabel={`Select time ${idx + 1}`}
              >
                <Text style={styles.timeButtonText}>{formatClock(t.hour, t.minute)}</Text>
              </TouchableOpacity>
            )}
            {pickingIndex === idx && Platform.OS === 'android' && (
              <DateTimePicker
                value={date}
                mode="time"
                display="clock"
                onValueChange={onTimeValueChange(idx)}
                onDismiss={onTimeDismiss}
              />
            )}
          </View>
        );
      })}

      <Text style={styles.label}>Instructions (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. After food"
        placeholderTextColor={colors.muted}
        value={instruction}
        onChangeText={setInstruction}
        accessibilityLabel="Instructions optional"
      />

      <View style={styles.chipsRow}>
        {SUGGESTED_INSTRUCTIONS.map((suggestion) => (
          <TouchableOpacity
            key={suggestion}
            style={styles.suggestionChip}
            onPress={() => setInstruction(suggestion)}
            accessibilityRole="button"
            accessibilityLabel={`Set instruction to ${suggestion}`}
          >
            <Text style={styles.suggestionChipText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={submit} accessibilityRole="button">
        <Text style={styles.buttonText}>Save reminder</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onCancel}
        accessibilityRole="button"
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
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
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: '#fff' },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipText: { fontSize: 11, color: colors.muted },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg,
  },
  timeLabel: { fontSize: 14, color: colors.text },
  timeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  timeButtonText: { fontSize: 15, fontWeight: '600', color: colors.text },
  error: { marginTop: 10, fontSize: 12, color: colors.danger },
  button: {
    marginTop: 18,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
});
