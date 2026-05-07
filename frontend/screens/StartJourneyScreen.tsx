/**
 * 🏁 START JOURNEY SCREEN
 * ========================
 *
 * The browse-and-pick flow for a new Journey. The user picks a tier
 * (20/30/50/60/75/100k) and a starter template — either a Guide
 * suggestion, a static template, or a custom name — and taps "Preview".
 *
 * Selecting a card no longer creates a journey: it navigates to
 * `JourneyPreviewScreen`, where the user reads the readiness assessment,
 * the prep checklist, and picks a date before deciding to plan it or
 * start it now.
 *
 * 20k and 30k are one-go journeys (single calendar day); 50k, 60k, 75k,
 * 100k spread across up to three days.
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

import { JourneyTemplate, coachApi, journeyApi } from '../services/api';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  navigation: any;
}

type Tier = '20k' | '30k' | '50k' | '60k' | '75k' | '100k';

const TIERS: { id: Tier; label: string; days: number }[] = [
  { id: '20k', label: '20k', days: 1 },
  { id: '30k', label: '30k', days: 1 },
  { id: '50k', label: '50k', days: 3 },
  { id: '60k', label: '60k', days: 3 },
  { id: '75k', label: '75k', days: 3 },
  { id: '100k', label: '100k', days: 3 },
];

export function StartJourneyScreen({ navigation }: Props) {
  const [tier, setTier] = useState<Tier>('20k');
  const [allTemplates, setAllTemplates] = useState<JourneyTemplate[]>([]);
  const [guideSuggestions, setGuideSuggestions] = useState<JourneyTemplate[]>([]);
  const [guideLoading, setGuideLoading] = useState(false);
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await journeyApi.listTemplates();
        if (!cancelled) setAllTemplates(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 🌅 Pull bespoke Guide suggestions whenever the tier changes. The
  // backend returns [] when the Guide is off, the LLM is in stub mode,
  // or the user is too new for a meaningful suggestion — and we render
  // nothing in that case.
  useEffect(() => {
    let cancelled = false;
    setGuideLoading(true);
    setGuideSuggestions([]);
    (async () => {
      try {
        const items = await coachApi.getJourneySuggestions(tier);
        if (!cancelled) setGuideSuggestions(items);
      } catch {
        if (!cancelled) setGuideSuggestions([]);
      } finally {
        if (!cancelled) setGuideLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tier]);

  const templates = allTemplates.filter((t) => t.tier === tier);
  const tierMeta = TIERS.find((t) => t.id === tier)!;
  const daysCopy = tierMeta.days === 1 ? 'in one go' : `across up to ${tierMeta.days} days`;

  /** Navigate to the preview screen for the selected card / custom name.
   *  Tapping a card no longer creates a journey — preview is the new gate. */
  const goToPreview = (tpl: JourneyTemplate | null, customNameOverride?: string) => {
    const name = (customNameOverride ?? customName).trim() || tpl?.name || '';
    if (!name) {
      Alert.alert(
        'Pick one',
        'Tap a suggestion or write your own name, then we can preview it.',
      );
      return;
    }
    navigation.navigate('JourneyPreview', {
      tier,
      name,
      blurb: tpl?.blurb,
    });
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
            20k and 30k are one big day. 50k, 60k, 75k and 100k can spread across up to
            three days. Tap any card to see the readiness check, prep, and pick a date —
            nothing starts until you commit.
          </Text>

          <Text style={styles.section}>Distance</Text>
          <View style={styles.tierRow}>
            {TIERS.map((t) => {
              const selected = tier === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTier(t.id)}
                  style={({ pressed }) => [
                    styles.tierChip,
                    selected && styles.tierChipSelected,
                    { transform: [{ scale: pressed ? 0.97 : 1 }] },
                  ]}
                >
                  <Text style={[styles.tierChipText, selected && styles.tierChipTextSelected]}>
                    {t.label}
                  </Text>
                  <Text style={[styles.tierChipDays, selected && styles.tierChipDaysSelected]}>
                    {t.days === 1 ? '1 day' : `${t.days} days`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.windowHint}>
            {tierMeta.label} {daysCopy}.
          </Text>

          {/* 🌅 Bespoke Guide suggestions, when the Guide is on and has
            * something specific to the runner. Quietly absent otherwise. */}
          {guideLoading ? (
            <View style={styles.guideLoadingRow}>
              <ActivityIndicator color={colors.textLight} size="small" />
              <Text style={styles.guideLoadingText}>Your Guide is thinking…</Text>
            </View>
          ) : null}
          {!guideLoading && guideSuggestions.length > 0 ? (
            <>
              <View style={styles.guideSectionRow}>
                <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                <Text style={styles.guideSection}>From your Guide</Text>
              </View>
              <View style={styles.cardList}>
                {guideSuggestions.map((tpl, idx) => (
                  <Pressable
                    key={`guide-${tpl.name}`}
                    onPress={() => goToPreview(tpl)}
                    style={({ pressed }) => [
                      styles.tplCard,
                      styles.guideCard,
                      { transform: [{ scale: pressed ? 0.99 : 1 }] },
                    ]}
                  >
                    <View style={styles.tplHeader}>
                      <Text style={styles.tplName}>{tpl.name}</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                    </View>
                    <Text style={styles.tplBlurb}>{tpl.blurb}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.section}>
            {guideSuggestions.length > 0 ? 'Or pick a starter' : 'Pick a starter'}
          </Text>
          {templates.length === 0 ? (
            <View style={styles.noTplCard}>
              <Text style={styles.noTplText}>
                No starters for this distance yet. Name your own below.
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {templates.map((tpl) => (
                <Pressable
                  key={tpl.name}
                  onPress={() => goToPreview(tpl)}
                  style={({ pressed }) => [
                    styles.tplCard,
                    { transform: [{ scale: pressed ? 0.99 : 1 }] },
                  ]}
                >
                  <View style={styles.tplHeader}>
                    <Text style={styles.tplName}>{tpl.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                  </View>
                  <Text style={styles.tplBlurb}>{tpl.blurb}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.section}>Or name your own</Text>
          <TextInput
            value={customName}
            onChangeText={(t) => setCustomName(t)}
            placeholder="The Friday twenty / Park rounds / etc."
            placeholderTextColor={colors.textLight}
            style={styles.input}
            maxLength={120}
          />
          {customName.trim().length > 0 ? (
            <Pressable
              onPress={() => goToPreview(null)}
              style={({ pressed }) => [
                styles.previewCustomBtn,
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              <Text style={styles.previewCustomText}>Preview “{customName.trim()}”</Text>
            </Pressable>
          ) : null}

          <View style={styles.footerNote}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textLight} />
            <Text style={styles.footerNoteText}>
              Tapping a card takes you to the preview — readiness, prep checklist, date.
              The journey only starts when you say so.
            </Text>
          </View>
        </ScrollView>
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
  tierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tierChip: {
    flexBasis: '18%',
    flexGrow: 1,
    minWidth: 60,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tierChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tierChipText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  tierChipTextSelected: { color: colors.textOnPrimary },
  tierChipDays: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  tierChipDaysSelected: { color: colors.textOnPrimary, opacity: 0.85 },
  windowHint: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  noTplCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noTplText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  cardList: { gap: spacing.sm },
  guideSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  guideSection: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  guideLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  guideLoadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  tplCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.small,
  },
  guideCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
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
  previewCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  previewCustomText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  footerNoteText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    lineHeight: 16,
  },
});
