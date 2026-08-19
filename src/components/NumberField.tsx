import React from 'react';
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  label: string;
  /** Shown under the field, and read out after the label. */
  hint: string;
  value: string;
  onChangeText: (value: string) => void;
  accent: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  /** Digits only by default; weights in kilograms also allow one decimal point. */
  allowDecimal?: boolean;
};

/** Shared by the blood pressure and weight forms so they read as one app. */
export default function NumberField({
  label,
  hint,
  value,
  onChangeText,
  accent,
  keyboardType = 'number-pad',
  maxLength = 3,
  allowDecimal = false,
}: Props) {
  const sanitise = (text: string) => {
    if (!allowDecimal) return text.replace(/[^0-9]/g, '');
    const digitsAndDots = text.replace(/[^0-9.]/g, '');
    const [whole, ...rest] = digitsAndDots.split('.');
    return rest.length ? `${whole}.${rest.join('').slice(0, 1)}` : whole;
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor: value ? accent : colors.border }]}
        value={value}
        onChangeText={(text) => onChangeText(sanitise(text))}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholder="--"
        placeholderTextColor={colors.muted}
        accessibilityLabel={`${label} ${hint}`}
      />
      <Text style={styles.fieldHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
