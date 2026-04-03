import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import {
  runApi,
  statsApi,
  stepsApi,
  photoApi,
  type Run,
  type MonthInReview as MonthReviewData,
  type StepsSummary,
  type ScenicRun,
} from '../services/api';
import { typography, spacing, radius } from '../theme/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const QUARTER_MONTHS: Record<number, number[]> = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4',
};

const SLIDE_GRADIENTS: [string, string][] = [
  ['#E8756F', '#E8D5A3'],   // sunset - title
  ['#7BAFA6', '#A89BD0'],   // ocean - distance
  ['#E8756F', '#C9907A'],   // warmth - breakdown
  ['#7BAFA6', '#9DC5BE'],   // secondary - pace
  ['#E8756F', '#F09A95'],   // primary - consistency
  ['#3D3D3D', '#5E9990'],   // dark - steps
  ['#2C2C2C', '#4A4A4A'],   // dark charcoal - photos
  ['#E8756F', '#E8D5A3'],   // sunset - summary
];

interface QuarterInReviewProps {
  visible: boolean;
  quarter: number;
  year: number;
  onClose: () => void;
}

interface QuarterData {
  totalRuns: number;
  totalKm: number;
  totalDuration: number;
  outdoorRuns: number;
  treadmillRuns: number;
  avgPace: string;
  bestStreak: number;
  activeDays: number;
  favoriteDay: string;
  prsSet: number;
  runsByType: Record<string, number>;
  goalPercent: number;
  goalKm: number;
  goalAchievedKm: number;
  stepDays15k: number;
  stepDays20k: number;
  stepDays25k: number;
  stepDays30k: number;
  totalStepDays: number;
  hasSteps: boolean;
  monthNames: string[];
  scenicRuns: ScenicRun[];
  rhythmWeeksHit: number;
  rhythmWeeksTotal: number;
}

const DISTANCE_COMPARISONS = [
  { km: 5, text: 'a trip to the nearest coffee shop and back' },
  { km: 20, text: 'crossing Manhattan end to end' },
  { km: 42, text: 'a full marathon' },
  { km: 100, text: 'the length of the Panama Canal' },
  { km: 200, text: 'driving from London to Paris' },
  { km: 400, text: 'the length of the Suez Canal' },
  { km: 800, text: 'the distance from NYC to Chicago (by air)' },
  { km: 1500, text: 'flying from LA to Mexico City' },
];

function getDistanceComparison(km: number): string {
  for (let i = DISTANCE_COMPARISONS.length - 1; i >= 0; i--) {
    if (km >= DISTANCE_COMPARISONS[i].km) {
      const times = Math.round(km / DISTANCE_COMPARISONS[i].km);
      if (times === 1) return `That's roughly ${DISTANCE_COMPARISONS[i].text}`;
      return `That's like ${DISTANCE_COMPARISONS[i].text} — ${times}x over`;
    }
  }
  return 'Every kilometer counts';
}

function getDayName(dayIndex: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
}

