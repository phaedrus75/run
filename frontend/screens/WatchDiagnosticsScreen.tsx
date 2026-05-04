/**
 * APPLE WATCH SYNC DIAGNOSTICS
 * ============================
 *
 * Surfaces every signal we have about the Watch ↔ iPhone WatchConnectivity
 * channel. The whole point: when a workout fails to sync, we should be able to
 * tell *why* without attaching to Xcode. Each row is a yes/no the iPhone-side
 * native module knows the answer to.
 */

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import {
  drainPendingWatchPayloads,
  getWatchDiagnostics,
  pingWatch,
  resendLastWatchWorkout,
  WatchDiagnostics,
} from '../services/watchBridge';
import { useAuth } from '../contexts/AuthContext';
import { isAdminUser } from '../constants/admin';

interface Props {
  navigation: any;
}

type DiagState = (WatchDiagnostics & { pendingQueueSize: number }) | null;

function formatRelative(iso?: string): string {
  if (!iso) return 'never';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return new Date(t).toLocaleString();
}

function YesNo({ value }: { value: boolean | undefined }) {
  if (value === undefined) return <Text style={styles.unknown}>—</Text>;
  return (
    <Text style={[styles.value, value ? styles.ok : styles.bad]}>
      {value ? 'yes' : 'no'}
    </Text>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <View style={styles.rowValueWrap}>{children}</View>
    </View>
  );
}

