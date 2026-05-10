/**
 * ❤️ MaxHrSettingCard
 *
 * Profile section that lets the user pick how their max heart rate is
 * resolved for HR-zone bucketing on imported workouts. Three modes:
 *
 *   • Default — server constant (190 bpm). Good enough for most people.
 *   • Age     — store age, server computes Tanaka (208 - 0.7·age).
 *               Auto-tracks birthdays without user action.
 *   • Custom  — user types their own bpm (lab tested, watch-derived,
 *               whatever they trust).
 *
 * The card shows the *effective* bpm in big type so the user can see
 * exactly what the importer is using right now. Saves persist
 * server-side via `maxHrApi.set` and clear the appленic-Health max-HR
 * cache so the next workout import picks up the fresh value.
 *
 * Historical workouts are NOT re-bucketed — `hr_zones_json.max_hr_used`
 * preserves the baseline they were computed with originally.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';
import {
  MaxHrMode,
  MaxHrPreference,
  maxHrApi,
} from '../services/api';
import { invalidateMaxHrCache } from '../services/appleHealth';

type LoadState = 'loading' | 'ready' | 'error';

interface Props {
  /** Optional callback fired after a successful save. Useful when the
   *  parent wants to re-fetch related state (e.g. zone displays). */
  onSaved?: (pref: MaxHrPreference) => void;
}

