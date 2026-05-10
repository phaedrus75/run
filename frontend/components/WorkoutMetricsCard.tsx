/**
 * 📈 WorkoutMetricsCard
 * ─────────────────────────────────────────────────────────────────────
 * Cohesive detail-screen section that surfaces the optional Apple
 * Health / native enrichment metrics on a Run or Walk:
 *
 *   - Top strip:      calories, avg HR, max HR, cadence, elevation
 *                     (each pill renders only when data is present)
 *   - Splits table:   per-km time + pace + (optional) avg HR
 *   - HR zones bar:   horizontal stacked bar, % of time per zone
 *   - HR recovery:    single line, "12 bpm in 60 s · sharp recovery"
 *
 * Brand fit: each block sits behind a small, tasteful header. We
 * intentionally don't render the section at all when no metrics are
 * present — legacy rows look identical to before. We never lean into
 * "performance" framing (no PR comparisons, no zone shaming, no big
 * red numbers). The Guide brand is "the slow ultra" — we want a
 * runner's eye to *graze* this data and move on.
 *
 * The component is purely presentational; it parses the JSON blobs
 * from the Run / Walk row via `services/workoutMetrics.ts` codecs so
 * partial / malformed data never throws.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../theme/colors';
import {
  decodeHrZones,
  decodeSplits,
  formatPace,
  formatZoneDuration,
  totalZoneSeconds,
  type HrZones,
  type Split,
} from '../services/workoutMetrics';

interface Props {
  /** All optional. Undefined / null fields hide their respective
   *  blocks — the whole card hides when nothing is supplied. */
  caloriesKcal?: number | null;
  avgHrBpm?: number | null;
  maxHrBpm?: number | null;
  avgCadenceSpm?: number | null;
  elevationGainM?: number | null;
  splitsJson?: string | null;
  hrZonesJson?: string | null;
  hrRecoveryBpm?: number | null;
}

