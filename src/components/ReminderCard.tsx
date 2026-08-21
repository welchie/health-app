import React, { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { formatClock } from '../bp';
import { colors } from '../theme';
import { ReminderSettings } from '../types';

type Props = {
  title: string;
  subtitle: string;
  /** Weekly reminders also choose a day. */
  cadence: 'daily' | 'weekly';
  settings: ReminderSettings;
  onChange: (next: ReminderSettings) => void;
};

/** Index is the expo weekday number, where 1 is Sunday. */
const DAYS = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ReminderCard({
  title,
  subtitle,
  cadence,
  settings,
  onChange,
}: Props) {
  const [picking, setPicking] = useState(false);

  const time = new Date();
  time.setHours(settings.hour, settings.minute, 0, 0);

  const onTimeValueChange = (event: DateTimePickerChangeEvent, date: Date) => {
    if (Platform.OS === 'android') setPicking(false);
    if (!date) return;
    onChange({ ...settings, hour: date.getHours(), minute: date.getMinutes() });
  };

  const onTimeDismiss = () => {
    if (Platform.OS === 'android') setPicking(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Switch
          value={settings.enabled}
          onValueChange={(enabled) => onChange({ ...settings, enabled })}
          trackColor={{ true: colors.accent }}
          accessibilityLabel={title}
        />
      </View>

      {settings.enabled && cadence === 'weekly' && (
        <View style={styles.dayRow}>
          {[2, 3, 4, 5, 6, 7, 1].map((weekday) => {
            const selected = (settings.weekday ?? 2) === weekday;
            return (
              <TouchableOpacity
                key={weekday}
                style={[styles.dayChip, selected && styles.dayChipActive]}
                onPress={() => onChange({ ...settings, weekday })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.dayText, selected && styles.dayTextActive]}>
                  {DAYS[weekday]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {settings.enabled && (
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>Remind me at</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={time}
              mode="time"
              display="compact"
              onValueChange={onTimeValueChange}
              onDismiss={onTimeDismiss}
            />
          ) : (
            <TouchableOpacity style={styles.timeButton} onPress={() => setPicking(true)}>
              <Text style={styles.timeButtonText}>
                {formatClock(settings.hour, settings.minute)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {picking && Platform.OS === 'android' && (
        <DateTimePicker
          value={time}
          mode="time"
          display="clock"
          onValueChange={onTimeValueChange}
          onDismiss={onTimeDismiss}
        />
      )}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  dayRow: { flexDirection: 'row', gap: 4, marginTop: 14 },
  dayChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  dayText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  dayTextActive: { color: '#fff' },
  timeRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeLabel: { fontSize: 14, color: colors.text },
  timeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeButtonText: { fontSize: 16, fontWeight: '600', color: colors.text },
});
