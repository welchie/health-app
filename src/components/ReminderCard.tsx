import React, { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatClock } from '../bp';
import { colors } from '../theme';
import { ReminderSettings } from '../types';

type Props = {
  settings: ReminderSettings;
  onChange: (next: ReminderSettings) => void;
  /** Why the reminder cannot fire, when that is the case. */
  problem: 'denied' | 'unsupported' | null;
};

export default function ReminderCard({ settings, onChange, problem }: Props) {
  const [picking, setPicking] = useState(false);

  const time = new Date();
  time.setHours(settings.hour, settings.minute, 0, 0);

  const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPicking(false);
    if (event.type === 'dismissed' || !date) return;
    onChange({ ...settings, hour: date.getHours(), minute: date.getMinutes() });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Daily reminder</Text>
          <Text style={styles.subtitle}>
            A notification every day to take your blood pressure.
          </Text>
        </View>
        <Switch
          value={settings.enabled}
          onValueChange={(enabled) => onChange({ ...settings, enabled })}
          trackColor={{ true: colors.accent }}
        />
      </View>

      {settings.enabled && (
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>Remind me at</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={time}
              mode="time"
              display="compact"
              onChange={onTimeChange}
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
        <DateTimePicker value={time} mode="time" display="clock" onChange={onTimeChange} />
      )}

      {problem === 'denied' && (
        <Text style={styles.warning}>
          Notifications are blocked for this app. Enable them in your device settings to
          get the reminder.
        </Text>
      )}

      {problem === 'unsupported' && (
        <Text style={styles.warning}>
          Expo Go on Android cannot schedule notifications. Your time is saved, and the
          reminder will start working in a development build (npx expo run:android).
        </Text>
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
  warning: { marginTop: 12, fontSize: 12, color: colors.danger },
});
