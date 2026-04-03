import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Animated,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme/colors';
import { MonthInReview as MonthInReviewType, photoApi, type ScenicRun } from '../services/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GRADIENTS: [string, string][] = [
  ['#E8756F', '#E8D5A3'],   // sunset - title
  ['#7BAFA6', '#A89BD0'],   // ocean - distance/goal
  ['#E8756F', '#C9907A'],   // warmth - runs
  ['#7BAFA6', '#9DC5BE'],   // secondary - pace
  ['#E8756F', '#F09A95'],   // primary - rhythm
  ['#3D3D3D', '#5E9990'],   // dark - steps
  ['#4A6670', '#7BAFA6'],   // teal - weight
  ['#2C2C2C', '#4A4A4A'],   // charcoal - photos
  ['#E8756F', '#E8D5A3'],   // sunset - summary
];

interface Props {
  data: MonthInReviewType;
  onDismiss?: () => void;
}

interface SlideData {
  gradient: [string, string];
  render: () => React.ReactNode;
}

export function MonthInReview({ data, onDismiss }: Props) {
  const [showModal, setShowModal] = useState(true);
  const [scenicRuns, setScenicRuns] = useState<ScenicRun[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnims = useRef<Animated.Value[]>([]);

  useEffect(() => {
    if (!data) return;
    photoApi.getScenicRuns().then(runs => {
      const monthStart = new Date(data.year, data.month - 1, 1);
      const monthEnd = new Date(data.year, data.month, 0, 23, 59, 59);
      setScenicRuns(runs.filter(r => {
        if (!r.completed_at || !r.cover_photo) return false;
        const d = new Date(r.completed_at);
        return d >= monthStart && d <= monthEnd;
      }));
    }).catch(() => {});
  }, [data]);

  if (!data || !data.should_show) return null;

  const handleClose = () => {
    setShowModal(false);
    onDismiss?.();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const slides = buildSlides(data, scenicRuns, formatDuration);

  if (fadeAnims.current.length !== slides.length) {
    fadeAnims.current = slides.map(() => new Animated.Value(0));
  }

  const animateSlide = (idx: number) => {
    const anim = fadeAnims.current[idx];
    if (anim) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  };

  // Animate first slide on mount
  if (fadeAnims.current[0]) {
    const first = fadeAnims.current[0];
    if ((first as any).__initialized !== true) {
      (first as any).__initialized = true;
      setTimeout(() => animateSlide(0), 100);
    }
  }

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      setCurrentSlide(idx);
      animateSlide(idx);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = ({ item, index }: { item: SlideData; index: number }) => {
    const fadeAnim = fadeAnims.current[index] || new Animated.Value(1);
    return (
      <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.slide}>
        <Animated.View style={[s.slideContent, {
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
        }]}>
          {item.render()}
        </Animated.View>
      </LinearGradient>
    );
  };

  return (
    <Modal visible={showModal} animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <StatusBar barStyle="light-content" />
      <View style={s.container}>
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          keyExtractor={(_, i) => i.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        />
        <TouchableOpacity style={s.closeButton} onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <View style={s.closeBg}>
            <Ionicons name="close" size={22} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={s.dotsContainer}>
          {slides.map((_, i) => (
            <View key={i} style={[s.dot, currentSlide === i && s.dotActive]} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

function buildSlides(
  data: MonthInReviewType,
  scenicRuns: ScenicRun[],
  formatDuration: (s: number) => string,
): SlideData[] {
  const slides: SlideData[] = [];
  const kmChange = data.km_vs_last_month || 0;
  const runsChange = data.runs_vs_last_month || 0;

  // 1 — Title
  slides.push({
    gradient: GRADIENTS[0],
    render: () => (
      <View style={s.centered}>
        <Text style={s.titleSmall}>{data.year}</Text>
        <Text style={s.heroText}>{data.month_name.split(' ')[0]}</Text>
        <View style={s.divider} />
        <Text style={s.subtitle}>Month in Review</Text>
        <Text style={s.swipeHint}>Swipe to explore →</Text>
      </View>
    ),
  });

  // 2 — Distance & Goal
  slides.push({
    gradient: GRADIENTS[1],
    render: () => (
      <View style={s.centered}>
        <Text style={s.slideLabel}>You covered</Text>
        <Text style={s.megaNumber}>{(data.total_km || 0).toFixed(1)}</Text>
        <Text style={s.unitLabel}>kilometers</Text>
        <View style={s.divider} />
        {kmChange !== 0 && (
          <Text style={s.comparison}>
            {kmChange > 0 ? '📈' : '📉'} {kmChange > 0 ? '+' : ''}{kmChange} km vs last month
          </Text>
        )}
        <View style={s.pillRow}>
          <View style={[s.pill, data.goal_met && s.pillSuccess]}>
            <Text style={s.pillText}>
              {data.goal_met ? '🎉 ' : ''}{data.monthly_km_achieved || 0}/{data.monthly_km_goal || 0} km — {(data.goal_percent || 0).toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>
    ),
  });

  // 3 — Runs
  slides.push({
    gradient: GRADIENTS[2],
    render: () => {
      const topTypes = Object.entries(data.runs_by_type || {})
        .sort((a, b) => b[1] - a[1])
        .filter(([_, c]) => c > 0)
        .slice(0, 5);
      return (
        <View style={s.centered}>
          <Text style={s.slideLabel}>You logged</Text>
          <Text style={s.megaNumber}>{data.total_runs}</Text>
          <Text style={s.unitLabel}>runs</Text>
          <View style={s.divider} />
          <View style={s.splitRow}>
            <View style={s.splitItem}>
              <Text style={s.splitValue}>{data.outdoor_runs}</Text>
              <Text style={s.splitLabel}>🌳 Outdoor</Text>
            </View>
            <View style={s.splitSep} />
            <View style={s.splitItem}>
              <Text style={s.splitValue}>{data.treadmill_runs}</Text>
              <Text style={s.splitLabel}>🏃 Treadmill</Text>
            </View>
          </View>
          {runsChange !== 0 && (
            <Text style={s.comparison}>
              {runsChange > 0 ? '📈' : '📉'} {runsChange > 0 ? '+' : ''}{runsChange} runs vs last month
            </Text>
          )}
          {topTypes.length > 0 && (
            <View style={s.typeRow}>
              {topTypes.map(([type, count]) => (
                <View key={type} style={s.typePill}>
                  <Text style={s.typePillText}>{type.toUpperCase()}</Text>
                  <Text style={s.typePillCount}>×{count}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    },
  });

  // 4 — Pace & Time
  slides.push({
    gradient: GRADIENTS[3],
    render: () => (
      <View style={s.centered}>
        <Text style={s.slideLabel}>Your average pace</Text>
        <Text style={s.megaNumber}>{data.avg_pace}</Text>
        <Text style={s.unitLabel}>min/km</Text>
        <View style={s.divider} />
        <View style={s.pillRow}>
          <View style={s.pill}>
            <Text style={s.pillText}>{formatDuration(data.total_duration_seconds)} total running time</Text>
          </View>
        </View>
      </View>
    ),
  });

  // 5 — Rhythm
  slides.push({
    gradient: GRADIENTS[4],
    render: () => (
      <View style={s.centered}>
        <Text style={s.slideLabel}>Your rhythm</Text>
        <Text style={s.megaNumber}>{data.rhythm_weeks_hit ?? 0}/{data.rhythm_weeks_total ?? 0}</Text>
        <Text style={s.unitLabel}>rhythm weeks hit</Text>
        <View style={s.divider} />
        <View style={s.splitRow}>
          <View style={s.splitItem}>
            <Text style={s.splitValue}>{data.best_streak_in_month}</Text>
            <Text style={s.splitLabel}>Day Run Streak</Text>
          </View>
        </View>
      </View>
    ),
  });

  // 6 — Steps (conditional)
  const hasStepData = (data.days_15k || 0) > 0;
  if (hasStepData) {
    slides.push({
      gradient: GRADIENTS[5],
      render: () => (
        <View style={s.centered}>
          <Text style={s.slideLabel}>High step days</Text>
          <Text style={s.megaNumber}>{data.days_15k || 0}</Text>
          <Text style={s.unitLabel}>days at 15k+ steps</Text>
          <View style={s.divider} />
          <View style={s.stepsGrid}>
            {[
              { label: '15K+', value: (data.days_15k || 0) - (data.days_20k || 0), emoji: '🚶' },
              { label: '20K+', value: (data.days_20k || 0) - (data.days_25k || 0), emoji: '🏃' },
              { label: '25K+', value: (data.days_25k || 0) - (data.days_30k || 0), emoji: '🔥' },
              { label: '30K+', value: data.days_30k || 0, emoji: '🏔️' },
            ].filter(item => item.value > 0).map(item => (
              <View key={item.label} style={s.stepBadge}>
                <Text style={s.stepBadgeEmoji}>{item.emoji}</Text>
                <Text style={s.stepBadgeValue}>{item.value}</Text>
                <Text style={s.stepBadgeLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ),
    });
  }

  // 7 — Weight (conditional)
  if (data.start_weight && data.end_weight) {
    slides.push({
      gradient: GRADIENTS[6],
      render: () => (
        <View style={s.centered}>
          <Text style={s.slideLabel}>Weight</Text>
          <View style={s.splitRow}>
            <View style={s.splitItem}>
              <Text style={s.splitValue}>{data.start_weight?.toFixed(1)}</Text>
              <Text style={s.splitLabel}>Start (lbs)</Text>
            </View>
            <View style={s.splitSep} />
            <View style={s.splitItem}>
              <Text style={s.splitValue}>{data.end_weight?.toFixed(1)}</Text>
              <Text style={s.splitLabel}>End (lbs)</Text>
            </View>
          </View>
          {data.weight_change !== null && (
            <>
              <View style={s.divider} />
              <View style={[s.pill, (data.weight_change || 0) <= 0 ? s.pillSuccess : s.pillWarning]}>
                <Text style={s.pillText}>
                  {(data.weight_change || 0) <= 0 ? '📉' : '📈'} {(data.weight_change || 0) > 0 ? '+' : ''}{(data.weight_change || 0).toFixed(1)} lbs
                </Text>
              </View>
            </>
          )}
        </View>
      ),
    });
  }

  // 8 — Scenic Photos (conditional)
  if (scenicRuns.length > 0) {
    slides.push({
      gradient: GRADIENTS[7],
      render: () => (
        <View style={s.centered}>
          <Text style={s.slideLabel}>Scenic moments</Text>
          <Text style={s.megaNumber}>{scenicRuns.length}</Text>
          <Text style={s.unitLabel}>run{scenicRuns.length !== 1 ? 's' : ''} with photos</Text>
          <View style={s.divider} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.photoScroll}
            style={s.photoScrollView}
          >
            {scenicRuns.map(run => (
              <View key={run.id} style={s.scenicCard}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${run.cover_photo}` }}
                  style={s.scenicImage}
                />
                <View style={s.scenicOverlay}>
                  <Text style={s.scenicType}>{run.run_type.toUpperCase()}</Text>
                  <Text style={s.scenicPace}>{run.pace}/km</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ),
    });
  }

  // 9 — Summary
  slides.push({
    gradient: GRADIENTS[8],
    render: () => (
      <View style={s.centered}>
        <Text style={s.titleSmall}>{data.month_name} — Wrapped</Text>
        <View style={s.summaryGrid}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{(data.total_km || 0).toFixed(0)}</Text>
            <Text style={s.summaryLabel}>km</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{data.total_runs}</Text>
            <Text style={s.summaryLabel}>runs</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{data.rhythm_weeks_hit ?? 0}/{data.rhythm_weeks_total ?? 0}</Text>
            <Text style={s.summaryLabel}>rhythm</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{data.avg_pace}</Text>
            <Text style={s.summaryLabel}>pace</Text>
          </View>
        </View>
        <View style={s.divider} />
        <Text style={s.avgPaceSmall}>
          {formatDuration(data.total_duration_seconds)} total · {data.best_streak_in_month} day streak
        </Text>
        {data.goal_met && (
          <View style={[s.pill, s.pillSuccess]}>
            <Text style={s.pillText}>Goal achieved — {(data.goal_percent || 0).toFixed(0)}%</Text>
          </View>
        )}
        <Text style={[s.comparison, { marginTop: spacing.xl }]}>See you next month 🏃</Text>
      </View>
    ),
  });

  return slides;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: { width: SCREEN_W, height: SCREEN_H },
  slideContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: 80 },
  centered: { alignItems: 'center' },

  closeButton: { position: 'absolute', top: 56, right: spacing.lg, zIndex: 10 },
  closeBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },

  dotsContainer: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff', width: 24 },

  titleSmall: { color: '#ffffffcc', fontSize: typography.sizes.lg, fontWeight: typography.weights.medium, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
  heroText: { color: '#fff', fontSize: 72, fontWeight: typography.weights.bold, lineHeight: 80 },
  megaNumber: { color: '#fff', fontSize: 80, fontWeight: typography.weights.bold, lineHeight: 88 },
  subtitle: { color: '#ffffffdd', fontSize: typography.sizes.xl, fontWeight: typography.weights.semibold, marginTop: spacing.sm },
  swipeHint: { color: '#ffffff66', fontSize: typography.sizes.sm, marginTop: spacing.xxl, fontStyle: 'italic' },

  slideLabel: { color: '#ffffffaa', fontSize: typography.sizes.lg, fontWeight: typography.weights.medium, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.md },
  unitLabel: { color: '#ffffffcc', fontSize: typography.sizes.xl, fontWeight: typography.weights.semibold, marginTop: spacing.xs },
  comparison: { color: '#ffffffbb', fontSize: typography.sizes.md, textAlign: 'center', lineHeight: 24, marginTop: spacing.md, paddingHorizontal: spacing.lg },

  divider: { width: 40, height: 3, backgroundColor: '#ffffff44', borderRadius: 2, marginVertical: spacing.lg },

  splitRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  splitItem: { alignItems: 'center', paddingHorizontal: spacing.xl },
  splitValue: { color: '#fff', fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold },
  splitLabel: { color: '#ffffffaa', fontSize: typography.sizes.sm, marginTop: spacing.xs },
  splitSep: { width: 1, height: 40, backgroundColor: '#ffffff33' },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
  typePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.xs },
  typePillText: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
  typePillCount: { color: '#ffffffcc', fontSize: typography.sizes.sm },

  pillRow: { flexDirection: 'row', marginTop: spacing.lg },
  pill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pillSuccess: { backgroundColor: 'rgba(255,255,255,0.3)' },
  pillWarning: { backgroundColor: 'rgba(255,200,150,0.3)' },
  pillText: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },

  stepsGrid: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  stepBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: spacing.md, minWidth: 70 },
  stepBadgeEmoji: { fontSize: 24 },
  stepBadgeValue: { color: '#fff', fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, marginTop: spacing.xs },
  stepBadgeLabel: { color: '#ffffffaa', fontSize: typography.sizes.xs, marginTop: 2 },

  summaryGrid: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
  summaryItem: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.lg, padding: spacing.md, minWidth: 72 },
  summaryValue: { color: '#fff', fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold },
  summaryLabel: { color: '#ffffffaa', fontSize: typography.sizes.xs, marginTop: 2 },
  avgPaceSmall: { color: '#ffffffaa', fontSize: typography.sizes.sm, marginTop: spacing.md },

  photoScrollView: { maxHeight: 200, marginTop: spacing.sm },
  photoScroll: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  scenicCard: { width: 160, height: 180, borderRadius: radius.lg, overflow: 'hidden' },
  scenicImage: { width: '100%', height: '100%' },
  scenicOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  scenicType: { color: '#fff', fontSize: typography.sizes.xs, fontWeight: typography.weights.bold },
  scenicPace: { color: '#ffffffcc', fontSize: typography.sizes.xs },
});