export function WatchDiagnosticsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const adminAllowed = isAdminUser(user?.email);

  useLayoutEffect(() => {
    if (user != null && !adminAllowed) {
      Alert.alert('Not available', 'Apple Watch sync tools are only available for administrators.');
      navigation.goBack();
    }
  }, [user, adminAllowed, navigation]);

  const [diag, setDiag] = useState<DiagState>(null);
  const [loading, setLoading] = useState(false);
  const [draining, setDraining] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getWatchDiagnostics();
      setDiag(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminAllowed) return;
    void refresh();
    // 10s is long enough to feel responsive without flickering values mid-read.
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh, adminAllowed]);

  const [pinging, setPinging] = useState(false);
  const [resending, setResending] = useState(false);

  const onPingWatch = useCallback(async () => {
    setPinging(true);
    try {
      const reply = await pingWatch();
      const lines = [
        `Watch session: ${reply?.activationState ?? 'unknown'}`,
        `Reachable from watch side: ${reply?.isReachable ? 'yes' : 'no'}`,
        `Last send attempt: ${reply?.lastSendAt ? new Date(reply.lastSendAt).toLocaleTimeString() : 'never'}`,
        `Last send result: ${reply?.lastSendOk === true ? 'ok' : reply?.lastSendError ?? 'n/a'}`,
        `Stored payload to resend: ${reply?.hasStoredPayload ? 'yes' : 'no'}`,
      ];
      Alert.alert('Watch reports', lines.join('\n'));
      await refresh();
    } catch (e) {
      Alert.alert(
        'Ping failed',
        e instanceof Error
          ? `${e.message}\n\nMake sure the ZenRun watch app is open and the watch is awake.`
          : 'Watch is not reachable',
      );
    } finally {
      setPinging(false);
    }
  }, [refresh]);

  const onResendLast = useCallback(async () => {
    setResending(true);
    try {
      const reply = await resendLastWatchWorkout();
      if (reply?.had_payload) {
        Alert.alert(
          'Resend triggered',
          'The watch fired its last saved workout again. The counters above should tick up within a few seconds.',
        );
      } else {
        Alert.alert(
          'Nothing to resend',
          'The watch does not have a saved workout to resend. Save one on the watch first.',
        );
      }
      await refresh();
    } catch (e) {
      Alert.alert(
        'Resend failed',
        e instanceof Error
          ? `${e.message}\n\nOpen the ZenRun watch app, then try again.`
          : 'Watch is not reachable',
      );
    } finally {
      setResending(false);
    }
  }, [refresh]);

  const onDrain = useCallback(async () => {
    setDraining(true);
    try {
      const n = await drainPendingWatchPayloads();
      Alert.alert('Watch sync', n > 0 ? `Uploaded ${n} queued workout(s).` : 'Nothing queued to upload.');
      await refresh();
    } catch (e) {
      Alert.alert('Watch sync', e instanceof Error ? e.message : 'Drain failed');
    } finally {
      setDraining(false);
    }
  }, [refresh]);

  const channelHealthy =
    !!diag?.isPaired && !!diag?.isWatchAppInstalled && diag?.activationState === 'activated';

  if (user != null && !adminAllowed) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Apple Watch Sync</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View
          style={[
            styles.banner,
            { backgroundColor: channelHealthy ? '#E8F5E9' : '#FFF3E0' },
          ]}
        >
          <Ionicons
            name={channelHealthy ? 'checkmark-circle' : 'warning'}
            size={20}
            color={channelHealthy ? '#2E7D32' : '#E65100'}
          />
          <Text style={styles.bannerText}>
            {channelHealthy
              ? 'Channel looks healthy. Save a workout on the watch and it should appear within a few seconds.'
              : 'Channel not ready. Check the rows below and try opening the ZenRun watch app.'}
          </Text>
        </View>

        <Text style={styles.section}>WCSession on this iPhone</Text>
        <View style={styles.card}>
          <Row label="Supported" hint="iPhone can talk to a paired Apple Watch">
            <YesNo value={diag?.supported} />
          </Row>
          <Row label="Activation" hint="Must be 'activated' for delivery">
            <Text style={styles.value}>{diag?.activationState ?? '—'}</Text>
          </Row>
          {diag?.activationError ? (
            <Row label="Activation error">
              <Text style={[styles.value, styles.bad]}>{diag.activationError}</Text>
            </Row>
          ) : null}
          <Row label="Watch paired" hint="A watch is paired with this iPhone">
            <YesNo value={diag?.isPaired} />
          </Row>
          <Row label="Watch app installed" hint="ZenRun is installed on the paired watch">
            <YesNo value={diag?.isWatchAppInstalled} />
          </Row>
          <Row label="Reachable" hint="Watch is awake & nearby right now">
            <YesNo value={diag?.isReachable} />
          </Row>
        </View>

        <Text style={styles.section}>Messages received</Text>
        <View style={styles.card}>
          <Row label="transferUserInfo (queued)">
            <Text style={styles.value}>{diag?.userInfoReceivedCount ?? 0}</Text>
          </Row>
          <Row label="applicationContext (latest)">
            <Text style={styles.value}>{diag?.appContextReceivedCount ?? 0}</Text>
          </Row>
          <Row label="ZenRun workout payloads">
            <Text style={styles.value}>{diag?.zenPayloadCount ?? 0}</Text>
          </Row>
          <Row label="Last userInfo">
            <Text style={styles.value}>{formatRelative(diag?.lastUserInfoAt)}</Text>
          </Row>
          <Row label="Last applicationContext">
            <Text style={styles.value}>{formatRelative(diag?.lastAppContextAt)}</Text>
          </Row>
          <Row label="Outstanding transfers" hint="Items waiting to deliver from watch">
            <Text style={styles.value}>{diag?.outstandingUserInfoTransfers ?? 0}</Text>
          </Row>
        </View>

        <Text style={styles.section}>Local upload queue</Text>
        <View style={styles.card}>
          <Row label="Native buffer" hint="Got an event before JS attached">
            <Text style={styles.value}>{diag?.bufferedPayloads ?? 0}</Text>
          </Row>
          <Row label="JS listener attached">
            <YesNo value={diag?.hasJsListener} />
          </Row>
          <Row label="Pending uploads" hint="Failed/unauth'd workouts saved on this iPhone">
            <Text style={styles.value}>{diag?.pendingQueueSize ?? 0}</Text>
          </Row>
        </View>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          onPress={onPingWatch}
          disabled={pinging}
        >
          <Ionicons name="pulse" size={18} color="#fff" />
          <Text style={styles.buttonText}>
            {pinging ? 'Pinging…' : 'Ping watch (live)'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.buttonSecondary,
            pressed && { opacity: 0.7 },
          ]}
          onPress={onResendLast}
          disabled={resending}
        >
          <Ionicons name="refresh" size={18} color={colors.primary} />
          <Text style={styles.buttonSecondaryText}>
            {resending ? 'Asking watch…' : 'Resend last workout from watch'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.buttonSecondary,
            pressed && { opacity: 0.7 },
          ]}
          onPress={onDrain}
          disabled={draining}
        >
          <Ionicons name="cloud-upload" size={18} color={colors.primary} />
          <Text style={styles.buttonSecondaryText}>
            {draining ? 'Uploading…' : 'Retry pending uploads on this iPhone'}
          </Text>
        </Pressable>

        <Text style={styles.helpText}>
          If the counters above stay at zero after saving on the watch:
          {'\n\n'}1. Open the ZenRun watch app and tap "Ping watch (live)" — this proves
          the channel works in real time.
          {'\n'}2. If the ping succeeds but workouts still don't arrive, tap
          "Resend last workout from watch" to re-fire the most recent payload.
          {'\n'}3. If ping fails entirely, restart the watch (hold side button → Power Off → on)
          and try again.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4, width: 32 },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  banner: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  bannerText: { flex: 1, fontSize: typography.sizes.sm, color: colors.text, lineHeight: 18 },
  section: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    color: colors.textLight,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.small,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  rowHint: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  rowValueWrap: { marginLeft: spacing.md, alignItems: 'flex-end' },
  value: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
  ok: { color: '#2E7D32' },
  bad: { color: '#C62828' },
  unknown: { color: colors.textLight, fontSize: typography.sizes.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  buttonText: { color: '#fff', fontSize: typography.sizes.md, fontWeight: typography.weights.bold },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonSecondaryText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  helpText: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});
