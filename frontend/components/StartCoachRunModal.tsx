/**
 * 🏁 START COACH RUN MODAL
 * =========================
 *
 * The minimum-viable entry point for an in-run companion experience.
 * The user picks a target distance (and indoor vs outdoor); we ask the
 * coach to pre-generate a per-km script, then navigate to the matching
 * active screen with the script id attached.
 *
 * Why pre-generate?
 * - Predictable cadence (no unbounded LLM latency mid-run).
 * - Cheaper (one call up-front instead of 5–10 inline).
 * - Lets us cache and re-use the script for resumed sessions.
 *
 * The picker is intentionally tiny: five distances, two activity modes.
 * Anything more elaborate belongs in the "Journeys" build flow (Phase 5).
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { coachApi } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  /**
   * Called once the script is ready. The host is expected to navigate the
   * user to the matching active screen, e.g.
   *   navigation.navigate('Activity', { screen: 'ActiveRun', params: { coachScriptId } })
   */
  onReady: (args: { activity: 'outdoor_run' | 'treadmill'; scriptId: number }) => void;
}

const DISTANCE_OPTIONS_KM = [3, 5, 8, 10, 15];

const ACTIVITIES: { id: 'outdoor_run' | 'treadmill'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'outdoor_run', label: 'Outdoor', icon: 'leaf-outline' },
  { id: 'treadmill', label: 'Treadmill', icon: 'fitness-outline' },
];

export function StartCoachRunModal({ visible, onClose, onReady }: Props) {
  const [activity, setActivity] = useState<'outdoor_run' | 'treadmill'>('outdoor_run');
  const [distance, setDistance] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setActivity('outdoor_run');
    setDistance(5);
    setError(null);
    setLoading(false);
  }, []);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const script = await coachApi.createRunScript({
        activity,
        target_distance_km: distance,
        plan_summary: `${distance} km ${activity === 'outdoor_run' ? 'outdoor' : 'treadmill'} run, easy effort.`,
      });
      onReady({ activity, scriptId: script.id });
      reset();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/(coach|guide) is not enabled/i.test(msg) || /403/.test(msg)) {
        setError('Turn your Guide on in Profile to use voice in-run.');
      } else {
        setError('Could not prepare your Guide right now. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [activity, distance, onReady, reset]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        reset();
        onClose();
      }}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTouch}
          onPress={() => {
            reset();
            onClose();
          }}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Run with your Guide</Text>
          <Text style={styles.subtitle}>
            Pick a distance. Your Guide speaks once at the start, on each km, halfway through,
            and at the finish. You can mute it any time.
          </Text>

          <Text style={styles.section}>Where</Text>
          <View style={styles.row}>
            {ACTIVITIES.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setActivity(a.id)}
                style={({ pressed }) => [
                  styles.chip,
                  activity === a.id && styles.chipActive,
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <Ionicons
                  name={a.icon}
                  size={16}
                  color={activity === a.id ? colors.textOnPrimary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.chipText,
                    activity === a.id && styles.chipTextActive,
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.section}>Distance</Text>
          <View style={styles.row}>
            {DISTANCE_OPTIONS_KM.map((km) => (
              <Pressable
                key={km}
                onPress={() => setDistance(km)}
                style={({ pressed }) => [
                  styles.distanceChip,
                  distance === km && styles.chipActive,
                  { transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <Text
                  style={[
                    styles.distanceChipText,
                    distance === km && styles.chipTextActive,
                  ]}
                >
                  {km} km
                </Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={() => void start()}
            disabled={loading}
            style={({ pressed }) => [
              styles.startBtn,
              loading && { opacity: 0.6 },
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.startBtnText}>Start guided run</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...shadows.medium,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  section: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  distanceChip: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 64,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  distanceChipText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
  chipTextActive: { color: colors.textOnPrimary },
  error: {
    color: colors.warning,
    fontSize: typography.sizes.sm,
    marginTop: spacing.md,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  startBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
