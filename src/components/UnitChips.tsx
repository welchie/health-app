import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { WeightUnit } from '../types';

type Props = {
  unit: WeightUnit;
  onChange: (unit: WeightUnit) => void;
};

const OPTIONS: [WeightUnit, string][] = [
  ['st_lb', 'st/lb'],
  ['kg', 'kg'],
];

export default function UnitChips({ unit, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map(([value, label]) => (
        <TouchableOpacity
          key={value}
          style={[styles.chip, unit === value && styles.chipActive]}
          onPress={() => onChange(value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: unit === value }}
        >
          <Text style={[styles.text, unit === value && styles.textActive]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  text: { fontSize: 12, fontWeight: '600', color: colors.muted },
  textActive: { color: '#fff' },
});
