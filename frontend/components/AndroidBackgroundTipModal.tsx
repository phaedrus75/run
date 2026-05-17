/**
 * One-time MIUI / Xiaomi guidance so background GPS tracking survives
 * aggressive battery optimization.
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme/colors';
import { dismissAndroidBackgroundTip } from '../services/androidBackgroundTip';

interface Props {
  visible: boolean;
  onContinue: () => void;
  onDismiss: () => void;
}

const STEPS = [
  {
    title: 'Battery — no restrictions',
    body: 'Settings → Apps → Manage apps → ZenRun → Battery saver → No restrictions',
  },
  {
    title: 'Autostart',
    body: 'Settings → Apps → Manage apps → ZenRun → Autostart → ON',
  },
  {
    title: 'Location — all the time',
    body: 'Settings → Apps → ZenRun → Permissions → Location → Allow all the time',
  },
  {
    title: 'Notifications',
    body: 'Allow notifications so ZenRun can show the GPS tracking bar when your screen is off.',
  },
];

export function AndroidBackgroundTipModal({
  visible,
  onContinue,
  onDismiss,
}: Props) {
  const [dontShow, setDontShow] = useState(false);

  const handleContinue = async () => {
    if (dontShow) await dismissAndroidBackgroundTip();
    onContinue();
  };

  const handleDismiss = async () => {
    if (dontShow) await dismissAndroidBackgroundTip();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleDismiss}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="battery-charging" size={28} color={colors.primary} />
          <Text style={styles.title}>Keep ZenRun tracking in the background</Text>
          <Text style={styles.subtitle}>
            Xiaomi and other Android phones can pause GPS when the screen locks.
            These settings help your run record reliably.
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {STEPS.map((s) => (
            <View key={s.title} style={styles.step}>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepBody}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <Pressable
          style={styles.checkRow}
          onPress={() => setDontShow((v) => !v)}
        >
          <Ionicons
            name={dontShow ? 'checkbox' : 'square-outline'}
            size={22}
            color={colors.primary}
          />
          <Text style={styles.checkLabel}>Don&apos;t show again</Text>
        </Pressable>

        <Pressable style={styles.primaryBtn} onPress={handleContinue}>
          <Text style={styles.primaryBtnText}>Got it — start</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={handleDismiss}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  scroll: {
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  step: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  stepTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  stepBody: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checkLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryBtnText: {
    color: colors.textOnPrimary,
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.md,
  },
  secondaryBtn: {
    padding: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
  },
});