export function MaxHrSettingCard({ onSaved }: Props) {
  const [pref, setPref] = useState<MaxHrPreference | null>(null);
  const [load, setLoad] = useState<LoadState>('loading');
  const [mode, setMode] = useState<MaxHrMode>('default');
  const [ageInput, setAgeInput] = useState('');
  const [bpmInput, setBpmInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await maxHrApi.get();
        if (!alive) return;
        setPref(p);
        setMode(p.mode);
        setAgeInput(p.max_hr_age != null ? String(p.max_hr_age) : '');
        setBpmInput(p.max_hr_bpm != null ? String(p.max_hr_bpm) : '');
        setLoad('ready');
      } catch {
        if (alive) setLoad('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Live preview of what the bpm will resolve to for the currently
  // selected mode + inputs (mirrors the server's _resolve_max_hr).
  function previewBpm(): number | null {
    if (mode === 'default') return pref?.default_bpm ?? 190;
    if (mode === 'age') {
      const a = parseInt(ageInput, 10);
      if (Number.isFinite(a) && a >= 10 && a <= 100) {
        return Math.round(208 - 0.7 * a);
      }
      return null;
    }
    const b = parseInt(bpmInput, 10);
    if (Number.isFinite(b) && b >= 80 && b <= 250) return b;
    return null;
  }

  async function handleSave() {
    if (!pref) return;
    if (mode === 'age') {
      const a = parseInt(ageInput, 10);
      if (!Number.isFinite(a) || a < 10 || a > 100) {
        Alert.alert('Check your age', 'Please enter an age between 10 and 100.');
        return;
      }
    }
    if (mode === 'custom') {
      const b = parseInt(bpmInput, 10);
      if (!Number.isFinite(b) || b < 80 || b > 250) {
        Alert.alert('Check your max HR', 'Please enter a value between 80 and 250 bpm.');
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await maxHrApi.set({
        mode,
        max_hr_age: mode === 'age' ? parseInt(ageInput, 10) : null,
        max_hr_bpm: mode === 'custom' ? parseInt(bpmInput, 10) : null,
      });
      setPref(updated);
      setMode(updated.mode);
      setAgeInput(updated.max_hr_age != null ? String(updated.max_hr_age) : '');
      setBpmInput(updated.max_hr_bpm != null ? String(updated.max_hr_bpm) : '');
      // Drop the cached value so the next HK import re-reads it.
      invalidateMaxHrCache();
      onSaved?.(updated);
      Alert.alert('Saved', 'Future workout imports will use this baseline.');
    } catch (err: any) {
      Alert.alert(
        'Could not save',
        err?.message || 'Please try again in a moment.',
      );
    } finally {
      setSaving(false);
    }
  }

  const dirty = (() => {
    if (!pref) return false;
    if (pref.mode !== mode) return true;
    if (mode === 'age') {
      return String(pref.max_hr_age ?? '') !== ageInput.trim();
    }
    if (mode === 'custom') {
      return String(pref.max_hr_bpm ?? '') !== bpmInput.trim();
    }
    return false;
  })();

  if (load === 'loading') {
    return (
      <View style={[styles.section, shadows.small]}>
        <Text style={styles.sectionTitle}>Max heart rate</Text>
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.md }} />
      </View>
    );
  }

  if (load === 'error' || !pref) {
    return (
      <View style={[styles.section, shadows.small]}>
        <Text style={styles.sectionTitle}>Max heart rate</Text>
        <Text style={styles.helpText}>
          Couldn't load your max-HR preference. Pull to refresh and try again.
        </Text>
      </View>
    );
  }

  const preview = previewBpm();
  const effective = pref.effective_max_hr_bpm;

  return (
    <View style={[styles.section, shadows.small]}>
      <Text style={styles.sectionTitle}>Max heart rate</Text>
      <Text style={styles.helpText}>
        Used to bucket Apple Watch heart-rate samples into zones (Z1–Z5)
        when importing workouts.
      </Text>

      <View style={styles.effectiveRow}>
        <Ionicons name="heart" size={18} color={colors.primary} />
        <Text style={styles.effectiveText}>
          Currently using{' '}
          <Text style={styles.effectiveBpm}>{effective} bpm</Text>
        </Text>
      </View>

      <View style={styles.modeRow}>
        <ModeChip
          label="Default"
          active={mode === 'default'}
          onPress={() => setMode('default')}
        />
        <ModeChip
          label="From age"
          active={mode === 'age'}
          onPress={() => setMode('age')}
        />
        <ModeChip
          label="Custom"
          active={mode === 'custom'}
          onPress={() => setMode('custom')}
        />
      </View>

      {mode === 'default' && (
        <Text style={styles.modeBlurb}>
          Use ZenRun's default of {pref.default_bpm} bpm. A reasonable
          starting point for most adult runners.
        </Text>
      )}

      {mode === 'age' && (
        <View style={styles.inputBlock}>
          <Text style={styles.label}>Your age (years)</Text>
          <TextInput
            style={styles.input}
            value={ageInput}
            onChangeText={setAgeInput}
            keyboardType="number-pad"
            placeholder="35"
            placeholderTextColor={colors.textLight}
            maxLength={3}
          />
          <Text style={styles.modeBlurb}>
            We use the Tanaka formula (208 − 0.7 × age). Modestly more
            accurate than 220 − age for adults, and it updates with you
            every birthday.
          </Text>
        </View>
      )}

      {mode === 'custom' && (
        <View style={styles.inputBlock}>
          <Text style={styles.label}>Max heart rate (bpm)</Text>
          <TextInput
            style={styles.input}
            value={bpmInput}
            onChangeText={setBpmInput}
            keyboardType="number-pad"
            placeholder="185"
            placeholderTextColor={colors.textLight}
            maxLength={3}
          />
          <Text style={styles.modeBlurb}>
            Use this if you've measured your max HR in a lab or know it
            from a hard, all-out effort.
          </Text>
        </View>
      )}

      {preview != null && preview !== effective && (
        <View style={styles.previewRow}>
          <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
          <Text style={styles.previewText}>
            Will use <Text style={styles.previewBpm}>{preview} bpm</Text> after save
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.saveButton,
          (!dirty || saving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!dirty || saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.textOnPrimary} size="small" />
        ) : (
          <Text style={styles.saveButtonText}>
            {dirty ? 'Save max HR' : 'Saved'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helpText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  effectiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  effectiveText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  effectiveBpm: {
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
  modeBlurb: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  inputBlock: {
    marginTop: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  previewText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  previewBpm: {
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
