import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';

export type AchievementDetail = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category?: string;
};

interface AchievementDetailCardProps {
  achievement: AchievementDetail;
  onClose: () => void;
  footerHint?: string;
}

/** Card only — use inside a parent Modal for stacked celebrations. */
export function AchievementDetailCard({
  achievement,
  onClose,
  footerHint,
}: AchievementDetailCardProps) {
  const description =
    (achievement.description && achievement.description.trim()) ||
    'A meaningful milestone on your running journey.';

  return (
    <Pressable style={styles.cardWrap} onPress={e => e.stopPropagation()}>
      <View style={[styles.card, shadows.large]}>
        <Pressable style={styles.closeIcon} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.body}>
          <Text style={styles.emoji}>{achievement.emoji}</Text>
          <Text style={styles.name}>{achievement.name}</Text>
          {achievement.category ? (
            <Text style={styles.category}>{achievement.category}</Text>
          ) : null}

          <View style={styles.descriptionBlock}>
            <Text style={styles.descriptionLabel}>About this badge</Text>
            <Text
              style={styles.description}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {description}
            </Text>
          </View>
        </View>

        {footerHint ? <Text style={styles.footerHint}>{footerHint}</Text> : null}
      </View>
    </Pressable>
  );
}

interface AchievementDetailModalProps {
  visible: boolean;
  achievement: AchievementDetail | null;
  onClose: () => void;
  footerHint?: string;
}

export function AchievementDetailModal({
  visible,
  achievement,
  onClose,
  footerHint,
}: AchievementDetailModalProps) {
  if (!achievement) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <AchievementDetailCard
          achievement={achievement}
          onClose={onClose}
          footerHint={footerHint}
        />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  closeIcon: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 2,
  },
  body: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  name: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  category: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'capitalize',
    marginBottom: spacing.md,
  },
  descriptionBlock: {
    marginTop: spacing.sm,
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  descriptionLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    lineHeight: 18,
    textAlign: 'center',
  },
  footerHint: {
    marginTop: spacing.md,
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textAlign: 'center',
  },
});
