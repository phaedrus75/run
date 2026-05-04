/**
 * 🌳 NEIGHBOURHOOD — placeholder
 * ==============================
 *
 * Build 35 doesn't ship the Neighbourhood feed yet. This screen explains
 * what's coming, in the brand voice, and gives the user something to
 * engage with so the Community tab doesn't feel half-baked.
 *
 * Build 36 will replace this with the real feed:
 *   - Pseudonymous identity (zenrun-handle, not real name)
 *   - Photos from runs in the user's area
 *   - "Saves" and "I ran this" — never likes / leaderboards
 *   - Rank places, never people
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

interface Props {
  navigation: any;
}

export function NeighbourhoodScreen({ navigation }: Props) {
  const [interestedPressed, setInterestedPressed] = useState(false);
  const [pseudonym, setPseudonym] = useState('');

  const onInterested = () => {
    if (!pseudonym.trim()) {
      Alert.alert(
        'Pick a pseudonym first',
        'Your neighbourhood handle keeps things friendly without going public.',
      );
      return;
    }
    setInterestedPressed(true);
    Alert.alert(
      'Saved',
      `We'll let you know when ${pseudonym.trim()} can join the neighbourhood.`,
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>The Neighbourhood</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroIcon}>
          <Ionicons name="leaf-outline" size={36} color="#7E57C2" />
        </View>

        <Text style={styles.title}>Coming soon.</Text>
        <Text style={styles.lede}>
          A way to discover the runs of zenrunners near you, share what
          inspired you, and find new paths to walk and run — without the
          performance anxiety of a leaderboard.
        </Text>

        <View style={styles.principlesCard}>
          <Principle
            icon="person-outline"
            title="Pseudonymous by default"
            body="Pick a handle for your neighbourhood. Real names only inside circles you've chosen."
          />
          <Divider />
          <Principle
            icon="bookmark-outline"
            title="Saves, not likes"
            body="If a path moves you, save it. We don't count likes."
          />
          <Divider />
          <Principle
            icon="checkmark-done-outline"
            title="“I ran this”"
            body="A small tap to mark a saved place once you've actually run there. Discovery, then doing."
          />
          <Divider />
          <Principle
            icon="location-outline"
            title="Rank places, never people"
            body="The neighbourhood ranks parks, paths, and viewpoints — never runners."
          />
        </View>

        <View style={styles.holdingCard}>
          <Text style={styles.holdingLabel}>Reserve your handle</Text>
          <Text style={styles.holdingHint}>
            We'll save it for when the neighbourhood opens.
          </Text>
          <View style={styles.inputRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              value={pseudonym}
              onChangeText={setPseudonym}
              placeholder="zenrunner"
              placeholderTextColor={colors.textLight}
              autoCapitalize="none"
              maxLength={20}
              style={styles.input}
              editable={!interestedPressed}
            />
          </View>
          <Pressable
            onPress={onInterested}
            disabled={interestedPressed}
            style={({ pressed }) => [
              styles.interestedBtn,
              interestedPressed && styles.interestedBtnDone,
              { transform: [{ scale: pressed && !interestedPressed ? 0.97 : 1 }] },
            ]}
          >
            {interestedPressed ? (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.interestedBtnText}>Saved</Text>
              </>
            ) : (
              <Text style={styles.interestedBtnText}>I want in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.brandStrap}>
          Where you ran. What you saw. Never who's faster.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Principle({
  icon,
  title,
  body,
}: {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.principleRow}>
      <Ionicons name={icon} size={18} color="#7E57C2" />
      <View style={{ flex: 1 }}>
        <Text style={styles.principleTitle}>{title}</Text>
        <Text style={styles.principleBody}>{body}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const PURPLE = '#7E57C2';

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
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PURPLE + '18',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  lede: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    lineHeight: 22,
  },
  principlesCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
    ...shadows.small,
  },
  principleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  principleTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  principleBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 30,
  },
  holdingCard: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: PURPLE + '0E',
    borderWidth: 1,
    borderColor: PURPLE + '22',
  },
  holdingLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  holdingHint: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  atSign: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    fontWeight: typography.weights.semibold,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  interestedBtn: {
    marginTop: spacing.md,
    backgroundColor: PURPLE,
    borderRadius: radius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  interestedBtnDone: { backgroundColor: colors.success },
  interestedBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  brandStrap: {
    marginTop: spacing.xl,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    fontSize: typography.sizes.sm,
  },
});
