import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { categorise, formatWhen } from '../bp';
import { categoryColors, colors } from '../theme';
import { Reading } from '../types';

type Props = {
  readings: Reading[];
  onDelete: (id: string) => void;
};

export default function ReadingList({ readings, onDelete }: Props) {
  if (readings.length === 0) {
    return <Text style={styles.empty}>Nothing logged yet.</Text>;
  }

  const confirmDelete = (reading: Reading) =>
    Alert.alert(
      'Delete reading?',
      `${reading.systolic}/${reading.diastolic} on ${formatWhen(reading.takenAt)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(reading.id) },
      ],
    );

  return (
    <View>
      {readings.map((r) => {
        const category = categorise(r.systolic, r.diastolic);
        return (
          <TouchableOpacity
            key={r.id}
            style={styles.row}
            onLongPress={() => confirmDelete(r)}
            delayLongPress={350}
            accessibilityHint="Long press to delete"
          >
            <View style={[styles.bar, { backgroundColor: categoryColors[category] }]} />
            <View style={styles.main}>
              <Text style={styles.value}>
                {r.systolic}/{r.diastolic}
                <Text style={styles.unit}> mmHg</Text>
                {r.heartRate != null && (
                  <Text style={styles.pulse}>   {r.heartRate} bpm</Text>
                )}
              </Text>
              <Text style={styles.when}>
                {formatWhen(r.takenAt)} · {category}
              </Text>
              {r.note && <Text style={styles.note}>{r.note}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.hint}>Long press a reading to delete it.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  bar: { width: 4 },
  main: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  value: { fontSize: 17, fontWeight: '700', color: colors.text },
  unit: { fontSize: 11, fontWeight: '500', color: colors.muted },
  pulse: { fontSize: 13, fontWeight: '600', color: colors.pulse },
  when: { fontSize: 12, color: colors.muted, marginTop: 2 },
  note: { fontSize: 12, color: colors.text, marginTop: 4, fontStyle: 'italic' },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 20 },
  hint: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 4 },
});