export function QuarterInReview({ visible, quarter, year, onClose }: QuarterInReviewProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuarterData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnims = useRef<Animated.Value[]>([]);

  const fetchQuarterData = useCallback(async () => {
    setLoading(true);
    setCurrentSlide(0);
    try {
      const months = QUARTER_MONTHS[quarter];
      const [m1, m2, m3, allRuns, stepsSummary, allScenicRuns] = await Promise.all([
        statsApi.getMonthReview(months[0], year).catch(() => null),
        statsApi.getMonthReview(months[1], year).catch(() => null),
        statsApi.getMonthReview(months[2], year).catch(() => null),
        runApi.getAll({ limit: 2000 }).catch(() => []),
        stepsApi.getSummary().catch(() => null),
        photoApi.getScenicRuns().catch(() => [] as ScenicRun[]),
      ]);

      const reviews = [m1, m2, m3].filter(Boolean) as MonthReviewData[];
      const monthNames = reviews.map(r => r.month_name);

      const qStart = new Date(year, months[0] - 1, 1);
      const qEnd = new Date(year, months[2], 0, 23, 59, 59);
      const quarterRuns = allRuns.filter((r: Run) => {
        const d = new Date(r.completed_at);
        return d >= qStart && d <= qEnd;
      });

      const quarterScenicRuns = allScenicRuns.filter((r: ScenicRun) => {
        if (!r.completed_at || !r.cover_photo) return false;
        const d = new Date(r.completed_at);
        return d >= qStart && d <= qEnd;
      });

      const totalRuns = quarterRuns.length;
      const totalKm = quarterRuns.reduce((s: number, r: Run) => s + r.distance_km, 0);
      const totalDuration = quarterRuns.reduce((s: number, r: Run) => s + r.duration_seconds, 0);
      const outdoorRuns = quarterRuns.filter((r: Run) => (r.category || 'outdoor') === 'outdoor').length;
      const treadmillRuns = totalRuns - outdoorRuns;

      const avgPaceSeconds = totalKm > 0 ? totalDuration / totalKm : 0;
      const avgPace = totalKm > 0
        ? `${Math.floor(avgPaceSeconds / 60)}:${Math.floor(avgPaceSeconds % 60).toString().padStart(2, '0')}`
        : '0:00';

      const runsByType: Record<string, number> = {};
      quarterRuns.forEach((r: Run) => {
        runsByType[r.run_type] = (runsByType[r.run_type] || 0) + 1;
      });

      // Best streak & active days
      const bestStreak = Math.max(0, ...reviews.map(r => r.best_streak_in_month || 0));
      const runDates = new Set(quarterRuns.map((r: Run) => new Date(r.completed_at).toDateString()));
      const activeDays = runDates.size;

      // Favorite day of week
      const dayCounts = [0, 0, 0, 0, 0, 0, 0];
      quarterRuns.forEach((r: Run) => {
        dayCounts[new Date(r.completed_at).getDay()]++;
      });
      const maxDayCount = Math.max(...dayCounts);
      const favoriteDay = maxDayCount > 0 ? getDayName(dayCounts.indexOf(maxDayCount)) : 'N/A';

      // PRs set
      let prsSet = 0;
      try {
        const records = await statsApi.getPersonalRecords();
        if (records) {
          Object.values(records).forEach((rec: any) => {
            if (rec && rec.date) {
              const recDate = new Date(rec.date);
              if (recDate >= qStart && recDate <= qEnd) prsSet++;
            }
          });
        }
      } catch {}

      // Goals
      const goalKm = reviews.reduce((s, r) => s + (r.monthly_km_goal || 0), 0);
      const goalAchievedKm = reviews.reduce((s, r) => s + (r.monthly_km_achieved || 0), 0);
      const goalPercent = goalKm > 0 ? (goalAchievedKm / goalKm) * 100 : 0;

      const rhythmWeeksHit = reviews.reduce((s, r) => s + (r.rhythm_weeks_hit || 0), 0);
      const rhythmWeeksTotal = reviews.reduce((s, r) => s + (r.rhythm_weeks_total || 0), 0);

      // Steps
      const monthKeys = months.map(m => {
        const d = new Date(year, m - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      });
      const history = stepsSummary?.monthly_history || [];
      const quarterStepMonths = history.filter(h => monthKeys.some(k => h.month.includes(k.split(' ')[0])));
      const stepDays15k = quarterStepMonths.reduce((s, m) => s + m.days_15k, 0);
      const stepDays20k = quarterStepMonths.reduce((s, m) => s + m.days_20k, 0);
      const stepDays25k = quarterStepMonths.reduce((s, m) => s + m.days_25k, 0);
      const stepDays30k = quarterStepMonths.reduce((s, m) => s + (m.days_30k || 0), 0);
      const totalStepDays = stepDays15k;
      const hasSteps = !!user?.beta_steps_enabled && totalStepDays > 0;

      setData({
        totalRuns, totalKm, totalDuration,
        outdoorRuns, treadmillRuns,
        avgPace, bestStreak, activeDays, favoriteDay,
        prsSet, runsByType, goalPercent, goalKm, goalAchievedKm,
        stepDays15k, stepDays20k, stepDays25k, stepDays30k,
        totalStepDays, hasSteps, monthNames,
        scenicRuns: quarterScenicRuns,
        rhythmWeeksHit, rhythmWeeksTotal,
      });
    } catch (err) {
      console.error('Quarter review fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [quarter, year, user]);

  useEffect(() => {
    if (visible) fetchQuarterData();
  }, [visible, fetchQuarterData]);

  const slides = buildSlides(data, quarter, year);

  // Initialize fade anims
  if (fadeAnims.current.length !== slides.length) {
    fadeAnims.current = slides.map(() => new Animated.Value(0));
  }

  useEffect(() => {
    if (!loading && data) {
      fadeAnims.current[0]?.setValue(0);
      Animated.timing(fadeAnims.current[0], {
        toValue: 1, duration: 600, useNativeDriver: true,
      }).start();
    }
  }, [loading, data]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      setCurrentSlide(idx);
      const anim = fadeAnims.current[idx];
      if (anim) {
        anim.setValue(0);
        Animated.timing(anim, {
          toValue: 1, duration: 500, useNativeDriver: true,
        }).start();
      }
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = ({ item, index }: { item: SlideData; index: number }) => {
    const fadeAnim = fadeAnims.current[index] || new Animated.Value(1);
    return (
      <LinearGradient
        colors={item.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.slide}
      >
        <Animated.View style={[s.slideContent, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
          {item.render()}
        </Animated.View>
      </LinearGradient>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={s.container}>
        {loading ? (
          <LinearGradient colors={SLIDE_GRADIENTS[0]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={s.loadingText}>Building your quarter...</Text>
          </LinearGradient>
        ) : (
          <>
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
            {/* Close button */}
            <TouchableOpacity style={s.closeButton} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <View style={s.closeBg}>
                <Ionicons name="close" size={22} color="#fff" />
              </View>
            </TouchableOpacity>
            {/* Dots */}
            <View style={s.dotsContainer}>
              {slides.map((_, i) => (
                <View key={i} style={[s.dot, currentSlide === i && s.dotActive]} />
              ))}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ——————————————————————————————
// Slide Data Builder
// ——————————————————————————————

interface SlideData {
  gradient: [string, string];
  render: () => React.ReactNode;
}

function buildSlides(data: QuarterData | null, quarter: number, year: number): SlideData[] {
  if (!data) return [{ gradient: SLIDE_GRADIENTS[0], render: () => null }];

  const slides: SlideData[] = [];

  // 1 — Title
  slides.push({
    gradient: SLIDE_GRADIENTS[0],
    render: () => (
      <View style={s.centered}>
        <Text style={s.titleSmall}>{year}</Text>
        <Text style={s.heroNumber}>{QUARTER_LABELS[quarter]}</Text>
        <View style={s.divider} />
        <Text style={s.subtitle}>Your Quarter in Review</Text>
        {data.monthNames.length > 0 && (
          <Text style={s.monthRange}>{data.monthNames.join(' · ')}</Text>
        )}
        <Text style={s.swipeHint}>Swipe to explore →</Text>
      </View>
    ),
  });

  // 2 — Total Distance
  slides.push({
    gradient: SLIDE_GRADIENTS[1],
    render: () => (
      <View style={s.centered}>
        <Text style={s.slideLabel}>You covered</Text>
        <Text style={s.megaNumber}>{Math.round(data.totalKm)}</Text>
        <Text style={s.unitLabel}>kilometers</Text>
        <View style={s.divider} />
        <Text style={s.comparison}>{getDistanceComparison(data.totalKm)}</Text>
        {data.goalPercent > 0 && (
          <View style={s.pillRow}>
            <View style={s.pill}>
              <Text style={s.pillText}>{Math.round(data.goalPercent)}% of goal</Text>
            </View>
          </View>
        )}
      </View>
    ),
  });

  // 3 — Run Breakdown
  slides.push({
    gradient: SLIDE_GRADIENTS[2],
    render: () => {
      const topTypes = Object.entries(data.runsByType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      return (
        <View style={s.centered}>
          <Text style={s.slideLabel}>You logged</Text>
          <Text style={s.megaNumber}>{data.totalRuns}</Text>
          <Text style={s.unitLabel}>runs</Text>
          <View style={s.divider} />
          <View style={s.splitRow}>
            <View style={s.splitItem}>
              <Text style={s.splitValue}>{data.outdoorRuns}</Text>
              <Text style={s.splitLabel}>🌳 Outdoor</Text>
            </View>
            <View style={s.splitSep} />
            <View style={s.splitItem}>
              <Text style={s.splitValue}>{data.treadmillRuns}</Text>
              <Text style={s.splitLabel}>🏃 Treadmill</Text>
            </View>
          </View>
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

  // 4 — Pace & PRs
  slides.push({
    gradient: SLIDE_GRADIENTS[3],
    render: () => (
      <View style={s.centered}>
        <Text style={s.slideLabel}>Your average pace</Text>
        <Text style={s.megaNumber}>{data.avgPace}</Text>
        <Text style={s.unitLabel}>min/km</Text>
        <View style={s.divider} />
        {data.prsSet > 0 ? (
          <>
            <Text style={s.heroStat}>{data.prsSet}</Text>
            <Text style={s.heroStatLabel}>personal records set</Text>
          </>
        ) : (
          <Text style={s.comparison}>Keep pushing — PRs are around the corner</Text>
        )}
        <View style={s.pillRow}>
          <View style={s.pill}>
            <Text style={s.pillText}>
              {Math.floor(data.totalDuration / 3600)}h {Math.floor((data.totalDuration % 3600) / 60)}m total
            </Text>
          </View>
        </View>
      </View>
    ),
  });

  // 5 — Consistency
  slides.push({
    gradient: SLIDE_GRADIENTS[4],
    render: () => (
      <View style={s.centered}>
        <Text style={s.slideLabel}>Your rhythm</Text>
        <Text style={s.megaNumber}>{data.rhythmWeeksHit}/{data.rhythmWeeksTotal}</Text>
        <Text style={s.unitLabel}>rhythm weeks hit</Text>
        <View style={s.divider} />
        <View style={s.splitRow}>
          <View style={s.splitItem}>
            <Text style={s.splitValue}>{data.bestStreak}</Text>
            <Text style={s.splitLabel}>Day Run Streak</Text>
          </View>
          <View style={s.splitSep} />
          <View style={s.splitItem}>
            <Text style={s.splitValue}>{data.activeDays}</Text>
            <Text style={s.splitLabel}>Active Days</Text>
          </View>
          <View style={s.splitSep} />
          <View style={s.splitItem}>
            <Text style={s.splitValue}>{data.favoriteDay.slice(0, 3)}</Text>
            <Text style={s.splitLabel}>Top Day</Text>
          </View>
        </View>
        {data.activeDays > 0 && (
          <Text style={s.comparison}>
            You ran {Math.round((data.activeDays / 90) * 100)}% of the quarter
          </Text>
        )}
      </View>
    ),
  });

  // 6 — Steps (conditional)
  if (data.hasSteps) {
    slides.push({
      gradient: SLIDE_GRADIENTS[5],
      render: () => (
        <View style={s.centered}>
          <Text style={s.slideLabel}>High step days</Text>
          <Text style={s.megaNumber}>{data.totalStepDays}</Text>
          <Text style={s.unitLabel}>days at 15k+ steps</Text>
          <View style={s.divider} />
          <View style={s.stepsGrid}>
            {[
              { label: '15K+', value: data.stepDays15k - data.stepDays20k, emoji: '🚶' },
              { label: '20K+', value: data.stepDays20k - data.stepDays25k, emoji: '🏃' },
              { label: '25K+', value: data.stepDays25k - data.stepDays30k, emoji: '🔥' },
              { label: '30K+', value: data.stepDays30k, emoji: '🏔️' },
            ].filter(s => s.value > 0).map(item => (
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

  // Scenic Photos slide (conditional)
  if (data.scenicRuns.length > 0) {
    slides.push({
      gradient: SLIDE_GRADIENTS[6],
      render: () => (
        <View style={s.centered}>
          <Text style={s.slideLabel}>Scenic moments</Text>
          <Text style={s.megaNumber}>{data.scenicRuns.length}</Text>
          <Text style={s.unitLabel}>run{data.scenicRuns.length !== 1 ? 's' : ''} with photos</Text>
          <View style={s.divider} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.photoScroll}
            style={s.photoScrollView}
          >
            {data.scenicRuns.map(run => (
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

  // Summary
  slides.push({
    gradient: SLIDE_GRADIENTS[7],
    render: () => (
      <View style={s.centered}>
        <Text style={s.titleSmall}>{QUARTER_LABELS[quarter]} {year} — Wrapped</Text>
        <View style={s.summaryGrid}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{Math.round(data.totalKm)}</Text>
            <Text style={s.summaryLabel}>km</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{data.totalRuns}</Text>
            <Text style={s.summaryLabel}>runs</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{data.bestStreak}</Text>
            <Text style={s.summaryLabel}>streak</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{data.prsSet}</Text>
            <Text style={s.summaryLabel}>PRs</Text>
          </View>
        </View>
        <View style={s.divider} />
        <Text style={s.avgPaceSmall}>{data.avgPace} avg pace · {data.activeDays} active days</Text>
        {data.goalPercent > 0 && (
          <View style={s.pill}>
            <Text style={s.pillText}>{Math.round(data.goalPercent)}% of quarterly goal</Text>
          </View>
        )}
        <Text style={[s.comparison, { marginTop: spacing.xl }]}>See you next quarter 🏃</Text>
      </View>
    ),
  });

  return slides;
}

// ——————————————————————————————
// Styles
// ——————————————————————————————

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#ffffffcc', fontSize: typography.sizes.md, marginTop: spacing.md },
  slide: { width: SCREEN_W, height: SCREEN_H },
  slideContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: 80 },
  centered: { alignItems: 'center' },

  closeButton: { position: 'absolute', top: 56, right: spacing.lg, zIndex: 10 },
  closeBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },

  dotsContainer: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff', width: 24 },

  titleSmall: { color: '#ffffffcc', fontSize: typography.sizes.lg, fontWeight: typography.weights.medium, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
  heroNumber: { color: '#fff', fontSize: 96, fontWeight: typography.weights.bold, lineHeight: 104 },
  megaNumber: { color: '#fff', fontSize: 80, fontWeight: typography.weights.bold, lineHeight: 88 },
  subtitle: { color: '#ffffffdd', fontSize: typography.sizes.xl, fontWeight: typography.weights.semibold, marginTop: spacing.sm },
  monthRange: { color: '#ffffff99', fontSize: typography.sizes.md, marginTop: spacing.sm },
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

  heroStat: { color: '#fff', fontSize: typography.sizes.hero, fontWeight: typography.weights.bold },
  heroStatLabel: { color: '#ffffffcc', fontSize: typography.sizes.lg, marginTop: spacing.xs },

  pillRow: { flexDirection: 'row', marginTop: spacing.lg },
  pill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
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
