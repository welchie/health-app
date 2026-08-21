import React from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { formatClock } from '../bp';
import { colors } from '../theme';
import { MedicationReminder } from '../types';

type Props = {
  medications: MedicationReminder[];
  onEdit: (med: MedicationReminder) => void;
  onDelete: (id: string) => void;
  onToggle: (med: MedicationReminder, enabled: boolean) => void;
  onAdd: () => void;
};

export default function MedicationList({
  medications,
  onEdit,
  onDelete,
  onToggle,
  onAdd,
}: Props) {
  const confirmDelete = (med: MedicationReminder) =>
    Alert.alert(
      'Delete medication reminder?',
      `Are you sure you want to delete the reminder for ${med.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(med.id) },
      ],
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medications</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add medication reminder"
        >
          <Text style={styles.addButtonText}>+ Add reminder</Text>
        </TouchableOpacity>
      </View>

      {medications.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No medication reminders set up yet.</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={onAdd}
            accessibilityRole="button"
          >
            <Text style={styles.emptyButtonText}>Set up medication reminder</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {medications.map((med) => {
            const timeLabels = med.times
              .map((t) => formatClock(t.hour, t.minute))
              .join(', ');

            return (
              <View key={med.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName}>{med.name}</Text>
                    <Text style={styles.frequencyLabel}>
                      {med.times.length === 1
                        ? 'Once daily'
                        : med.times.length === 2
                          ? 'Twice daily'
                          : 'Three times daily'}{' '}
                      at {timeLabels}
                    </Text>
                  </View>
                  <Switch
                    value={med.enabled}
                    onValueChange={(enabled) => onToggle(med, enabled)}
                    trackColor={{ true: colors.accent }}
                    accessibilityLabel={`Toggle reminder for ${med.name}`}
                  />
                </View>

                {med.instruction ? (
                  <View style={styles.instructionContainer}>
                    <Text style={styles.instructionText}>
                      Take: {med.instruction}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => onEdit(med)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${med.name}`}
                  >
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDelete(med)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${med.name}`}
                  >
                    <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  emptyButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  list: { gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  medName: { fontSize: 17, fontWeight: '700', color: colors.text },
  frequencyLabel: { fontSize: 13, color: colors.muted, marginTop: 2 },
  instructionContainer: {
    marginTop: 10,
    backgroundColor: colors.bg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  instructionText: { fontSize: 13, color: colors.text, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.bg,
    paddingTop: 10,
  },
  editButton: { padding: 4 },
  deleteButton: { padding: 4 },
  actionText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  deleteText: { color: colors.danger },
});
