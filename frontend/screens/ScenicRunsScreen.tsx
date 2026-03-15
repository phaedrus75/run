/**
 * 📸 SCENIC RUNS SCREEN
 * ======================
 * 
 * Photo album for outdoor runs — immersive cards and journey timelines.
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.45;

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
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalPhotos = scenicRuns.reduce((sum, r) => sum + r.photo_count, 0);

  const renderRunCard = (run: ScenicRun, index: number) => (
    <TouchableOpacity
      key={run.id}
      style={[styles.runCard, shadows.medium]}
      onPress={() => handleRunPress(run)}
      activeOpacity={0.9}
    >
      {run.cover_photo ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${run.cover_photo}` }}
          style={styles.coverImage}
        />
      ) : (
        <View style={[styles.coverImage, styles.coverPlaceholder]}>
          <Text style={styles.coverPlaceholderEmoji}>🏞️</Text>
        </View>
      )}
      {/* Gradient overlay for text readability */}
      <View style={styles.cardOverlay} />
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>{run.photo_count} photo{run.photo_count !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View style={styles.cardBottomRow}>
          <Text style={styles.cardDate}>{formatDate(run.completed_at)}</Text>
          <View style={styles.cardStatsRow}>
            <Text style={styles.cardDistance}>{run.run_type.toUpperCase()}</Text>
            <Text style={styles.cardDivider}>·</Text>
            <Text style={styles.cardPace}>{run.pace}/km</Text>
            <Text style={styles.cardDivider}>·</Text>
            <Text style={styles.cardTime}>{formatDuration(run.duration_seconds)}</Text>
          </View>
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { setSelectedRun(null); setRunPhotos([]); }}
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.journeyHeaderInfo}>
            <Text style={styles.journeyTitle}>
              {selectedRun.run_type.toUpperCase()} Run
            </Text>
            <Text style={styles.journeySubtitle}>
              {formatDate(selectedRun.completed_at)} · {selectedRun.pace}/km · {formatDuration(selectedRun.duration_seconds)}
            </Text>
          </View>
        </View>

        {loadingPhotos ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView style={styles.journeyScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.timeline}>
              {/* Start marker */}
              <View style={styles.timelineNode}>
                <View style={styles.timelineDotStart}>
                  <Text style={styles.dotEmoji}>🏃</Text>
                </View>
                <Text style={styles.timelineKmStart}>Start</Text>
              </View>
              <View style={styles.timelineLine} />

              {/* Km markers */}
              {Array.from({ length: Math.floor(maxDistance) }, (_, i) => i + 1).map(km => {
                const photosAtMarker = runPhotos.filter(p => p.distance_marker_km === km);
                const hasPhotos = photosAtMarker.length > 0;
                return (
                  <React.Fragment key={km}>
                    <View style={styles.timelineNode}>
                      <View style={[styles.timelineDot, hasPhotos && styles.timelineDotActive]} />
                      <Text style={[styles.timelineKm, hasPhotos && styles.timelineKmActive]}>
                        {km}K
                      </Text>
                      {hasPhotos && photosAtMarker.length > 1 && (
                        <Text style={styles.timelinePhotoCount}>{photosAtMarker.length} photos</Text>
                      )}
                    </View>
                    {photosAtMarker.map(photo => (
                      <TouchableOpacity
                        key={photo.id}
                        style={[styles.timelinePhoto, shadows.small]}
                        onPress={() => setFullScreenPhoto(photo)}
                        activeOpacity={0.9}
                      >
                        <Image
                          source={{ uri: `data:image/jpeg;base64,${photo.photo_data}` }}
                          style={styles.timelineImage}
                        />
                        {photo.caption && (
                          <View style={styles.captionBar}>
                            <Text style={styles.timelineCaption}>{photo.caption}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                    <View style={[styles.timelineLine, hasPhotos && styles.timelineLineActive]} />
                  </React.Fragment>
                );
              })}

              {/* Finish marker */}
              <View style={styles.timelineNode}>
                <View style={styles.timelineDotFinish}>
                  <Text style={styles.dotEmoji}>🏁</Text>
                </View>
                <Text style={styles.timelineKmFinish}>Finish</Text>
              </View>
            </View>
            <View style={{ height: 80 }} />
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {selectedRun ? (
          renderJourneyView()
        ) : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Scenic Runs</Text>
                {scenicRuns.length > 0 && (
                  <Text style={styles.subtitle}>
                    {scenicRuns.length} run{scenicRuns.length !== 1 ? 's' : ''} · {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtnWrap}>
                <Text style={styles.closeBtn}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[styles.scrollContent, scenicRuns.length <= 1 && styles.scrollContentCentered]}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => {
                  setRefreshing(true);
                  fetchScenicRuns();
                }} />
              }
              showsVerticalScrollIndicator={false}
            >
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
              ) : scenicRuns.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrap}>
                    <Text style={styles.emptyEmoji}>🏞️</Text>
                  </View>
                  <Text style={styles.emptyTitle}>Your trail album</Text>
                  <Text style={styles.emptyText}>
                    Add photos to your outdoor runs and they'll appear here as a beautiful journey log.
                  </Text>
                  <View style={styles.emptyHint}>
                    <Text style={styles.emptyHintText}>
                      Tap any outdoor run in History → Edit → Add scenic photo
                    </Text>
                  </View>
                </View>
              ) : (
                scenicRuns.map((run, i) => renderRunCard(run, i))
              )}
            </ScrollView>
          </>
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
                <View style={styles.fullScreenInfo}>
                  <Text style={styles.fullScreenMarker}>
                    {fullScreenPhoto.distance_marker_km}K mark
                  </Text>
                  {fullScreenPhoto.caption && (
                    <Text style={styles.fullScreenCaption}>{fullScreenPhoto.caption}</Text>
                  )}
                </View>
                <Text style={styles.fullScreenHint}>Tap anywhere to close</Text>
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtnWrap: {
    paddingTop: 6,
  },
  closeBtn: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Run cards — immersive album style
  runCard: {
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    height: CARD_HEIGHT,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  coverPlaceholder: {
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPlaceholderEmoji: {
    fontSize: 48,
    opacity: 0.4,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radius.xl,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  photoBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  photoBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  cardBottomRow: {},
  cardDate: {
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDistance: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#fff',
  },
  cardDivider: {
    fontSize: typography.sizes.md,
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: 8,
  },
  cardPace: {
    fontSize: typography.sizes.md,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.weights.medium,
  },
  cardTime: {
    fontSize: typography.sizes.md,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: typography.weights.medium,
  },

  // Journey view
  journeyContainer: {
    flex: 1,
  },
  journeyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  backBtnText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  journeyHeaderInfo: {
    flex: 1,
  },
  journeyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  journeySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  journeyScroll: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Timeline
  timeline: {
    paddingLeft: 8,
  },
  timelineNode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textLight + '60',
    marginRight: spacing.md,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  timelineDotStart: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  timelineDotFinish: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  dotEmoji: {
    fontSize: 14,
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
  timelineKmStart: {
    fontSize: typography.sizes.md,
    color: colors.secondary,
    fontWeight: typography.weights.bold,
  },
  timelineKmFinish: {
    fontSize: typography.sizes.md,
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
  timelinePhotoCount: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  timelineLine: {
    width: 2,
    height: 16,
    backgroundColor: colors.textLight + '30',
    marginLeft: 4,
    marginVertical: 2,
  },
  timelineLineActive: {
    backgroundColor: colors.primary + '40',
  },
  timelinePhoto: {
    marginLeft: 32,
    marginVertical: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  timelineImage: {
    width: SCREEN_WIDTH - 100,
    height: 220,
  },
  captionBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  timelineCaption: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: SCREEN_HEIGHT * 0.12,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyEmoji: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  emptyHint: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyHintText: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    textAlign: 'center',
  },

  // Full-screen photo viewer
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenContent: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  fullScreenImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    borderRadius: radius.md,
  },
  fullScreenInfo: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  fullScreenMarker: {
    color: '#fff',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  fullScreenCaption: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.sizes.md,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  fullScreenHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: typography.sizes.xs,
    marginTop: spacing.xl,
  },
});
