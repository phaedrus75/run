/**
 * Status light on in-activity photo thumbnails: Photos library + server upload.
 * Blinking yellow until done, then solid green. Red / orange for failures / denied.
 *
 * Semantics depend on whether the activity has been saved to the server yet:
 *   - **During an active run/walk** (`hasServerActivity = false`): the photo
 *     can't be uploaded because there's no run/walk id on the server to attach
 *     it to. "Green" therefore means "safely on disk + Photos library" — that
 *     is the strongest guarantee available before save. Upload happens after
 *     the user hits Save and is reflected on the post-save screen.
 *   - **After save** (`hasServerActivity = true`): "green" requires both the
 *     archive and the server upload to be done.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import type { PhotoEntry } from '../services/photoSession';

export type PhotoSessionSyncVisual = 'green' | 'yellow' | 'red' | 'orange';

export function photoEntrySyncVisual(
  p: PhotoEntry,
  hasServerActivity = false,
): PhotoSessionSyncVisual {
  // Failures and denials are always called out — they're actionable.
  if (p.archive.status === 'failed') return 'red';
  if (p.archive.status === 'denied') return 'orange';
  if (hasServerActivity && p.upload.status === 'failed') return 'red';

  if (hasServerActivity) {
    return p.archive.status === 'done' && p.upload.status === 'done'
      ? 'green'
      : 'yellow';
  }
  // No server activity yet — "safe on device" is the strongest available
  // guarantee. Upload is not possible until linkActivityId runs.
  return p.archive.status === 'done' ? 'green' : 'yellow';
}

const COLORS: Record<PhotoSessionSyncVisual, string> = {
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#EF4444',
  orange: '#F59E0B',
};

export function PhotoSessionSyncDot({
  photo,
  hasServerActivity = false,
  style,
}: {
  photo: PhotoEntry;
  /** True once `linkActivityId` has stamped a run/walk id onto the manifest.
   *  During an active recording this is always false. */
  hasServerActivity?: boolean;
  style?: object;
}) {
  const visual = photoEntrySyncVisual(photo, hasServerActivity);
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
