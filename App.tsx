import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import TrendChart, { Series } from './src/components/TrendChart';
import UnitChips from './src/components/UnitChips';
import WeightForm from './src/components/WeightForm';
import WeightList from './src/components/WeightList';
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
} from './src/storage';
import { categoryColors, colors } from './src/theme';
import {
  defaultReminder,
  defaultWeightReminder,
  defaultWeightUnit,
  Reading,
  ReminderSettings,
  WeightEntry,
  WeightUnit,
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

type Tab = 'log' | 'trends' | 'settings';
type Metric = 'bp' | 'weight';
type ReminderProblem = 'denied' | 'unsupported' | null;

const problemFrom = (result: ScheduleResult): ReminderProblem =>
  result === 'denied' || result === 'unsupported' ? result : null;

type Range = 7 | 30 | 0; // 0 means everything

export default function App() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [reminder, setReminder] = useState<ReminderSettings>(defaultReminder);
  const [weightReminder, setWeightReminder] =
    useState<ReminderSettings>(defaultWeightReminder);
  const [reminderProblem, setReminderProblem] = useState<ReminderProblem>(
    remindersSupported ? null : 'unsupported',
  );
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(defaultWeightUnit);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('log');
  const [metric, setMetric] = useState<Metric>('bp');
  const [range, setRange] = useState<Range>(30);

  useEffect(() => {
    (async () => {
      const [
        storedReadings,
        storedReminder,
        storedWeights,
        storedUnit,
        storedWeightReminder,
      ] = await Promise.all([
        loadReadings(),
        loadReminder(),
        loadWeights(),
        loadWeightUnit(),
        loadWeightReminder(),
      ]);
      setReadings(storedReadings);
      setReminder(storedReminder);
      setWeights(storedWeights);
      setWeightUnit(storedUnit);
      setWeightReminder(storedWeightReminder);
      setLoading(false);

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
    })();
  }, []);

  const newest = useMemo(() => sortByNewest(readings), [readings]);
  const inRange = useMemo(
    () => (range === 0 ? newest : sortByNewest(readingsWithinDays(readings, range))),
    [newest, readings, range],
  );
  const average = useMemo(() => averageOf(inRange), [inRange]);
  const latest = newest[0];

  const addReading = async (reading: Omit<Reading, 'id'>) => {
    const next = [...readings, { ...reading, id: `${Date.now()}` }];
    setReadings(next);
    await saveReadings(next);
  };

  const deleteReading = async (id: string) => {
    const next = readings.filter((r) => r.id !== id);
    setReadings(next);
    await saveReadings(next);
  };

  const addWeight = async (entry: Omit<WeightEntry, 'id'>) => {
    const next = [...weights, { ...entry, id: `${Date.now()}` }];
    setWeights(next);
    await saveWeights(next);
  };

  const deleteWeight = async (id: string) => {
    const next = weights.filter((w) => w.id !== id);
    setWeights(next);
    await saveWeights(next);
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

            {tab !== 'settings' && (
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

            {tab === 'log' && metric === 'bp' && (
              <>
                <ReadingForm onSave={addReading} />
                {latest && <LatestCard reading={latest} />}
                {average && (
                  <SummaryCard
                    title={`Average of your last ${average.count} reading${average.count === 1 ? '' : 's'}`}
                    average={average}
                  />
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

                {average && <SummaryCard title="Average over this period" average={average} />}

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
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Over this period</Text>
                    <View style={styles.statRow}>
                      <Stat
                        label="Average"
                        value={formatWeight(weightAverage, weightUnit)}
                        unit={`${weightsInRange.length} weigh-in${weightsInRange.length === 1 ? '' : 's'}`}
                        color={colors.weight}
                      />
                      <Stat
                        label="Change"
                        value={
                          weightDelta == null
                            ? '—'
                            : formatWeightDelta(weightDelta, weightUnit)
                        }
                        unit={weightDelta == null ? 'needs two weigh-ins' : 'first to last'}
                        color={colors.weight}
                      />
                    </View>
                  </View>
                )}

                <Text style={styles.sectionTitle}>History</Text>
                <WeightList
                  entries={weightsInRange}
                  unit={weightUnit}
                  onDelete={deleteWeight}
                />
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
                ['log', 'Log'],
                ['trends', 'Trends'],
                ['settings', 'Settings'],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={styles.tabItem}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
              >
                <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                  {label}
                </Text>
                {tab === key && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            ))}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function LatestCard({ reading }: { reading: Reading }) {
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

function SummaryCard({
  title,
  average,
}: {
  title: string;
  average: { systolic: number; diastolic: number; heartRate: number | null };
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.statRow}>
        <Stat label="Systolic" value={`${average.systolic}`} unit="mmHg" color={colors.systolic} />
        <Stat label="Diastolic" value={`${average.diastolic}`} unit="mmHg" color={colors.diastolic} />
        <Stat
          label="Heart rate"
          value={average.heartRate == null ? '—' : `${average.heartRate}`}
          unit="bpm"
          color={colors.pulse}
        />
      </View>
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
  tabItem: { flex: 1, alignItems: 'center', paddingTop: 12, paddingBottom: 14 },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  tabTextActive: { color: colors.text },
  tabUnderline: {
    position: 'absolute',
    top: 0,
    height: 2,
    width: 40,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
});
