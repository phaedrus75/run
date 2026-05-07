/**
 * 🏁 START JOURNEY SCREEN
 * ========================
 *
 * The build flow for a new Journey. The user picks a template (or
 * customises a name) and confirms. Phase 5 only ships the 20 km tier;
 * the screen is wired so higher tiers slot in by adjusting the segmented
 * control.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { JourneyTemplate, journeyApi } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  navigation: any;
}

export function StartJourneyScreen({ navigation }: Props) {
  const [tier] = useState<'20k'>('20k');
  const [templates, setTemplates] = useState<JourneyTemplate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await journeyApi.listTemplates();
        if (!cancelled) {
          setTemplates(list.filter((t) => t.tier === tier));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tier]);

  const start = async () => {
    const tpl = selectedIdx != null ? templates[selectedIdx] : null;
    const name = customName.trim() || tpl?.name || '';
    if (!name) {
      Alert.alert('Pick a name', 'Choose one of the suggestions or write your own.');
      return;
    }
    setSubmitting(true);
    try {
      const journey = await journeyApi.create({
        name,
        tier,
        plan_summary: tpl?.blurb,
      });
      navigation.replace('JourneyDetail', { journeyId: journey.id });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/already have an active/i.test(msg)) {
        Alert.alert(
          'Already on a journey',
          'You already have an active journey. Finish or abandon it before starting another.',
        );
      } else {
        Alert.alert('Could not start', msg || 'Try again in a moment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Start a journey</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>The slow ultra.</Text>
          <Text style={styles.sub}>
            20 km of walks and runs across days or weeks. Every km of every activity counts
            once you start.
          </Text>

          <Text style={styles.section}>Pick a starter</Text>
          <View style={styles.cardList}>
            {templates.map((tpl, idx) => {
              const selected = selectedIdx === idx;
              return (
                <Pressable
                  key={tpl.name}
                  onPress={() => {
                    setSelectedIdx(idx);
                    if (!customName) setCustomName('');
                  }}
                  style={({ pressed }) => [
                    styles.tplCard,
                    selected && styles.tplCardSelected,
                    { transform: [{ scale: pressed ? 0.99 : 1 }] },
                  ]}
                >
                  <View style={styles.tplHeader}>
                    <Text
                      style={[styles.tplName, selected && styles.tplNameSelected]}
                    >
                      {tpl.name}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </View>
                  <Text style={styles.tplBlurb}>{tpl.blurb}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.section}>Or name your own</Text>
          <TextInput
            value={customName}
            onChangeText={(t) => {
              setCustomName(t);
              if (t.length > 0) setSelectedIdx(null);
            }}
            placeholder="The Friday ten / Park rounds / etc."
            placeholderTextColor={colors.textLight}
            style={styles.input}
            maxLength={120}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => void start()}
            disabled={submitting}
            style={({ pressed }) => [
              styles.startBtn,
              submitting && { opacity: 0.6 },
              { transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.startBtnText}>Begin the journey</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heading: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginTop: spacing.md,
  },
  sub: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  section: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cardList: { gap: spacing.sm },
  tplCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.small,
  },
  tplCardSelected: {
    borderColor: colors.primary,
  },
  tplHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tplName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  tplNameSelected: { color: colors.primary },
  tplBlurb: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.lg,
    ...shadows.small,
  },
  startBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
