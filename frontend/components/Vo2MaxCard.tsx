/**
 * 🫁 Vo2MaxCard
 * ─────────────────────────────────────────────────────────────────────
 * Calm fitness-trend card for the Honors screen. Renders the user's
 * VO2 Max samples (synced from Apple Health) as a sparkline-style
 * mini chart with the latest value front-and-centre.
 *
 * Brand fit:
 *   - VO2 Max is performance-y by nature; we deliberately frame it as
 *     "your slow-ultra readiness" and avoid Garmin-style age-bracket
 *     percentile shaming.
 *   - The card hides itself when there are <2 samples (a single point
 *     is meaningless without a trend; better to render nothing than
 *     to lie with a flat line).
 *   - Auto-syncs silently — the parent screen kicks off the sync, this
 *     component just renders whatever is in `samples`.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

import { colors, radius, spacing, typography } from '../theme/colors';
import type { Vo2MaxSample } from '../services/api';

interface Props {
  samples: Vo2MaxSample[];
}

export function Vo2MaxCard({ samples }: Props) {
  // We need a minimum of two distinct samples to draw a meaningful
  // trend; a single dot would lie about flatness.
  const sorted = useMemo(
    () =>
      [...samples].sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() -
          new Date(b.recorded_at).getTime(),
      ),
    [samples],
  );

  if (sorted.length < 2) return null;

  const latest = sorted[sorted.length - 1];
  const earliest = sorted[0];
  const delta = latest.value_ml_kg_min - earliest.value_ml_kg_min;
  const isUp = delta > 0.5;
  const isDown = delta < -0.5;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Cardio fitness</Text>
        <Text style={styles.subtitle}>via Apple Health · VO₂ max</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.valueBlock}>
          <Text style={styles.value}>{latest.value_ml_kg_min.toFixed(1)}</Text>
          <Text style={styles.unit}>mL/kg/min</Text>
        </View>
        <View style={styles.deltaBlock}>
          <Text
            style={[
              styles.delta,
              isUp && styles.deltaUp,
              isDown && styles.deltaDown,
            ]}
          >
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}
          </Text>
          <Text style={styles.deltaLabel}>since first sample</Text>
        </View>
      </View>

      <Sparkline samples={sorted} />

      <Text style={styles.footnote}>
        {sorted.length} sample{sorted.length === 1 ? '' : 's'} this year ·{' '}
        readiness for slower, longer days
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Sparkline
// ─────────────────────────────────────────────────────────────────────

const SPARK_W = 280;
const SPARK_H = 60;

function Sparkline({ samples }: { samples: Vo2MaxSample[] }) {
  const { points, latestPoint } = useMemo(() => {
    const values = samples.map((s) => s.value_ml_kg_min);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);

    const stepX = samples.length > 1 ? SPARK_W / (samples.length - 1) : 0;
    const pts = samples.map((s, i) => {
      const x = i * stepX;
      // Pad vertically by 8px top/bottom so the line never clips.
      const y =
        SPARK_H - 8 - ((s.value_ml_kg_min - min) / range) * (SPARK_H - 16);
      return { x, y };
    });
    return {
      points: pts.map((p) => `${p.x},${p.y}`).join(' '),
      latestPoint: pts[pts.length - 1],
    };
  }, [samples]);

  return (
    <View style={styles.spark}>
      <Svg width={SPARK_W} height={SPARK_H}>
        <Polyline
          points={points}
          stroke={colors.secondary}
          strokeWidth={2}
          fill="none"
        />
        {latestPoint && (
          <Circle
            cx={latestPoint.x}
            cy={latestPoint.y}
            r={3.5}
            fill={colors.secondaryDark}
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  header: {
    gap: 2,
  },
  title: {
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  valueBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: typography.sizes.xxl,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  unit: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
  deltaBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  delta: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
  },
  deltaUp: {
    color: colors.success,
  },
  deltaDown: {
    color: colors.warning,
  },
  deltaLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
  },
  spark: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  footnote: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textAlign: 'center',
  },
});