export function WorkoutMetricsCard({
  caloriesKcal,
  avgHrBpm,
  maxHrBpm,
  avgCadenceSpm,
  elevationGainM,
  splitsJson,
  hrZonesJson,
  hrRecoveryBpm,
}: Props) {
  const splits = useMemo(() => decodeSplits(splitsJson), [splitsJson]);
  const zones = useMemo(() => decodeHrZones(hrZonesJson), [hrZonesJson]);

  const hasStrip =
    caloriesKcal != null ||
    avgHrBpm != null ||
    maxHrBpm != null ||
    avgCadenceSpm != null ||
    elevationGainM != null;
  const hasSplits = splits.length > 0;
  const hasZones = zones != null && totalZoneSeconds(zones) > 0;
  const hasRecovery = hrRecoveryBpm != null && hrRecoveryBpm > 0;

  if (!hasStrip && !hasSplits && !hasZones && !hasRecovery) return null;

  return (
    <View style={styles.card}>
      {hasStrip && (
        <View style={styles.strip}>
          {caloriesKcal != null && (
            <MetricPill
              icon="flame-outline"
              label="kcal"
              value={Math.round(caloriesKcal).toString()}
            />
          )}
          {avgHrBpm != null && (
            <MetricPill
              icon="heart-outline"
              label="avg HR"
              value={`${Math.round(avgHrBpm)}`}
            />
          )}
          {maxHrBpm != null && (
            <MetricPill
              icon="pulse-outline"
              label="max HR"
              value={`${Math.round(maxHrBpm)}`}
            />
          )}
          {avgCadenceSpm != null && (
            <MetricPill
              icon="walk-outline"
              label="cadence"
              value={`${Math.round(avgCadenceSpm)}`}
            />
          )}
          {elevationGainM != null && elevationGainM > 0 && (
            <MetricPill
              icon="trending-up-outline"
              label="elev"
              value={`${Math.round(elevationGainM)} m`}
            />
          )}
        </View>
      )}

      {hasZones && (
        <View style={styles.section}>
          <SectionHeader
            icon="bar-chart-outline"
            title="Time in zones"
            subtitle={`max HR ${zones!.max_hr_used} bpm`}
          />
          <HrZonesBar zones={zones!} />
        </View>
      )}

      {hasRecovery && (
        <View style={styles.recoveryRow}>
          <Ionicons
            name="leaf-outline"
            size={14}
            color={colors.secondaryDark}
          />
          <Text style={styles.recoveryText}>
            Recovery: <Text style={styles.recoveryValue}>{hrRecoveryBpm} bpm</Text>{' '}
            in 60 s
            {recoveryQualifier(hrRecoveryBpm!) && (
              <Text style={styles.recoveryQualifier}>
                {' · '}
                {recoveryQualifier(hrRecoveryBpm!)}
              </Text>
            )}
          </Text>
        </View>
      )}

      {hasSplits && (
        <View style={styles.section}>
          <SectionHeader icon="time-outline" title="Splits" />
          <SplitsTable splits={splits} />
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function MetricPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

/**
 * Horizontal stacked bar of Z1–Z5 with each segment sized by its share
 * of the total time. Ratios are computed from the seconds bucket so
 * tiny zones still render a thin sliver if non-zero (we don't drop
 * zones below a threshold — runners want to see "I spent 2% in Z5"
 * without doing the maths).
 */
function HrZonesBar({ zones }: { zones: HrZones }) {
  const total = totalZoneSeconds(zones) || 1;
  const segments: Array<{
    key: string;
    label: string;
    seconds: number;
    color: string;
  }> = [
    { key: 'z1', label: 'Z1', seconds: zones.z1_sec, color: ZONE_COLORS.z1 },
    { key: 'z2', label: 'Z2', seconds: zones.z2_sec, color: ZONE_COLORS.z2 },
    { key: 'z3', label: 'Z3', seconds: zones.z3_sec, color: ZONE_COLORS.z3 },
    { key: 'z4', label: 'Z4', seconds: zones.z4_sec, color: ZONE_COLORS.z4 },
    { key: 'z5', label: 'Z5', seconds: zones.z5_sec, color: ZONE_COLORS.z5 },
  ];

  return (
    <View>
      <View style={styles.zonesBar}>
        {segments.map((s) => {
          const flex = s.seconds / total;
          if (flex <= 0) return null;
          return (
            <View
              key={s.key}
              style={[
                styles.zonesBarSegment,
                { flex, backgroundColor: s.color },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.zonesLegend}>
        {segments.map((s) => (
          <View key={s.key} style={styles.zonesLegendItem}>
            <View
              style={[styles.zonesLegendSwatch, { backgroundColor: s.color }]}
            />
            <Text style={styles.zonesLegendLabel}>{s.label}</Text>
            <Text style={styles.zonesLegendValue}>
              {formatZoneDuration(s.seconds)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const ZONE_COLORS = {
  // Sequence chosen to match Apple's published zone palette while
  // staying in ZenRun's calmer brand range — pastel-ish, not Garmin-
  // alarm-red. Z5 still draws the eye but without screaming.
  z1: '#A8D8D0',
  z2: '#7BAFA6',
  z3: '#E8D5A3',
  z4: '#E8A87C',
  z5: '#E8756F',
} as const;

/**
 * Splits table — one row per kilometre with km, time, pace, and
 * (optionally) avg HR. We keep the table dense (~28 px row height) so
 * a 21k run scrolls cleanly without dominating the detail screen.
 */
function SplitsTable({ splits }: { splits: Split[] }) {
  const hasHr = splits.some((s) => s.avg_hr_bpm != null);
  const fastest = useMemo(() => {
    if (splits.length === 0) return Infinity;
    return Math.min(...splits.map((s) => s.pace_sec_per_km));
  }, [splits]);

  return (
    <View style={styles.splits}>
      <View style={styles.splitsHeaderRow}>
        <Text style={[styles.splitsHeaderCell, styles.splitColKm]}>km</Text>
        <Text style={[styles.splitsHeaderCell, styles.splitColTime]}>time</Text>
        <Text style={[styles.splitsHeaderCell, styles.splitColPace]}>pace</Text>
        {hasHr && (
          <Text style={[styles.splitsHeaderCell, styles.splitColHr]}>HR</Text>
        )}
      </View>
      {splits.map((s) => {
        const isFastest = s.pace_sec_per_km === fastest && splits.length > 1;
        return (
          <View key={s.km} style={styles.splitsRow}>
            <Text style={[styles.splitsCell, styles.splitColKm]}>
              {s.km.toString().padStart(2, ' ')}
            </Text>
            <Text style={[styles.splitsCell, styles.splitColTime]}>
              {formatPace(s.duration_sec)}
            </Text>
            <Text
              style={[
                styles.splitsCell,
                styles.splitColPace,
                isFastest && styles.splitFastestCell,
              ]}
            >
              {formatPace(s.pace_sec_per_km)}
              {isFastest ? ' ⚡' : ''}
            </Text>
            {hasHr && (
              <Text style={[styles.splitsCell, styles.splitColHr]}>
                {s.avg_hr_bpm != null ? `${s.avg_hr_bpm}` : '–'}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────

/** Translate a recovery delta into a calm one-word qualifier. The
 *  thresholds borrow from the consumer-grade interpretation Apple
 *  Watch / Garmin coach: ≥18 bpm = sharp; 12–17 = good; 6–11 =
 *  steady; <6 = gentle. We never frame any of these negatively. */
function recoveryQualifier(bpm: number): string | null {
  if (bpm >= 18) return 'sharp';
  if (bpm >= 12) return 'good';
  if (bpm >= 6) return 'steady';
  return null;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillValue: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  pillLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    marginLeft: 4,
  },
  recoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recoveryText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  recoveryValue: {
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  recoveryQualifier: {
    color: colors.secondaryDark,
    fontStyle: 'italic',
  },

  // Zones bar
  zonesBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  zonesBarSegment: {
    height: '100%',
  },
  zonesLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  zonesLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zonesLegendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  zonesLegendLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  zonesLegendValue: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },

  // Splits table
  splits: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  splitsHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  splitsHeaderCell: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    fontWeight: typography.weights.medium,
    textTransform: 'uppercase',
  },
  splitsRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  splitsCell: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  splitFastestCell: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  splitColKm: {
    width: 28,
  },
  splitColTime: {
    flex: 1,
  },
  splitColPace: {
    flex: 1,
  },
  splitColHr: {
    width: 36,
    textAlign: 'right',
  },
});
