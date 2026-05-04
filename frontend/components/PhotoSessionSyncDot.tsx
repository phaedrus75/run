/**
 * Status light on in-activity photo thumbnails: Photos library + server upload.
 * Blinking yellow until both are done, then solid green. Red / orange for failures / denied.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import type { PhotoEntry } from '../services/photoSession';

export type PhotoSessionSyncVisual = 'green' | 'yellow' | 'red' | 'orange';

export function photoEntrySyncVisual(p: PhotoEntry): PhotoSessionSyncVisual {
  if (p.upload.status === 'failed' || p.archive.status === 'failed') return 'red';
  if (p.archive.status === 'denied') return 'orange';
  if (p.archive.status === 'done' && p.upload.status === 'done') return 'green';
  return 'yellow';
}

const COLORS: Record<PhotoSessionSyncVisual, string> = {
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#EF4444',
  orange: '#F59E0B',
};

export function PhotoSessionSyncDot({
  photo,
  style,
}: {
  photo: PhotoEntry;
  style?: object;
}) {
  const visual = photoEntrySyncVisual(photo);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visual !== 'yellow') {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [visual, opacity]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: COLORS[visual], opacity: visual === 'yellow' ? opacity : 1 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
  },
});
