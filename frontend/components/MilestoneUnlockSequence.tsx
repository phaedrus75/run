import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Pressable, StyleSheet, Dimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { AchievementDetailCard, type AchievementDetail } from './AchievementDetailModal';
import { spacing } from '../theme/colors';

interface MilestoneUnlockSequenceProps {
  visible: boolean;
  items: AchievementDetail[];
  onComplete: () => void;
}

/**
 * Full-screen milestone celebration: confetti + detail card, one badge at a time.
 */
export function MilestoneUnlockSequence({
  visible,
  items,
  onComplete,
}: MilestoneUnlockSequenceProps) {
  const [index, setIndex] = useState(0);
  const confettiRef = useRef<any>(null);
  const prevVisible = useRef(false);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setIndex(0);
    }
    prevVisible.current = visible;
  }, [visible]);

  useEffect(() => {
    if (visible && items.length > 0) {
      const t = setTimeout(() => confettiRef.current?.start(), 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [visible, index, items.length]);

  if (!visible || items.length === 0) return null;

  const current = items[index];
  const w = Dimensions.get('window').width;
  // `>=` (rather than `===`) so we still close cleanly if `items` shrinks
  // while the modal is open — defensive against a parent re-render passing
  // a smaller array than `index` after an unlock has already been shown.
  const isLast = index >= items.length - 1;

  const advance = () => {
    if (isLast) {
      onComplete();
    } else {
      setIndex(i => i + 1);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={advance}>
      <Pressable style={styles.backdrop} onPress={advance}>
        <ConfettiCannon
          key={`cf-${index}`}
          ref={confettiRef}
          count={180}
          origin={{ x: w / 2, y: -12 }}
          autoStart={false}
          fadeOut
          fallSpeed={2800}
          explosionSpeed={380}
          colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#A29BFE']}
        />
        <AchievementDetailCard
          achievement={current}
          onClose={advance}
          footerHint={items.length > 1 ? `${index + 1} of ${items.length}` : undefined}
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
});
