/**
 * ⚖️ WEIGHT TAB SCREEN
 * =====================
 *
 * Full-screen weight tracking hub. Auto-syncs new body-mass samples
 * from Apple Health (smart scale → Health → here) on every focus,
 * once the user has opted in via the consent card below.
 *
 * Sync model:
 *   - First visit on iOS → consent card asks "Sync from Apple Health?"
 *   - "Yes"  → request body-mass auth, run an immediate backfill from
 *              Jan 1 of the current year, then a quiet sync on every
 *              focus afterwards.
 *   - "Not now" → never asked again unless the user re-enables from
 *                 the muted "Connect Apple Health" link at the bottom.
 *
 * The actual HK plumbing lives in `services/appleHealth.ts`; this
 * screen just owns the preference, the focus loop, and the small
 * "Synced N" status line.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import {
  weightApi,
  type WeightProgress,
  type WeightChartData,
} from '../services/api';
import { WeightTracker } from '../components/WeightTracker';
import {
  autoSyncWeightsFromHealth,
  getAvailability,
  isHealthPlatform,
  healthPlatformName,
  requestWeightAuth,
} from '../services/healthBridge';
import { Platform } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme/colors';

interface Props {
  navigation: any;
}

// AsyncStorage key for the user's auto-sync preference. Three states:
//   null        — never asked (show the consent card)
//   "enabled"   — sync silently on every focus
//   "disabled"  — don't sync, show a muted reconnect link instead
const AUTO_SYNC_PREF_KEY = '@zenrun/apple_health_weight_auto_sync_pref';
type AutoSyncPref = 'enabled' | 'disabled' | null;

// Minimum gap between silent syncs in the same session — power users
// who pull-to-refresh repeatedly shouldn't trigger an HK roundtrip
// every time. 60s matches the workout-sync banner's throttle.
const SYNC_THROTTLE_MS = 60_000;

export function WeightTabScreen({ navigation }: Props) {
  const [progress, setProgress] = useState<WeightProgress | null>(null);
  const [chartData, setChartData] = useState<WeightChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🍎 Apple Health auto-sync state
  const [autoSyncPref, setAutoSyncPref] = useState<AutoSyncPref>(null);
  const [prefLoaded, setPrefLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const lastSynced = useRef<number>(0);

  // ── Backend data fetch ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        weightApi.getProgress(),
        weightApi.getChartData(),
      ]);
      setProgress(p);
      setChartData(c);
    } catch (e) {
      console.error('WeightTab fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Load saved preference ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(AUTO_SYNC_PREF_KEY);
        if (!cancelled) {
          setAutoSyncPref(
            v === 'enabled' ? 'enabled' : v === 'disabled' ? 'disabled' : null,
          );
        }
      } finally {
        if (!cancelled) setPrefLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Apple Health auto-sync (silent on every focus) ────────────────
  const runSilentSync = useCallback(async () => {
    if (!isHealthPlatform() || !getAvailability()) return;
    const now = Date.now();
    if (now - lastSynced.current < SYNC_THROTTLE_MS) return;
    lastSynced.current = now;

    setSyncing(true);
    try {
      // From Jan 1 of the current year — matches the goal window the
      // backend uses for chart + progress calculations. Anything older
      // is irrelevant to the 209→180 in 2026 narrative.
      const since = new Date(new Date().getFullYear(), 0, 1);
      const res = await autoSyncWeightsFromHealth({ since, limit: 365 });
      if (res.imported > 0) {
        setSyncStatus(
          `Synced ${res.imported} ${res.imported === 1 ? 'weight' : 'weights'} from ${healthPlatformName()}`,
        );
        // Refresh the local view so the chart shows the new points.
        await fetchData();
        // Auto-clear the status after a beat so the UI returns to
        // calm.
        setTimeout(() => setSyncStatus(null), 4000);
      }
    } catch (err) {
      // Silent failures are fine — next focus will retry.
      console.warn('[WeightTab] silent sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  // ── Initial mount + focus refresh ─────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
      // Run sync after the initial fetch returns so the user sees
      // their existing data first; new HK rows will land on the next
      // refresh tick anyway.
      if (autoSyncPref === 'enabled') {
        runSilentSync();
      }
    }, [fetchData, runSilentSync, autoSyncPref]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    // Force the throttle to allow a re-sync on explicit pull-to-refresh.
    lastSynced.current = 0;
    fetchData();
    if (autoSyncPref === 'enabled') runSilentSync();
  };

  // ── Consent handlers ──────────────────────────────────────────────
  const handleEnable = useCallback(async () => {
    try {
      await AsyncStorage.setItem(AUTO_SYNC_PREF_KEY, 'enabled');
    } catch {}
    setAutoSyncPref('enabled');
    // Show the iOS HK auth sheet. requestWeightAuth returns true on
    // any non-throwing call — Apple deliberately hides the user's
    // actual choice. We treat "no rows on first sync" as silently OK.
    setSyncing(true);
    try {
      await requestWeightAuth();
      lastSynced.current = 0;
      await runSilentSync();
    } finally {
      setSyncing(false);
    }
  }, [runSilentSync]);

  const handleDecline = useCallback(async () => {
    try {
      await AsyncStorage.setItem(AUTO_SYNC_PREF_KEY, 'disabled');
    } catch {}
    setAutoSyncPref('disabled');
  }, []);

  const handleReconnect = useCallback(async () => {
    // Same path as Enable — flip pref to enabled, request auth (which
    // is a no-op if already granted), and run a sync.
    await handleEnable();
  }, [handleEnable]);

  // ── Render ─────────────────────────────────────────────────────────
  const showConsentCard =
    isHealthPlatform() &&
    getAvailability() &&
    prefLoaded &&
    autoSyncPref === null;
  const showReconnectLink =
    isHealthPlatform() &&
    getAvailability() &&
    prefLoaded &&
    autoSyncPref === 'disabled';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Weight</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {showConsentCard && (
          <ConsentCard
            onEnable={handleEnable}
            onDecline={handleDecline}
            busy={syncing}
          />
        )}

        {(syncing || syncStatus) && (
          <View style={styles.syncStatus}>
            {syncing && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            {syncStatus && (
              <Text style={styles.syncStatusText}>{syncStatus}</Text>
            )}
            {syncing && !syncStatus && (
              <Text style={styles.syncStatusText}>
                Checking Apple Health…
              </Text>
            )}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : progress ? (
          <WeightTracker
            progress={progress}
            chartData={chartData}
            onUpdate={fetchData}
            showChart
          />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>⚖️</Text>
            <Text style={styles.emptyTitle}>No weight data yet</Text>
            <Text style={styles.emptyText}>
              Log your first entry to start tracking your progress toward your goal.
            </Text>
          </View>
        )}

        {showReconnectLink && (
          <TouchableOpacity
            style={styles.reconnectRow}
            onPress={handleReconnect}
            activeOpacity={0.7}
          >
            <Ionicons name="heart-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.reconnectText}>
              Sync weight from {healthPlatformName()}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Consent card
// ─────────────────────────────────────────────────────────────────────

interface ConsentProps {
  onEnable: () => void;
  onDecline: () => void;
  busy: boolean;
}

function ConsentCard({ onEnable, onDecline, busy }: ConsentProps) {
  return (
    <View style={[styles.consentCard, shadows.small]}>
      <View style={styles.consentIconWrap}>
        <Ionicons name="heart" size={22} color={colors.textOnPrimary} />
      </View>
      <Text style={styles.consentTitle}>
        Sync weight from {healthPlatformName()}
      </Text>
      <Text style={styles.consentBody}>
        We'll quietly pull weight readings from your scale (or Health app)
        whenever you open this tab. No re-typing the same number.
      </Text>
      <View style={styles.consentBtnRow}>
        <TouchableOpacity
          style={[styles.consentBtnSecondary]}
          onPress={onDecline}
          disabled={busy}
        >
          <Text style={styles.consentBtnSecondaryText}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.consentBtnPrimary, busy && styles.consentBtnDisabled]}
          onPress={onEnable}
          disabled={busy}
        >
          <Text style={styles.consentBtnPrimaryText}>
            {busy ? 'Connecting…' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
  },

  // ── Consent card ────────────────────────────────────────────────────
  consentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  consentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  consentTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  consentBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  consentBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  consentBtnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  consentBtnPrimaryText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  consentBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  consentBtnSecondaryText: {
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    fontSize: typography.sizes.sm,
  },
  consentBtnDisabled: {
    opacity: 0.6,
  },

  // ── Sync status line ────────────────────────────────────────────────
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  syncStatusText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },

  // ── Reconnect link (when user previously declined) ─────────────────
  reconnectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  reconnectText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },

  // ── Empty state (no data yet) ───────────────────────────────────────
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.sm },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
