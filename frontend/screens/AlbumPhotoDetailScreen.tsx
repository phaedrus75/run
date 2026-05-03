/**
 * 📸 ALBUM PHOTO DETAIL
 * =====================
 *
 * Tapped from the Album grid. Renders the photo full-bleed with:
 *   - The activity context (run / walk, distance, when)
 *   - The caption
 *   - A "View activity" link that jumps to the run / walk detail screen
 *
 * The photo data and metadata are passed in via navigation params from the
 * Album grid (already loaded). We don't refetch unless something is missing.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AlbumPhoto } from '../services/api';
import { colors, spacing, typography, radius } from '../theme/colors';

interface Props {
  navigation: any;
  route: {
    params?: {
      photo?: AlbumPhoto;
    };
  };
}

export function AlbumPhotoDetailScreen({ navigation, route }: Props) {
  const photo = route?.params?.photo;

  if (!photo) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Photo not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const dateLabel = photo.activity.completed_at
    ? new Date(photo.activity.completed_at).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const goToActivity = () => {
    if (photo.kind === 'run') {
      navigation.navigate('Runs', {
        screen: 'RunHistory',
        params: { focusRunId: photo.activity.id },
      });
    } else {
      navigation.navigate('Walks', {
        screen: 'WalkDetail',
        params: { walkId: photo.activity.id },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{dateLabel}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.photoWrap}>
          {photo.photo_data ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${photo.photo_data}` }}
              style={styles.photo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.photoPlaceholder} />
          )}
        </View>

        {photo.caption && (
          <Text style={styles.caption}>{photo.caption}</Text>
        )}

        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Ionicons
              name={photo.kind === 'run' ? 'fitness' : 'walk'}
              size={16}
              color={colors.text}
            />
            <Text style={styles.metaTitle}>
              {photo.kind === 'run' ? 'Run' : 'Walk'} · {photo.activity.distance_km.toFixed(2)} km
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location" size={14} color={colors.textSecondary} />
            <Text style={styles.metaSub}>
              At {photo.distance_marker_km.toFixed(2)} km
            </Text>
          </View>
        </View>

        <Pressable onPress={goToActivity} style={styles.activityLink}>
          <Text style={styles.activityLinkText}>
            View {photo.kind === 'run' ? 'run' : 'walk'} →
          </Text>
        </Pressable>
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
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  photoWrap: {
    backgroundColor: '#000',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  photo: { width: '100%', aspectRatio: 1 },
  photoPlaceholder: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  caption: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  metaCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  metaSub: { fontSize: typography.sizes.sm, color: colors.textSecondary },
  activityLink: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  activityLinkText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: typography.sizes.md },
});
