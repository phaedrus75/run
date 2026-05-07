/**
 * 🧠 COACH OPT-IN SCREEN
 * ======================
 *
 * Single-purpose screen explaining what the ZenRun coach is, what it
 * sees, and how to turn it off. One primary action.
 *
 * Routed from Profile → Coach. Returns the user to wherever they came
 * from (Profile, or a deep link).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { coachApi, CoachSettings } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  navigation: any;
  route?: { params?: { onEnabled?: () => void } };
}

export function CoachOptInScreen({ navigation, route }: Props) {
  const [settings, setSettings] = useState<CoachSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await coachApi.getSettings();
        if (!cancelled) setSettings(s);
      } catch {
        // The endpoint always succeeds for authenticated users; ignore.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isEnabled = !!settings?.coach_enabled;

  const handleEnable = async () => {
    setWorking(true);
    try {
      const s = await coachApi.optIn();
      setSettings(s);
      route?.params?.onEnabled?.();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not enable your Guide', e?.message ?? 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const handleDisable = async () => {
    Alert.alert(
      'Turn off your Guide?',
      'Notes already on past runs stay where they are. Your Guide will stop suggesting runs and writing new notes.',
      [
        { text: 'Keep on', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              await coachApi.optOut();
              setSettings(s => (s ? { ...s, coach_enabled: false } : s));
            } catch (e: any) {
              Alert.alert('Could not turn off', e?.message ?? 'Please try again.');
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  };

  const updateToggle = async (patch: Partial<CoachSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next); // optimistic
    try {
      const saved = await coachApi.updateSettings(next);
      setSettings(saved);
    } catch (e: any) {
      setSettings(settings); // revert
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    }
  };

  const VOICE_OPTIONS: { id: string; label: string; sub: string }[] = [
    { id: 'all', label: 'All runs', sub: 'Every run, guided or not' },
    { id: 'coach_runs', label: 'Guided runs only', sub: 'Quiet on ad-hoc runs' },
    { id: 'journeys_only', label: 'Journeys only', sub: 'Voice only on long-distance Journeys' },
    { id: 'off', label: 'Off', sub: 'Never speak during a run' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Guide</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>A quiet guide for the run.</Text>
        <Text style={styles.lede}>
          Your Guide is an opt-in helper for the slow ultra and the everyday run.
          It writes a short note in your journal after a run, suggests something
          to do today, helps you plan a journey, and answers questions about your
          own running. Calm, plain, and on by request.
        </Text>

        <SectionHeader>What your Guide does</SectionHeader>
        <Bullet
          icon="book-outline"
          title="Writes a note on your album"
          body="Two or three sentences after each run or walk. Specific to the run, not a template."
        />
        <Bullet
          icon="sunny-outline"
          title="Suggests something for today"
          body="One line on Home. A route, a structure, or a rest. You can ignore it."
        />
        <Bullet
          icon="chatbubble-outline"
          title="Answers questions about your running"
          body="Where to run, why a run was tough, when to take it easy. No race-prep, no diet talk."
        />
        <Bullet
          icon="walk-outline"
          title="Speaks during guided runs"
          body="Short voice cues at each kilometre. Off for ad-hoc runs. Off entirely if you want."
        />
        <Bullet
          icon="compass-outline"
          title="Helps you plan a journey"
          body="Suggests a route, writes a prep note for 50k+, and a quiet daily brief on multi-day journeys."
        />

        <SectionHeader>What it sees</SectionHeader>
        <Text style={styles.body}>
          Your runs and walks (distance, time, mood, notes, photo counts and
          captions). Your runner level, goals, and home city. That's it.
        </Text>
        <Text style={styles.body}>
          Your Guide never sees your name, your handle, your email, or photos
          themselves. It does not see anything outside ZenRun.
        </Text>

        <SectionHeader>What it won't do</SectionHeader>
        <Text style={styles.body}>
          No training plans for races, no zone-2 talk, no weight-loss
          coaching, no diagnosing pain. It defers anything medical to a
          doctor.
        </Text>

        <SectionHeader>Turning it off</SectionHeader>
        <Text style={styles.body}>
          You can turn your Guide off at any time from Profile → Guide. Notes
          already on past runs stay where they are. Chat history can be
          cleared separately.
        </Text>

        {isEnabled ? (
          <>
            <View style={styles.statusEnabled}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.statusText}>Guide is on for this account.</Text>
            </View>

            <SectionHeader>Settings</SectionHeader>

            <ToggleRow
              icon="book-outline"
              title="Notes on every activity"
              body="Auto-write a short note when you save a run or walk."
              value={!!settings?.coach_notes_auto}
              onChange={(v) => updateToggle({ coach_notes_auto: v })}
            />
            <ToggleRow
              icon="sunny-outline"
              title="Today's recommendation on Home"
              body="One-line nudge for the day. Tap to expand."
              value={!!settings?.coach_today_card}
              onChange={(v) => updateToggle({ coach_today_card: v })}
            />

            <Text style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
              Voice during runs
            </Text>
            <Text style={[styles.body, { marginBottom: spacing.sm }]}>
              When you start a guided run, your Guide can speak short
              cues at each kilometre.
            </Text>
            <View style={styles.radioGroup}>
              {VOICE_OPTIONS.map((opt) => {
                const active = settings?.coach_voice_during_runs === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => updateToggle({ coach_voice_during_runs: opt.id })}
                    style={[styles.radioRow, active && styles.radioRowActive]}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? colors.primary : colors.textSecondary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.radioLabel, active && { color: colors.primary }]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.radioSub}>{opt.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {isEnabled ? (
          <Pressable
            onPress={handleDisable}
            disabled={working}
            style={[styles.secondaryBtn, working && styles.btnDisabled]}
          >
            {working ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <Text style={styles.secondaryBtnText}>Turn Guide off</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={handleEnable}
            disabled={working}
            style={[styles.primaryBtn, working && styles.btnDisabled]}
          >
            {working ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Turn Guide on</Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function Bullet({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletBody}>{body}</Text>
      </View>
    </View>
  );
}

function ToggleRow({
  icon,
  title,
  body,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={styles.bulletIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletBody}>{body}</Text>
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 38,
  },
  lede: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 23,
    marginBottom: spacing.sm,
  },

  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  bulletIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  bulletTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  bulletBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  statusEnabled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  statusText: {
    marginLeft: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.text,
  },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.small,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.error,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  btnDisabled: { opacity: 0.6 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: colors.primary },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    ...shadows.small,
  },
  toggleThumbOn: { transform: [{ translateX: 18 }] },

  radioGroup: { marginTop: spacing.xs },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  radioRowActive: { backgroundColor: colors.surfaceAlt },
  radioLabel: {
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  radioSub: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
