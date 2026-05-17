/**
 * 🍎 AppleHealthImportScreen
 * ─────────────────────────────────────────────────────────────────────
 * Browse + import Apple Health workouts (runs, walks, hikes) recorded
 * via Apple Watch or the Workout app on iPhone. Built as a safety net
 * for runs we missed (GPS permission downgraded after a TestFlight
 * reinstall, watch-only sessions, etc.) and as a "log of all your
 * moves" feature so users can backfill their ZenRun history.
 *
 * UX flow:
 *   1. First entry → request HK auth (one-time iOS sheet)
 *   2. Show last 60 days of HK runs/walks/hikes minus what's already
 *      in ZenRun (server-dedupe by HKWorkout uuid)
 *   3. User taps a row to import single, or selects + "Import all"
 *      for the full set
 *   4. On success, the row disappears from the list and the count
 *      ticks down. No navigation away — keeps the user in the
 *      "browsing my Apple Health" flow until they're done.
 *
 * Failure modes are silent-ish: HK errors fall back to an empty state
 * with a "Try again" affordance; per-row import failures show a small
 * inline error pill on that row but don't abort the batch.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, typography, shadows } from '../theme/colors';
import {
  type ImportableWorkout,
  activityLabel,
  getAvailability,
  importMany,
  importWorkout,
  isHealthPlatform,
  listImportableWorkouts,
  requestAuth,
  healthPlatformName,
  openHealthSettings,
} from '../services/healthBridge';
import {
  formatDistanceKm,
  formatDurationHms,
} from '../services/walkLocationTracker';

interface Props {
  navigation?: any;
}

type RowState = 'idle' | 'importing' | 'imported' | 'error';

export function AppleHealthImportScreen({ navigation }: Props) {
  const [authChecked, setAuthChecked] = useState(false);
  const [authOk, setAuthOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [workouts, setWorkouts] = useState<ImportableWorkout[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  // 🔍 Per-row failure reason. Surfaced under each row so the user
  // (and we) can see exactly *why* an import failed instead of the
  // old generic "Couldn't import — tap to retry" line. Cleared when
  // the row transitions back to importing/imported.
  const [rowReasons, setRowReasons] = useState<Record<string, string>>({});
  const [importingAll, setImportingAll] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // ── Auth + initial load ────────────────────────────────────────────
  const initialise = useCallback(async () => {
    if (!isHealthPlatform() || !getAvailability()) {
      setAuthChecked(true);
      setAuthOk(false);
      return;
    }
    setLoading(true);
    try {
      const ok = await requestAuth();
      setAuthOk(ok);
      if (ok) {
        const ws = await listImportableWorkouts({ sinceDays: 60, limit: 100 });
        setWorkouts(ws);
      }
    } finally {
      setAuthChecked(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialise();
  }, [initialise]);

  const onRefresh = useCallback(async () => {
    if (!authOk) return;
    setRefreshing(true);
    try {
      const ws = await listImportableWorkouts({ sinceDays: 60, limit: 100 });
      // Drop any rows that we've already imported in this session — the
      // server dedupe handles re-imports, but the picker UX is cleaner
      // if successfully-imported rows stay gone.
      setWorkouts(
        ws.filter((w) => rowStates[w.uuid] !== 'imported'),
      );
    } finally {
      setRefreshing(false);
    }
  }, [authOk, rowStates]);

  // ── Per-row import ─────────────────────────────────────────────────
  const handleImportOne = useCallback(
    async (w: ImportableWorkout) => {
      if (rowStates[w.uuid] === 'importing') return;
      setRowStates((s) => ({ ...s, [w.uuid]: 'importing' }));
      // Clear any previous failure reason while we retry.
      setRowReasons((r) => {
        if (!r[w.uuid]) return r;
        const next = { ...r };
        delete next[w.uuid];
        return next;
      });
      try {
        Haptics.selectionAsync();
      } catch {}
      // Belt + braces: even though importWorkout traps and converts
      // most failures into ok:false results, an unexpected throw
      // (e.g. encodePolyline blowing up) would leave the row stuck
      // in "importing". Wrap so we always land in either 'imported'
      // or 'error', and capture the reason for the UI either way.
      let res: Awaited<ReturnType<typeof importWorkout>>;
      try {
        res = await importWorkout(w);
      } catch (err: any) {
        console.warn('[AppleHealthImport] importWorkout threw', err);
        res = {
          ok: false,
          reason: err?.message || 'Unexpected error during import',
        };
      }
      if (res.ok) {
        setRowStates((s) => ({ ...s, [w.uuid]: 'imported' }));
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        // Animate the row out after a short success beat so the user
        // sees the green tick before it disappears.
        setTimeout(() => {
          setWorkouts((cur) => cur.filter((x) => x.uuid !== w.uuid));
          setSelected((cur) => {
            if (!cur.has(w.uuid)) return cur;
            const next = new Set(cur);
            next.delete(w.uuid);
            return next;
          });
        }, 800);
      } else {
        // Persist the actual reason so the row can show it inline,
        // and log it so we can grab it from Mac Console.app if the
        // user is debugging with a tethered device.
        const reason = res.reason || 'Failed to import';
        console.warn('[AppleHealthImport] import failed', {
          uuid: w.uuid,
          kind: w.kind,
          distanceKm: w.distanceKm,
          hasRoute: w.hasRoute,
          reason,
        });
        setRowStates((s) => ({ ...s, [w.uuid]: 'error' }));
        setRowReasons((r) => ({ ...r, [w.uuid]: reason }));
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
      }
    },
    [rowStates],
  );

  // ── Bulk import ────────────────────────────────────────────────────
  const handleImportAll = useCallback(
    async (target: 'selected' | 'all') => {
      const targets =
        target === 'selected'
          ? workouts.filter((w) => selected.has(w.uuid))
          : workouts;
      if (targets.length === 0) return;
      setImportingAll(true);
      setBulkResult(null);
      const initial: Record<string, RowState> = { ...rowStates };
      for (const w of targets) initial[w.uuid] = 'importing';
      setRowStates(initial);
      const res = await importMany(targets);
      // Mark each as imported optimistically (importMany doesn't return
      // per-row results — failures stay visible because we re-fetch
      // below and they'll come back in the list).
      const next: Record<string, RowState> = { ...initial };
      for (const w of targets) next[w.uuid] = 'imported';
      setRowStates(next);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      setImportingAll(false);
      const summaryParts: string[] = [];
      if (res.imported > 0)
        summaryParts.push(`${res.imported} imported`);
      if (res.failed > 0) summaryParts.push(`${res.failed} failed`);
      setBulkResult(summaryParts.join(' · ') || 'Done');

      // Quietly re-fetch to drop the imported rows + pull in any new
      // workouts the watch synced while we were importing.
      setTimeout(() => onRefresh(), 1000);
    },
    [workouts, selected, rowStates, onRefresh],
  );

  // ── Selection helpers ──────────────────────────────────────────────
  const toggleSelect = useCallback((uuid: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }, []);

  const allSelected = useMemo(
    () => workouts.length > 0 && selected.size === workouts.length,
    [workouts, selected],
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(workouts.map((w) => w.uuid)));
  }, [allSelected, workouts]);

  // ── Render ─────────────────────────────────────────────────────────
  if (!isHealthPlatform()) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Not available</Text>
        <Text style={styles.emptyBody}>
          Workout import is available on iPhone (Apple Health) and Android
          (Health Connect).
        </Text>
      </View>
    );
  }

  if (!authChecked || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.emptyBody, { marginTop: spacing.md }]}>
          Reading your {healthPlatformName()} workouts…
        </Text>
      </View>
    );
  }

  if (!getAvailability()) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{healthPlatformName()} isn&apos;t available</Text>
        <Text style={styles.emptyBody}>
          {Platform.OS === 'android'
            ? 'Install or update the Health Connect app from the Play Store, then try again.'
            : "We couldn't reach HealthKit on this device. Try again on your iPhone."}
        </Text>
      </View>
    );
  }

  if (!authOk) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Permission needed</Text>
        <Text style={styles.emptyBody}>
          {Platform.OS === 'android'
            ? 'Open Health Connect and allow ZenRun to read workouts, distance, and heart rate. Then pull to refresh.'
            : "Open Settings → Privacy & Security → Health → ZenRun and turn on the workout categories you'd like to import. Then pull to refresh."}
        </Text>
        {Platform.OS === 'android' ? (
          <Pressable
            style={[styles.primaryBtn, { marginTop: spacing.lg }]}
            onPress={() => openHealthSettings()}
          >
            <Text style={styles.primaryBtnText}>Open Health Connect</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryBtn, { marginTop: spacing.lg }]}
            onPress={initialise}
          >
            <Text style={styles.primaryBtnText}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // Empty state when auth is granted but there's nothing new to import.
  if (workouts.length === 0) {
    return (
      <View style={styles.container}>
        <Header
          count={0}
          allSelected={false}
          onSelectAll={() => {}}
          onImportSelected={() => {}}
          onImportAll={() => {}}
          selectedCount={0}
          importing={false}
        />
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text style={[styles.emptyTitle, { marginTop: spacing.md }]}>
            All caught up
          </Text>
          <Text style={styles.emptyBody}>
            We don&apos;t see any new runs, walks or hikes from{' '}
            {healthPlatformName()} in the last 60 days. Pull to refresh
            after your next workout to see it here.
          </Text>
          <Pressable
            style={[styles.secondaryBtn, { marginTop: spacing.lg }]}
            onPress={onRefresh}
          >
            <Text style={styles.secondaryBtnText}>Refresh</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        count={workouts.length}
        allSelected={allSelected}
        onSelectAll={toggleSelectAll}
        onImportSelected={() => handleImportAll('selected')}
        onImportAll={() => handleImportAll('all')}
        selectedCount={selected.size}
        importing={importingAll}
      />
      {bulkResult && <Text style={styles.bulkResult}>{bulkResult}</Text>}
      <FlatList
        data={workouts}
        keyExtractor={(w) => w.uuid}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <WorkoutRow
            workout={item}
            selected={selected.has(item.uuid)}
            state={rowStates[item.uuid] ?? 'idle'}
            reason={rowReasons[item.uuid]}
            onToggleSelect={() => toggleSelect(item.uuid)}
            onImport={() => handleImportOne(item)}
          />
        )}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Header
// ─────────────────────────────────────────────────────────────────────

interface HeaderProps {
  count: number;
  allSelected: boolean;
  selectedCount: number;
  importing: boolean;
  onSelectAll: () => void;
  onImportSelected: () => void;
  onImportAll: () => void;
}

function Header({
  count,
  allSelected,
  selectedCount,
  importing,
  onSelectAll,
  onImportSelected,
  onImportAll,
}: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>{healthPlatformName()}</Text>
        <Text style={styles.subtitle}>
          {count > 0
            ? `${count} new ${count === 1 ? 'workout' : 'workouts'} to import`
            : 'No new workouts'}
        </Text>
      </View>
      {count > 0 && (
        <View style={styles.headerActions}>
          <Pressable style={styles.linkBtn} onPress={onSelectAll}>
            <Ionicons
              name={allSelected ? 'checkbox' : 'square-outline'}
              size={18}
              color={colors.primary}
            />
            <Text style={styles.linkBtnText}>
              {allSelected ? 'Unselect all' : 'Select all'}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {selectedCount > 0 ? (
            <Pressable
              style={[
                styles.primaryBtn,
                importing && styles.btnDisabled,
              ]}
              onPress={onImportSelected}
              disabled={importing}
            >
              <Text style={styles.primaryBtnText}>
                {importing
                  ? 'Importing…'
                  : `Import ${selectedCount}`}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[
                styles.primaryBtn,
                importing && styles.btnDisabled,
              ]}
              onPress={onImportAll}
              disabled={importing}
            >
              <Text style={styles.primaryBtnText}>
                {importing ? 'Importing…' : 'Import all'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Row
// ─────────────────────────────────────────────────────────────────────

interface RowProps {
  workout: ImportableWorkout;
  selected: boolean;
  state: RowState;
  reason?: string;
  onToggleSelect: () => void;
  onImport: () => void;
}

function WorkoutRow({
  workout,
  selected,
  state,
  reason,
  onToggleSelect,
  onImport,
}: RowProps) {
  const dateLabel = useMemo(() => formatDateLabel(workout.startedAt), [workout.startedAt]);
  const iconName = workout.kind === 'run' ? 'walk' : 'walk-outline';
  // ↑ both runs and walks use the walk glyph in Ionicons; we vary
  //   colour and label rather than icon to keep the layout calm.

  const isImported = state === 'imported';
  const isImporting = state === 'importing';
  const isError = state === 'error';

  return (
    <Pressable
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onToggleSelect}
      onLongPress={onImport}
      disabled={isImported || isImporting}
    >
      <Pressable
        hitSlop={12}
        onPress={onToggleSelect}
        style={styles.checkboxWrap}
      >
        <Ionicons
          name={selected ? 'checkbox' : 'square-outline'}
          size={22}
          color={selected ? colors.primary : colors.textLight}
        />
      </Pressable>

      <View style={styles.rowIconWrap}>
        <Ionicons
          name={iconName as any}
          size={22}
          color={workout.kind === 'run' ? colors.primary : colors.secondary}
        />
      </View>

      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>
          {activityLabel(workout.activityType)} · {workout.sourceLabel}
        </Text>
        <Text style={styles.rowMeta}>
          {dateLabel} · {formatDistanceKm(workout.distanceKm)} ·{' '}
          {formatDurationHms(workout.durationSeconds)}
          {!workout.hasRoute ? ' · indoor' : ''}
        </Text>
        {isError && (
          <Text style={styles.rowError}>
            {reason ? `Couldn't import: ${reason}` : "Couldn't import — tap to retry"}
          </Text>
        )}
      </View>

      <View style={styles.rowAction}>
        {isImporting && <ActivityIndicator size="small" color={colors.primary} />}
        {isImported && (
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        )}
        {!isImporting && !isImported && (
          <Pressable
            hitSlop={12}
            onPress={onImport}
            style={styles.rowImportBtn}
          >
            <Text style={styles.rowImportText}>Import</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Date formatter — "Today, 09:14" / "Yesterday, 18:02" / "May 7"
// ─────────────────────────────────────────────────────────────────────

function formatDateLabel(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  // Header --------------------------------------------------------------
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  linkBtnText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  primaryBtnText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  secondaryBtn: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  secondaryBtnText: {
    color: colors.text,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  bulkResult: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent,
    color: colors.text,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
  // List + row ----------------------------------------------------------
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    ...shadows.small,
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  checkboxWrap: {
    width: 26,
    alignItems: 'center',
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  rowMeta: {
    marginTop: 2,
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  rowError: {
    marginTop: 4,
    fontSize: typography.sizes.xs,
    color: colors.error,
  },
  rowAction: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  rowImportBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
  },
  rowImportText: {
    fontSize: typography.sizes.xs,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  },
});
