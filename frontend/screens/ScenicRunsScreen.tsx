/**
 * 📸 SCENIC RUNS SCREEN
 * ======================
 * 
 * Gallery of outdoor runs with photos, displayed as journey timelines.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { photoApi, type ScenicRun, type RunPhoto } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScenicRunsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ScenicRunsModal({ visible, onClose }: ScenicRunsModalProps) {
  const [scenicRuns, setScenicRuns] = useState<ScenicRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ScenicRun | null>(null);
  const [runPhotos, setRunPhotos] = useState<RunPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<RunPhoto | null>(null);

  const fetchScenicRuns = useCallback(async () => {
    try {
      const data = await photoApi.getScenicRuns();
      setScenicRuns(data);
    } catch (e) {
      console.error('Failed to fetch scenic runs:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchScenicRuns();
    }
  }, [visible, fetchScenicRuns]);

  const handleRunPress = async (run: ScenicRun) => {
    setSelectedRun(run);
    setLoadingPhotos(true);
    try {
      const photos = await photoApi.getForRun(run.id);
      setRunPhotos(photos);
    } catch (e) {
      console.error('Failed to fetch run photos:', e);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderRunCard = (run: ScenicRun) => (
    <TouchableOpacity
      key={run.id}
      style={[styles.runCard, shadows.small]}
      onPress={() => handleRunPress(run)}
      activeOpacity={0.8}
    >
      {run.cover_photo && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${run.cover_photo}` }}
          style={styles.coverImage}
        />
      )}
      <View style={styles.runCardInfo}>
        <View style={styles.runCardTop}>
          <Text style={styles.runCardDate}>{formatDate(run.completed_at)}</Text>
          <Text style={styles.runCardPhotos}>📸 {run.photo_count}</Text>
        </View>
        <View style={styles.runCardStats}>
          <Text style={styles.runCardDistance}>{run.run_type.toUpperCase()}</Text>
          <Text style={styles.runCardPace}>{run.pace}/km</Text>
          <Text style={styles.runCardTime}>{formatDuration(run.duration_seconds)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderJourneyView = () => {
    if (!selectedRun) return null;

    const maxDistance = selectedRun.distance_km;

    return (
      <View style={styles.journeyContainer}>
        <View style={styles.journeyHeader}>
          <TouchableOpacity onPress={() => { setSelectedRun(null); setRunPhotos([]); }}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.journeyTitle}>
            {selectedRun.run_type.toUpperCase()} — {formatDate(selectedRun.completed_at)}
          </Text>
        </View>

        {loadingPhotos ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView style={styles.journeyScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.timeline}>
              {/* Start marker */}
              <View style={styles.timelineNode}>
                <View style={styles.timelineDot} />
                <Text style={styles.timelineKm}>Start</Text>
              </View>
              <View style={styles.timelineLine} />

              {/* Photo nodes along the route */}
              {Array.from({ length: Math.floor(maxDistance) }, (_, i) => i + 1).map(km => {
                const photo = runPhotos.find(p => p.distance_marker_km === km);
                return (
                  <React.Fragment key={km}>
                    <View style={styles.timelineNode}>
                      <View style={[styles.timelineDot, photo && styles.timelineDotActive]} />
                      <Text style={[styles.timelineKm, photo && styles.timelineKmActive]}>{km}K</Text>
                    </View>
                    {photo && (
                      <TouchableOpacity
                        style={styles.timelinePhoto}
                        onPress={() => setFullScreenPhoto(photo)}
                        activeOpacity={0.9}
                      >
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${photo.photo_data}` }}
                          style={styles.timelineImage}
                        />
                        {photo.caption && (
                          <Text style={styles.timelineCaption}>{photo.caption}</Text>
                        )}
                      </TouchableOpacity>
                    )}
                    <View style={styles.timelineLine} />
                  </React.Fragment>
                );
              })}

              {/* Finish marker */}
              <View style={styles.timelineNode}>
                <View style={[styles.timelineDot, styles.timelineDotFinish]} />
                <Text style={[styles.timelineKm, styles.timelineKmActive]}>🏁 Finish</Text>
              </View>
            </View>
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>📸 Scenic Runs</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>Done</Text>
          </TouchableOpacity>
        </View>

        {selectedRun ? (
          renderJourneyView()
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => {
                setRefreshing(true);
                fetchScenicRuns();
              }} />
            }
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : scenicRuns.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🏞️</Text>
                <Text style={styles.emptyTitle}>No scenic runs yet</Text>
                <Text style={styles.emptyText}>
                  Log an outdoor run and add photos to get started.
                  Each photo gets tagged to a distance marker along your route.
                </Text>
              </View>
            ) : (
              scenicRuns.map(renderRunCard)
            )}
          </ScrollView>
        )}

        {/* Full-screen photo viewer */}
        <Modal
          visible={fullScreenPhoto !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setFullScreenPhoto(null)}
        >
          <TouchableOpacity
            style={styles.fullScreenOverlay}
            activeOpacity={1}
            onPress={() => setFullScreenPhoto(null)}
          >
            {fullScreenPhoto && (
              <View style={styles.fullScreenContent}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${fullScreenPhoto.photo_data}` }}
                  style={styles.fullScreenImage}
                  resizeMode="contain"
                />
                <Text style={styles.fullScreenMarker}>
                  📍 {fullScreenPhoto.distance_marker_km}K mark
                </Text>
                {fullScreenPhoto.caption && (
                  <Text style={styles.fullScreenCaption}>{fullScreenPhoto.caption}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  closeBtn: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Run cards
  runCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 180,
  },
  runCardInfo: {
    padding: spacing.md,
  },
  runCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  runCardDate: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  runCardPhotos: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  runCardStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  runCardDistance: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  runCardPace: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    alignSelf: 'center',
  },
  runCardTime: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    alignSelf: 'center',
  },

  // Journey view
  journeyContainer: {
    flex: 1,
  },
  journeyHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  journeyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  journeyScroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Timeline
  timeline: {
    paddingLeft: 20,
  },
  timelineNode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textLight,
    marginRight: spacing.md,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timelineDotFinish: {
    backgroundColor: colors.accent,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  timelineKm: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    fontWeight: typography.weights.medium,
  },
  timelineKmActive: {
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.textLight + '40',
    marginLeft: 5,
  },
  timelinePhoto: {
    marginLeft: 30,
    marginVertical: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...shadows.small,
  },
  timelineImage: {
    width: SCREEN_WIDTH - 90,
    height: 200,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  timelineCaption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },

  // Full-screen photo viewer
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenContent: {
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
  },
  fullScreenMarker: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    marginTop: spacing.md,
  },
  fullScreenCaption: {
    color: '#ccc',
    fontSize: typography.sizes.sm,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
