/**
 * Month + Quarter in review — opened from the drawer (not home banners).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { statsApi, type MonthInReview as MonthInReviewType } from '../services/api';
import { MonthInReview } from '../components/MonthInReview';
import { QuarterInReview } from '../components/QuarterInReview';

const getAvailableMonths = () => {
  const months: { month: number; year: number; label: string }[] = [];
  const now = new Date();
  for (let year = 2026; year <= now.getFullYear(); year++) {
    const endMonth = year === now.getFullYear() ? now.getMonth() : 12;
    const start = year === 2026 ? 1 : 1;
    if (endMonth < start) continue;
    for (let month = start; month <= endMonth; month++) {
      months.push({
        month,
        year,
        label: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      });
    }
  }
  return months.reverse();
};

const getAvailableQuarters = () => {
  const now = new Date();
  const quarters: { q: number; year: number; label: string }[] = [];
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  for (let year = 2026; year <= now.getFullYear(); year++) {
    const maxQ = year === now.getFullYear() ? currentQ - 1 : 4;
    for (let q = 1; q <= maxQ; q++) {
      quarters.push({ q, year, label: `Q${q} ${year}` });
    }
  }
  return quarters.reverse();
};

export function ReviewsScreen({ navigation }: { navigation: any }) {
  const [monthReviewData, setMonthReviewData] = useState<MonthInReviewType | null>(null);
  const [showMonthReview, setShowMonthReview] = useState(false);
  const [showQuarterReview, setShowQuarterReview] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(2026);
  const availableMonths = getAvailableMonths();
  const availableQuarters = getAvailableQuarters();

  const fetchMonthReview = async (month: number, year: number) => {
    try {
      const data = await statsApi.getMonthReview(month, year);
      if (data) {
        setMonthReviewData({ ...data, should_show: true });
        setShowMonthReview(true);
      }
    } catch (e) {
      console.error('Month review fetch error', e);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Reviews</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>Pick a month or quarter to open your wrapped summary.</Text>

        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Month in review</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {availableMonths.map(({ month, year, label }) => (
              <TouchableOpacity
                key={`${year}-${month}`}
                style={[styles.chip, shadows.small]}
                onPress={() => fetchMonthReview(month, year)}
              >
                <Text style={styles.chipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {availableQuarters.length > 0 && (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>Quarter in review</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {availableQuarters.map(({ q, year, label }) => (
                <TouchableOpacity
                  key={`${year}-Q${q}`}
                  style={[styles.chip, shadows.small]}
                  onPress={() => {
                    setSelectedQuarter(q);
                    setSelectedQuarterYear(year);
                    setShowQuarterReview(true);
                  }}
                >
                  <Text style={styles.chipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {monthReviewData && showMonthReview && (
        <MonthInReview data={monthReviewData} onDismiss={() => setShowMonthReview(false)} />
      )}

      <QuarterInReview
        visible={showQuarterReview}
        quarter={selectedQuarter}
        year={selectedQuarterYear}
        onClose={() => setShowQuarterReview(false)}
      />
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
  back: { padding: spacing.xs },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  block: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
});
