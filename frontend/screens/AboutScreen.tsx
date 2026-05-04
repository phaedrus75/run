/**
 * Brand-aligned About — reachable from the drawer.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme/colors';

export function AboutScreen({ navigation }: { navigation: any }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>About ZenRun</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lede}>Show up. Reflect.</Text>
        <Text style={styles.body}>
          ZenRun lives in two places: the path you take, and the album you enjoy
          afterwards. Photos, maps, and how it felt — kept together so a run
          stays yours a year later.
        </Text>
        <Text style={styles.body}>
          Walks count the same way. Same maps, same album, same rhythm — just
          a gentler pace.
        </Text>
        <Text style={styles.quote}>The path and the album.</Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.text },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  lede: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  quote: {
    marginTop: spacing.lg,
    fontSize: typography.sizes.lg,
    fontStyle: 'italic',
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});
