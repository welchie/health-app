import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

export type Series = {
  key: string;
  label: string;
  color: string;
  /** null means "not recorded for this reading" and breaks the line. */
  points: (number | null)[];
};

/**
 * 'compact' is for anything drawn on the plot - axis ticks and the label beside
 * the newest point - where a long string would be clipped. 'full' is for the
 * readout line below, which has the width to spell a value out.
 */
export type ValueContext = 'compact' | 'full';

type Props = {
  title: string;
  unit: string;
  labels: string[];
  /** Fractional x position (0-1) of each point, so gaps in time show as gaps. */
  positions: number[];
  series: Series[];
  /** Faint horizontal guides, e.g. the 120 / 90 reference values. */
  guides?: { value: number; label: string }[];
  /**
   * How a value is written in each place. Defaults to whole numbers, which is
   * what mmHg and bpm want.
   */
  formatValue?: (value: number, context: ValueContext) => string;
};

const PAD = { top: 16, right: 46, bottom: 24, left: 34 };
const HEIGHT = 186;

/** Coarse enough to stay readable, fine enough for a stones-and-pounds scale. */
const STEPS = [0.2, 0.5, 1, 2, 5, 10, 20, 50];
const TARGET_TICKS = 5;

/** Keeps fractional steps free of binary floating point noise. */
const tidy = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Picks the tick step from the spread of the data rather than assuming mmHg: a
 * blood pressure range still lands on 10, while a 12.5-13.2 stone range lands on
 * a step that actually separates the points.
 */
export function niceDomain(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const step =
    STEPS.find((candidate) => spread / candidate <= TARGET_TICKS) ??
    STEPS[STEPS.length - 1];
  const pad = step * 0.6;
  const lower = tidy(Math.floor((min - pad) / step) * step);
  const upper = tidy(Math.ceil((max + pad) / step) * step);
  return {
    lower,
    upper: upper === lower ? tidy(lower + step) : upper,
    step,
  };
}

export default function TrendChart({
  title,
  unit,
  labels,
  positions,
  series,
  guides = [],
  formatValue = (value) => String(Math.round(value)),
}: Props) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const flat = useMemo(
    () =>
      series
        .flatMap((s) => s.points)
        .filter((v): v is number => v != null)
        .concat(guides.map((g) => g.value)),
    [series, guides],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (flat.length === 0) {
    return (
      <View style={styles.wrap} onLayout={onLayout} testID="chart">
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>No readings in this period yet.</Text>
      </View>
    );
  }

  const { lower, upper, step } = niceDomain(flat);
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + positions[i] * plotW;
  const y = (v: number) => PAD.top + (1 - (v - lower) / (upper - lower)) * plotH;

  const ticks: number[] = [];
  const tickCount = Math.round((upper - lower) / step);
  for (let i = 0; i <= tickCount; i += 1) ticks.push(tidy(lower + i * step));

  // A single reading has no line to draw, so points carry the chart on their own.
  const pathFor = (points: (number | null)[]) => {
    let d = '';
    let pen = 'M';
    points.forEach((v, i) => {
      if (v == null) {
        pen = 'M';
        return;
      }
      d += `${pen}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = 'L';
    });
    return d.trim();
  };

  const lastIndexOf = (points: (number | null)[]) => {
    for (let i = points.length - 1; i >= 0; i -= 1) if (points[i] != null) return i;
    return -1;
  };

  const pick = (locationX: number) => {
    if (positions.length === 0) return;
    let best = 0;
    let bestDist = Infinity;
    positions.forEach((_, i) => {
      const dist = Math.abs(x(i) - locationX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setSelected(best);
  };

  return (
    <View style={styles.wrap} onLayout={onLayout} testID="chart">
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View
        testID="chart-surface"
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {ticks.map((t) => (
              <G key={t}>
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={colors.border}
                  strokeWidth={1}
                />
                <SvgText
                  x={PAD.left - 6}
                  y={y(t) + 4}
                  fontSize={10}
                  fill={colors.muted}
                  textAnchor="end"
                >
                  {formatValue(t, 'compact')}
                </SvgText>
              </G>
            ))}

            {guides.map((g) => (
              <G key={g.label}>
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(g.value)}
                  y2={y(g.value)}
                  stroke={colors.muted}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  opacity={0.55}
                />
                <SvgText
                  x={width - PAD.right + 4}
                  y={y(g.value) - 3}
                  fontSize={9}
                  fill={colors.muted}
                >
                  {g.label}
                </SvgText>
              </G>
            ))}

            {selected != null && (
              <Line
                x1={x(selected)}
                x2={x(selected)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke={colors.text}
                strokeWidth={1}
                opacity={0.25}
              />
            )}

            {series.map((s) => (
              <Path
                key={s.key}
                d={pathFor(s.points)}
                stroke={s.color}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {series.map((s) =>
              s.points.map((v, i) =>
                v == null ? null : (
                  <Circle
                    key={`${s.key}-${i}`}
                    cx={x(i)}
                    cy={y(v)}
                    r={selected === i ? 5 : 3.5}
                    fill={s.color}
                    stroke={colors.card}
                    strokeWidth={2}
                  />
                ),
              ),
            )}

            {/* Direct labels on the newest value keep identity off colour alone. */}
            {series.map((s) => {
              const i = lastIndexOf(s.points);
              if (i < 0) return null;
              return (
                <SvgText
                  key={`${s.key}-label`}
                  x={Math.min(x(i) + 8, width - PAD.right + 2)}
                  y={y(s.points[i] as number) + 4}
                  fontSize={11}
                  fontWeight="600"
                  fill={colors.text}
                >
                  {formatValue(s.points[i] as number, 'compact')}
                </SvgText>
              );
            })}

            <Rect
              x={PAD.left}
              y={PAD.top + plotH}
              width={plotW}
              height={1}
              fill={colors.border}
            />

            {labels.length > 0 && (
              <>
                <SvgText x={PAD.left} y={HEIGHT - 6} fontSize={10} fill={colors.muted}>
                  {labels[0]}
                </SvgText>
                {labels.length > 1 && (
                  <SvgText
                    x={PAD.left + plotW}
                    y={HEIGHT - 6}
                    fontSize={10}
                    fill={colors.muted}
                    textAnchor="end"
                  >
                    {labels[labels.length - 1]}
                  </SvgText>
                )}
              </>
            )}
          </Svg>
        )}
      </View>

      <Text style={styles.readout}>
        {selected == null
          ? 'Tap or drag across the chart to inspect a reading.'
          : `${labels[selected]} — ${series
              .map((s) => {
                const value = s.points[selected];
                return `${s.label} ${value == null ? '—' : formatValue(value, 'full')}`;
              })
              .join('  ·  ')}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  unit: { fontSize: 11, color: colors.muted },
  legend: { flexDirection: 'row', gap: 14, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: colors.muted },
  readout: { fontSize: 11, color: colors.muted, marginTop: 2 },
  empty: { fontSize: 13, color: colors.muted, paddingVertical: 24, textAlign: 'center' },
});
