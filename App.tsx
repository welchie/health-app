import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import ReadingForm from './src/components/ReadingForm';
import ReadingList from './src/components/ReadingList';
import ReminderCard from './src/components/ReminderCard';
import TabIcon, { TabIconName } from './src/components/TabIcon';
import TrendChart, { Series } from './src/components/TrendChart';
import UnitChips from './src/components/UnitChips';
import WeightForm from './src/components/WeightForm';
import WeightList from './src/components/WeightList';
import MedicationForm from './src/components/MedicationForm';
import MedicationList from './src/components/MedicationList';
import {
  averageOf,
  categorise,
  formatClock,
  formatWhen,
  readingsWithinDays,
  sortByNewest,
} from './src/bp';
import {
  ReminderKind,
  remindersSupported,
  ScheduleResult,
  scheduleReminder,
  cancelMedicationReminders,
  scheduleMedicationReminders,
  rearmAllMedicationReminders,
} from './src/notifications';
import {
  loadReadings,
  loadReminder,
  loadWeightReminder,
  loadWeights,
  loadWeightUnit,
  saveReadings,
  saveReminder,
  saveWeightReminder,
  saveWeights,
  saveWeightUnit,
  loadMedications,
  saveMedications,
  tombstoneReading,
  tombstoneWeight,
} from './src/storage';
import { syncData, subscribeToSync, initSyncState, SyncState } from './src/sync';
import { categoryColors, colors } from './src/theme';
import {
  defaultReminder,
  defaultWeightReminder,
  defaultWeightUnit,
  BloodPressureReading,
  ReminderSettings,
  WeightEntry,
  WeightUnit,
  MedicationReminder,
} from './src/types';
import {
  averageGrams,
  formatChartAxis,
  formatChartPoint,
  formatWeight,
  formatWeightDelta,
  toChartValue,
  unitLabel,
  weightChange,
} from './src/weight';

type Tab = 'summary' | 'log' | 'trends' | 'meds' | 'settings';
type Metric = 'bp' | 'weight';
type ReminderProblem = 'denied' | 'unsupported' | null;

const problemFrom = (result: ScheduleResult): ReminderProblem =>
  result === 'denied' || result === 'unsupported' ? result : null;

type Range = 7 | 30 | 0; // 0 means everything

