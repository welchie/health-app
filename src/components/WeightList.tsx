import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatWhen } from '../bp';
import { colors } from '../theme';
import { WeightEntry, WeightUnit } from '../types';
import { formatWeight, formatWeightDelta } from '../weight';

type Props = {
  /** Newest first. */
  entries: WeightEntry[];
  unit: WeightUnit;
  onDelete: (id: string) => void;
};

export default function WeightList({ entries, unit, onDelete }: Props) {
  if (entries.length === 0) {
    return <Text style={styles.empty}>No weights logged yet.</Text>;
  }

  const confirmDelete = (entry: WeightEntry) =>
    Alert.alert(
      'Delete weight?',
      `${formatWeight(entry.grams, unit)} on ${formatWhen(entry.takenAt)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
      ],
    );

  return (
    <View>
      {entries.map((entry, index) => {
        // Entries run newest first, so the next one along is the previous weigh-in.
        const previous = entries[index + 1];
        const delta = previous ? entry.grams - previous.grams : null;
        return (
          <TouchableOpacity
            key={entry.id}
            testID={`weight-row-${entry.id}`}
            style={styles.row}
            onLongPress={() => confirmDelete(entry)}
            delayLongPress={350}
            accessibilityHint="Long press to delete"
          >
            <View style={[styles.bar, { backgroundColor: colors.weight }]} />
            <View style={styles.main}>
              <Text style={styles.value}>
                {formatWeight(entry.grams, unit)}
                {delta != null && (
                  <Text style={[styles.delta, delta > 0 && styles.deltaUp]}>
                    {'   '}
                    {formatWeightDelta(delta, unit)}
                  </Text>
                )}
              </Text>
              <Text style={styles.when}>{formatWhen(entry.takenAt)}</Text>
              {entry.note && <Text style={styles.note}>{entry.note}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.hint}>Long press a weight to delete it.</Text>
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
  delta: { fontSize: 13, fontWeight: '600', color: colors.accent },
  deltaUp: { color: colors.weight },
  when: { fontSize: 12, color: colors.muted, marginTop: 2 },
  note: { fontSize: 12, color: colors.text, marginTop: 4, fontStyle: 'italic' },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: 20 },
  hint: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 4 },
});