export default function App() {
  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [reminder, setReminder] = useState<ReminderSettings>(defaultReminder);
  const [weightReminder, setWeightReminder] =
    useState<ReminderSettings>(defaultWeightReminder);
  const [reminderProblem, setReminderProblem] = useState<ReminderProblem>(
    remindersSupported ? null : 'unsupported',
  );
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(defaultWeightUnit);
  const [medications, setMedications] = useState<MedicationReminder[]>([]);
  const [editingMedication, setEditingMedication] = useState<MedicationReminder | null>(null);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('summary');
  const [metric, setMetric] = useState<Metric>('bp');
  const [range, setRange] = useState<Range>(30);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSync((state, time) => {
      setSyncState(state);
      setLastSyncTime(time);
      if (state === 'synced') {
        (async () => {
          const [storedReadings, storedWeights] = await Promise.all([
            loadReadings(),
            loadWeights(),
          ]);
          setReadings(storedReadings);
          setWeights(storedWeights);
        })();
      }
    });

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncData().catch(() => {});
      }
    });

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const [
        storedReadings,
        storedReminder,
        storedWeights,
        storedUnit,
        storedWeightReminder,
        storedMedications,
      ] = await Promise.all([
        loadReadings(),
        loadReminder(),
        loadWeights(),
        loadWeightUnit(),
        loadWeightReminder(),
        loadMedications(),
      ]);
      setReadings(storedReadings);
      setReminder(storedReminder);
      setWeights(storedWeights);
      setWeightUnit(storedUnit);
      setWeightReminder(storedWeightReminder);
      setMedications(storedMedications);
      setLoading(false);

      await initSyncState();
      if (process.env.NODE_ENV !== 'test') {
        syncData().catch(() => {});
      }

      // Re-arm on launch: the OS drops scheduled notifications after some
      // events (reinstall, permission changes), and rescheduling is idempotent.
      if (storedReminder.enabled) {
        setReminderProblem(problemFrom(await scheduleReminder('bp', storedReminder)));
      }
      if (storedWeightReminder.enabled) {
        setReminderProblem(
          problemFrom(await scheduleReminder('weight', storedWeightReminder)),
        );
      }
      for (const med of storedMedications) {
        if (med.enabled) {
          const res = await scheduleMedicationReminders(med);
          const prob = problemFrom(res);
          if (prob) {
            setReminderProblem(prob);
          }
        }
      }
    })();
  }, []);

  const newest = useMemo(() => sortByNewest(readings), [readings]);
  const inRange = useMemo(
    () => (range === 0 ? newest : sortByNewest(readingsWithinDays(readings, range))),
    [newest, readings, range],
  );
  const average = useMemo(() => averageOf(inRange), [inRange]);
  const latest = newest[0];

  const addReading = async (reading: Omit<BloodPressureReading, 'id'>) => {
    const next = [...readings, { ...reading, id: `${Date.now()}` }];
    setReadings(next);
    await saveReadings(next);
    if (process.env.NODE_ENV !== 'test') {
      syncData().catch(() => {});
    }
  };

  const deleteReading = async (id: string) => {
    await tombstoneReading(id);
    const next = await loadReadings();
    setReadings(next);
    if (process.env.NODE_ENV !== 'test') {
      syncData().catch(() => {});
    }
  };

  const addWeight = async (entry: Omit<WeightEntry, 'id'>) => {
    const next = [...weights, { ...entry, id: `${Date.now()}` }];
    setWeights(next);
    await saveWeights(next);
    if (process.env.NODE_ENV !== 'test') {
      syncData().catch(() => {});
    }
  };

  const deleteWeight = async (id: string) => {
    await tombstoneWeight(id);
    const next = await loadWeights();
    setWeights(next);
    if (process.env.NODE_ENV !== 'test') {
      syncData().catch(() => {});
    }
  };

  /** Display-only: stored grams are untouched by a unit change. */
  const changeWeightUnit = async (unit: WeightUnit) => {
    setWeightUnit(unit);
    await saveWeightUnit(unit);
  };

  const updateReminder = async (kind: ReminderKind, next: ReminderSettings) => {
    if (kind === 'bp') {
      setReminder(next);
      await saveReminder(next);
    } else {
      setWeightReminder(next);
      await saveWeightReminder(next);
    }
    setReminderProblem(problemFrom(await scheduleReminder(kind, next)));
  };

  const addMedication = async (med: Omit<MedicationReminder, 'id'>) => {
    const next = [...medications, { ...med, id: `${Date.now()}` }];
    setMedications(next);
    await saveMedications(next);
    const scheduled = next[next.length - 1];
    setReminderProblem(problemFrom(await scheduleMedicationReminders(scheduled)));
    setShowMedicationForm(false);
  };

  const updateMedication = async (med: MedicationReminder) => {
    const next = medications.map((m) => (m.id === med.id ? med : m));
    setMedications(next);
    await saveMedications(next);
    setReminderProblem(problemFrom(await scheduleMedicationReminders(med)));
    setEditingMedication(null);
    setShowMedicationForm(false);
  };

  const deleteMedication = async (id: string) => {
    const next = medications.filter((m) => m.id !== id);
    setMedications(next);
    await saveMedications(next);
    await cancelMedicationReminders(id);
  };

  const toggleMedication = async (med: MedicationReminder, enabled: boolean) => {
    const updated = { ...med, enabled };
    const next = medications.map((m) => (m.id === med.id ? updated : m));
    setMedications(next);
    await saveMedications(next);
    setReminderProblem(problemFrom(await scheduleMedicationReminders(updated)));
  };

  const newestWeights = useMemo(() => sortByNewest(weights), [weights]);
  const weightsInRange = useMemo(
    () =>
      range === 0 ? newestWeights : sortByNewest(readingsWithinDays(weights, range)),
    [newestWeights, weights, range],
  );
  const latestWeight = newestWeights[0];
  const weightAverage = useMemo(() => averageGrams(weightsInRange), [weightsInRange]);
  const weightDelta = useMemo(() => weightChange(weightsInRange), [weightsInRange]);

  // Oldest to newest for plotting, positioned by actual time so gaps are visible.
  const chart = useMemo(() => {
    const series = [...inRange].reverse();
    if (series.length === 0) {
      return { labels: [], positions: [], bp: [] as Series[], pulse: [] as Series[] };
    }
    const times = series.map((r) => new Date(r.takenAt).getTime());
    const first = times[0];
    const span = times[times.length - 1] - first;
    return {
      labels: series.map((r) => formatWhen(r.takenAt)),
      positions: times.map((t) => (span === 0 ? 0.5 : (t - first) / span)),
      bp: [
        {
          key: 'systolic',
          label: 'Systolic',
          color: colors.systolic,
          points: series.map((r) => r.systolic),
        },
        {
          key: 'diastolic',
          label: 'Diastolic',
          color: colors.diastolic,
          points: series.map((r) => r.diastolic),
        },
      ] as Series[],
      pulse: [
        {
          key: 'pulse',
          label: 'Heart rate',
          color: colors.pulse,
          points: series.map((r) => r.heartRate),
        },
      ] as Series[],
    };
  }, [inRange]);

  const weightChart = useMemo(() => {
    const series = [...weightsInRange].reverse();
    if (series.length === 0) {
      return { labels: [], positions: [], weight: [] as Series[] };
    }
    const times = series.map((w) => new Date(w.takenAt).getTime());
    const first = times[0];
    const span = times[times.length - 1] - first;
    return {
      labels: series.map((w) => formatWhen(w.takenAt)),
      positions: times.map((t) => (span === 0 ? 0.5 : (t - first) / span)),
      weight: [
        {
          key: 'weight',
          label: 'Weight',
          color: colors.weight,
          points: series.map((w) => toChartValue(w.grams, weightUnit)),
        },
      ] as Series[],
    };
  }, [weightsInRange, weightUnit]);

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.screen, styles.centred]}>
          <ActivityIndicator color={colors.accent} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {tab === 'summary' ? (
              <>
                <Text style={styles.appTitle}>Summary</Text>
                <Text style={styles.appSubtitle}>Overview of your health metrics</Text>
              </>
            ) : tab === 'meds' ? (
              <>
                <Text style={styles.appTitle}>Medications</Text>
                <Text style={styles.appSubtitle}>Manage your medication reminders</Text>
              </>
            ) : (
              <>
                <Text style={styles.appTitle}>
                  {metric === 'bp' ? 'Blood pressure' : 'Weight'}
                </Text>
                <Text style={styles.appSubtitle}>
                  {metric === 'bp'
                    ? latest
                      ? `Last reading ${formatWhen(latest.takenAt).toLowerCase()}`
                      : 'Log your first reading below'
                    : latestWeight
                      ? `Last weight ${formatWhen(latestWeight.takenAt).toLowerCase()}`
                      : 'Log your first weight below'}
                  {metric === 'bp' && reminder.enabled && reminderProblem == null
                    ? ` · reminder ${formatClock(reminder.hour, reminder.minute)}`
                    : ''}
                </Text>
              </>
            )}

            {tab !== 'settings' && tab !== 'summary' && tab !== 'meds' && (
              <View style={styles.rangeRow}>
                {(
                  [
                    ['bp', 'Blood pressure'],
                    ['weight', 'Weight'],
                  ] as [Metric, string][]
                ).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.rangeChip, metric === key && styles.rangeChipActive]}
                    onPress={() => setMetric(key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: metric === key }}
                  >
                    <Text
                      style={[styles.rangeText, metric === key && styles.rangeTextActive]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {tab === 'summary' && (
              <>
                <View style={styles.averageGrid}>
                  <GridPanel
                    label="Systolic Avg"
                    value={average == null ? '—' : `${average.systolic}`}
                    unit="mmHg"
                    color={colors.systolic}
                  />
                  <GridPanel
                    label="Diastolic Avg"
                    value={average == null ? '—' : `${average.diastolic}`}
                    unit="mmHg"
                    color={colors.diastolic}
                  />
                  <GridPanel
                    label="Heart Rate Avg"
                    value={average?.heartRate == null ? '—' : `${average.heartRate}`}
                    unit="bpm"
                    color={colors.pulse}
                  />
                  <GridPanel
                    label="Average Weight"
                    value={weightAverage == null ? '—' : formatWeight(weightAverage, weightUnit)}
                    unit={unitLabel(weightUnit)}
                    color={colors.weight}
                  />
                  <GridPanel
                    label="Weight Change"
                    value={weightDelta == null ? '—' : formatWeightDelta(weightDelta, weightUnit)}
                    unit="this period"
                    color={
                      weightDelta == null
                        ? colors.muted
                        : weightDelta < 0
                          ? colors.accent
                          : weightDelta > 0
                            ? colors.danger
                            : colors.muted
                    }
                  />
                  <GridPanel
                    label="Weigh-ins Logged"
                    value={`${weightsInRange.length}`}
                    unit={`weigh-in${weightsInRange.length === 1 ? '' : 's'}`}
                    color={colors.accent}
                  />
                </View>

                <Text style={styles.sectionTitle}>Latest Readings</Text>
                
                {latest ? (
                  <LatestCard reading={latest} />
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Latest Blood Pressure</Text>
                    <Text style={styles.tip}>No blood pressure readings logged yet.</Text>
                  </View>
                )}

                {latestWeight ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Latest Weight</Text>
                    <View style={styles.heroRow}>
                      <Text style={styles.heroWeight}>
                        {formatWeight(latestWeight.grams, weightUnit)}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.heroMeta}>
                          {formatWhen(latestWeight.takenAt)}
                        </Text>
                        {weightDelta != null && (
                          <Text style={styles.heroMeta}>
                            {formatWeightDelta(weightDelta, weightUnit)} over this period
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Latest Weight</Text>
                    <Text style={styles.tip}>No weight records logged yet.</Text>
                  </View>
                )}

                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => {
                      setTab('log');
                      setMetric('bp');
                    }}
                  >
                    <Text style={styles.quickActionText}>Log Blood Pressure</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickActionButton}
                    onPress={() => {
                      setTab('log');
                      setMetric('weight');
                    }}
                  >
                    <Text style={styles.quickActionText}>Log Weight</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {tab === 'log' && metric === 'bp' && (
              <>
                <ReadingForm onSave={addReading} />
                {latest && <LatestCard reading={latest} />}
                {average && (
                  <>
                    <Text style={styles.sectionTitle}>
                      {`Average of your last ${average.count} reading${average.count === 1 ? '' : 's'}`}
                    </Text>
                    <BloodPressureGrid average={average} />
                  </>
                )}
              </>
            )}

            {tab === 'log' && metric === 'weight' && (
              <>
                <WeightForm
                  unit={weightUnit}
                  onChangeUnit={changeWeightUnit}
                  onSave={addWeight}
                />
                {latestWeight && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Latest</Text>
                    <View style={styles.heroRow}>
                      <Text style={styles.heroWeight}>
                        {formatWeight(latestWeight.grams, weightUnit)}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.heroMeta}>
                          {formatWhen(latestWeight.takenAt)}
                        </Text>
                        {weightDelta != null && (
                          <Text style={styles.heroMeta}>
                            {formatWeightDelta(weightDelta, weightUnit)} over this period
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}
                {weightAverage != null && (
                  <>
                    <Text style={styles.sectionTitle}>Average over this period</Text>
                    <WeightGrid
                      average={weightAverage}
                      delta={weightDelta}
                      unit={weightUnit}
                      count={weightsInRange.length}
                      latestGrams={latestWeight?.grams ?? null}
                    />
                  </>
                )}
              </>
            )}

            {tab === 'trends' && (
              <View style={styles.rangeRow}>
                  {([7, 30, 0] as Range[]).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.rangeChip, range === r && styles.rangeChipActive]}
                      onPress={() => setRange(r)}
                    >
                      <Text
                        style={[styles.rangeText, range === r && styles.rangeTextActive]}
                    >
                      {r === 0 ? 'All' : `${r} days`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {tab === 'trends' && metric === 'bp' && (
              <>
                <View style={styles.card}>
                  <TrendChart
                    title="Blood pressure"
                    unit="mmHg"
                    labels={chart.labels}
                    positions={chart.positions}
                    series={chart.bp}
                    guides={[
                      { value: 120, label: '120' },
                      { value: 80, label: '80' },
                    ]}
                  />
                </View>

                <View style={styles.card}>
                  <TrendChart
                    title="Heart rate"
                    unit="bpm"
                    labels={chart.labels}
                    positions={chart.positions}
                    series={chart.pulse}
                  />
                </View>

                {average && (
                  <>
                    <Text style={styles.sectionTitle}>Average over this period</Text>
                    <BloodPressureGrid average={average} />
                  </>
                )}

                <Text style={styles.sectionTitle}>History</Text>
                <ReadingList readings={inRange} onDelete={deleteReading} />
              </>
            )}

            {tab === 'trends' && metric === 'weight' && (
              <>
                <View style={styles.card}>
                  <TrendChart
                    title="Weight"
                    unit={unitLabel(weightUnit)}
                    labels={weightChart.labels}
                    positions={weightChart.positions}
                    series={weightChart.weight}
                    formatValue={(value, context) =>
                      context === 'compact'
                        ? formatChartAxis(value)
                        : formatChartPoint(value, weightUnit)
                    }
                  />
                </View>

                {weightAverage != null && (
                  <>
                    <Text style={styles.sectionTitle}>Average over this period</Text>
                    <WeightGrid
                      average={weightAverage}
                      delta={weightDelta}
                      unit={weightUnit}
                      count={weightsInRange.length}
                      latestGrams={latestWeight?.grams ?? null}
                    />
                  </>
                )}

                <Text style={styles.sectionTitle}>History</Text>
                <WeightList
                  entries={weightsInRange}
                  unit={weightUnit}
                  onDelete={deleteWeight}
                />
              </>
            )}

            {tab === 'meds' && (
              <>
                {reminderProblem === 'denied' && (
                  <Text style={styles.notice}>
                    Notifications are blocked for this app. Enable them in your device
                    settings to get these reminders.
                  </Text>
                )}

                {reminderProblem === 'unsupported' && (
                  <Text style={styles.notice}>
                    Expo Go on Android cannot schedule notifications. Your choices are
                    saved, and reminders will start working in a development build (npx
                    expo run:android).
                  </Text>
                )}

                {showMedicationForm ? (
                  <MedicationForm
                    initialData={editingMedication}
                    onSave={(med) => {
                      if (editingMedication) {
                        updateMedication({ ...editingMedication, ...med });
                      } else {
                        addMedication(med);
                      }
                    }}
                    onCancel={() => {
                      setEditingMedication(null);
                      setShowMedicationForm(false);
                    }}
                  />
                ) : (
                  <MedicationList
                    medications={medications}
                    onEdit={(med) => {
                      setEditingMedication(med);
                      setShowMedicationForm(true);
                    }}
                    onDelete={deleteMedication}
                    onToggle={toggleMedication}
                    onAdd={() => {
                      setEditingMedication(null);
                      setShowMedicationForm(true);
                    }}
                  />
                )}
              </>
            )}

            {tab === 'settings' && (
              <>
                <View style={styles.card}>
                  <View style={styles.settingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingTitle}>Weight units</Text>
                      <Text style={styles.settingHint}>
                        Changes how weights are shown, never what was recorded.
                      </Text>
                    </View>
                    <UnitChips unit={weightUnit} onChange={changeWeightUnit} />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Database Sync</Text>
                  <Text style={styles.settingHint}>
                    Backup your readings automatically to your Spring Boot database.
                  </Text>
                  <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                        Status: <Text style={{ color: syncState === 'synced' ? '#34C759' : syncState === 'error' ? '#FF3B30' : colors.text }}>
                          {syncState.toUpperCase()}
                        </Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                        Last synced: {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{
                        backgroundColor: colors.accent,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        opacity: syncState === 'syncing' ? 0.6 : 1,
                      }}
                      disabled={syncState === 'syncing'}
                      onPress={() => syncData().catch(() => {})}
                    >
                      {syncState === 'syncing' ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>Sync Now</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {reminderProblem === 'denied' && (
                  <Text style={styles.notice}>
                    Notifications are blocked for this app. Enable them in your device
                    settings to get these reminders.
                  </Text>
                )}

                {reminderProblem === 'unsupported' && (
                  <Text style={styles.notice}>
                    Expo Go on Android cannot schedule notifications. Your choices are
                    saved, and reminders will start working in a development build (npx
                    expo run:android).
                  </Text>
                )}

                <ReminderCard
                  title="Daily reminder"
                  subtitle="A notification every day to take your blood pressure."
                  cadence="daily"
                  settings={reminder}
                  onChange={(next) => updateReminder('bp', next)}
                />

                <ReminderCard
                  title="Weekly weigh-in"
                  subtitle="A notification once a week to weigh yourself."
                  cadence="weekly"
                  settings={weightReminder}
                  onChange={(next) => updateReminder('weight', next)}
                />
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Getting a good reading</Text>
                  <Text style={styles.tip}>· Sit still with your back supported for 5 minutes first.</Text>
                  <Text style={styles.tip}>· Rest your arm on a table, cuff level with your heart.</Text>
                  <Text style={styles.tip}>· Measure at the same time each day, before food or caffeine.</Text>
                  <Text style={styles.tip}>· Take two readings a minute apart and log the second.</Text>
                </View>
              </>
            )}

            <Text style={styles.disclaimer}>
              This app just stores the numbers you type in, on this device only. It is not a
              medical device and does not give medical advice — discuss your readings with
              your doctor or nurse.
            </Text>
          </ScrollView>

          <View style={styles.tabBar}>
            {(
              [
                ['summary', 'Summary'],
                ['log', 'Log'],
                ['trends', 'Trends'],
                ['meds', 'Meds'],
                ['settings', 'Settings'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={styles.tabItem}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                // The icons carry no text, so the label lives here for
                // screen readers.
                accessibilityLabel={label}
                accessibilityState={{ selected: tab === key }}
              >
                <TabIcon
                  name={key as TabIconName}
                  color={tab === key ? colors.text : colors.muted}
                />
                {tab === key && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function LatestCard({ reading }: { reading: BloodPressureReading }) {
  const category = categorise(reading.systolic, reading.diastolic);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Latest</Text>
      <View style={styles.heroRow}>
        <Text style={styles.hero}>
          {reading.systolic}
          <Text style={styles.heroSlash}>/</Text>
          {reading.diastolic}
        </Text>
        <View style={{ flex: 1 }}>
          <View style={styles.categoryRow}>
            <View style={[styles.dot, { backgroundColor: categoryColors[category] }]} />
            <Text style={styles.categoryText}>{category}</Text>
          </View>
          <Text style={styles.heroMeta}>
            {formatWhen(reading.takenAt)}
            {reading.heartRate != null ? ` · ${reading.heartRate} bpm` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

function GridPanel({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.gridPanel}>
      <View style={styles.panelLabelRow}>
        <View style={[styles.panelSwatch, { backgroundColor: color }]} />
        <Text style={styles.panelLabel}>{label}</Text>
      </View>
      <Text style={styles.panelValue}>{value}</Text>
      <Text style={styles.panelUnit}>{unit}</Text>
    </View>
  );
}

function BloodPressureGrid({
  average,
}: {
  average: { systolic: number; diastolic: number; heartRate: number | null; count: number };
}) {
  return (
    <View style={styles.averageGrid}>
      <GridPanel
        label="Systolic Avg"
        value={`${average.systolic}`}
        unit="mmHg"
        color={colors.systolic}
      />
      <GridPanel
        label="Diastolic Avg"
        value={`${average.diastolic}`}
        unit="mmHg"
        color={colors.diastolic}
      />
      <GridPanel
        label="Heart Rate Avg"
        value={average.heartRate == null ? '—' : `${average.heartRate}`}
        unit="bpm"
        color={colors.pulse}
      />
      <GridPanel
        label="Readings Logged"
        value={`${average.count}`}
        unit={`reading${average.count === 1 ? '' : 's'}`}
        color={colors.accent}
      />
    </View>
  );
}

function WeightGrid({
  average,
  delta,
  unit,
  count,
  latestGrams,
}: {
  average: number | null;
  delta: number | null;
  unit: WeightUnit;
  count: number;
  latestGrams: number | null;
}) {
  const deltaColor =
    delta == null
      ? colors.muted
      : delta < 0
        ? colors.accent
        : delta > 0
          ? colors.danger
          : colors.muted;

  return (
    <View style={styles.averageGrid}>
      <GridPanel
        label="Average Weight"
        value={average == null ? '—' : formatWeight(average, unit)}
        unit={unitLabel(unit)}
        color={colors.weight}
      />
      <GridPanel
        label="Weight Change"
        value={delta == null ? '—' : formatWeightDelta(delta, unit)}
        unit="this period"
        color={deltaColor}
      />
      <GridPanel
        label="Weigh-ins Logged"
        value={`${count}`}
        unit={`weigh-in${count === 1 ? '' : 's'}`}
        color={colors.accent}
      />
      <GridPanel
        label="Latest Weight"
        value={latestGrams == null ? '—' : formatWeight(latestGrams, unit)}
        unit={unitLabel(unit)}
        color={colors.weight}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLabelRow}>
        <View style={[styles.swatch, { backgroundColor: color }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centred: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  appTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  appSubtitle: { fontSize: 13, color: colors.muted, marginTop: -8, marginBottom: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  hero: { fontSize: 40, fontWeight: '800', color: colors.text },
  heroWeight: { fontSize: 30, fontWeight: '800', color: colors.text },
  heroSlash: { fontSize: 28, color: colors.muted, fontWeight: '400' },
  heroMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryText: { fontSize: 14, fontWeight: '600', color: colors.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  statLabel: { fontSize: 11, color: colors.muted },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.text, marginTop: 2 },
  statUnit: { fontSize: 10, color: colors.muted },
  rangeRow: { flexDirection: 'row', gap: 8 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  settingHint: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rangeChipActive: { backgroundColor: colors.text, borderColor: colors.text },
  rangeText: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  rangeTextActive: { color: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  tip: { fontSize: 13, color: colors.text, marginBottom: 6, lineHeight: 18 },
  notice: { fontSize: 12, color: colors.danger, lineHeight: 17 },
  disclaimer: { fontSize: 11, color: colors.muted, lineHeight: 16, marginTop: 8 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
  tabUnderline: {
    position: 'absolute',
    top: 0,
    height: 2,
    width: 40,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  averageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  gridPanel: {
    width: '48%',
    minWidth: 140,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexGrow: 1,
  },
  panelLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  panelSwatch: {
    width: 6,
    height: 6,
    borderRadius: 2,
  },
  panelLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  panelValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  panelUnit: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
});
