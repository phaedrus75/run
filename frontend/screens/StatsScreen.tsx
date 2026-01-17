/**
 * 📊 STATS SCREEN
 * ================
 * 
 * Detailed statistics with weekly and monthly chart views.
 * Only shows data from 2026 onwards.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { StatCard, StatsChart, PaceTrendChart } from '../components';
import { 
  runApi, 
  statsApi, 
  type Run, 
  type Stats,
} from '../services/api';

type ViewMode = 'week' | 'month' | 'all';

// Only show data from 2026 onwards
const MIN_YEAR = 2026;

export function StatsScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [stats, setStats] = useState<Stats | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 📡 Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [statsData, runsData] = await Promise.all([
        statsApi.get(),
        runApi.getAll({ limit: 1000 }),
      ]);
      setStats(statsData);
      
      // Filter runs to only include 2026+
      const filteredRuns = runsData.filter(run => {
        const runDate = new Date(run.completed_at);
        return runDate.getFullYear() >= MIN_YEAR;
      });
      setRuns(filteredRuns);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // 📅 Get week boundaries (Sunday-Saturday)
  const getWeekBoundaries = (weeksAgo: number = 0) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek - (weeksAgo * 7));
    sunday.setHours(0, 0, 0, 0);
    
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    saturday.setHours(23, 59, 59, 999);
    
    return { start: sunday, end: saturday };
  };

  // 📅 Get month boundaries
  const getMonthBoundaries = (monthsAgo: number = 0) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    
    // Skip if before 2026
    if (start.getFullYear() < MIN_YEAR) {
      return null;
    }
    
    const end = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };

  // 📊 Filter runs by date range
  const filterRunsByRange = (start: Date, end: Date) => {
    return runs.filter(run => {
      const runDate = new Date(run.completed_at);
      return runDate >= start && runDate <= end;
    });
  };

  // 📊 Calculate stats for a set of runs
  const calculateStats = (filteredRuns: Run[]) => {
    const totalRuns = filteredRuns.length;
    const totalKm = filteredRuns.reduce((sum, r) => sum + r.distance_km, 0);
    const totalSeconds = filteredRuns.reduce((sum, r) => sum + r.duration_seconds, 0);
    
    // Calculate average pace in seconds per km
    const avgPaceSeconds = totalKm > 0 ? totalSeconds / totalKm : 0;
    const avgPace = totalKm > 0 
      ? Math.floor(avgPaceSeconds / 60) + ':' + 
        Math.floor(avgPaceSeconds % 60).toString().padStart(2, '0')
      : '0:00';

    // Count by run type
    const byType: Record<string, number> = {};
    filteredRuns.forEach(run => {
      byType[run.run_type] = (byType[run.run_type] || 0) + 1;
    });

    return { totalRuns, totalKm, avgPace, avgPaceSeconds, byType };
  };

  // 📊 Get weekly chart data (last 8 weeks)
  const getWeeklyChartData = () => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const { start, end } = getWeekBoundaries(i);
      
      // Skip if before 2026
      if (start.getFullYear() < MIN_YEAR) continue;
      
      const weekRuns = filterRunsByRange(start, end);
      const stats = calculateStats(weekRuns);
      
      const shortLabel = `${start.getMonth() + 1}/${start.getDate()}`;
      const label = i === 0 ? 'This Week' : `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      
      weeks.push({
        label,
        shortLabel,
        totalKm: stats.totalKm,
        avgPace: stats.avgPace,
        avgPaceSeconds: stats.avgPaceSeconds,
        numRuns: stats.totalRuns,
      });
    }
    return weeks;
  };

  // 📊 Get monthly chart data (last 12 months, but only 2026+)
  const getMonthlyChartData = () => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const boundaries = getMonthBoundaries(i);
      if (!boundaries) continue; // Skip if before 2026
      
      const { start, end } = boundaries;
      const monthRuns = filterRunsByRange(start, end);
      const stats = calculateStats(monthRuns);
      
      const shortLabel = start.toLocaleDateString('en-US', { month: 'short' });
      const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      months.push({
        label,
        shortLabel,
        totalKm: stats.totalKm,
        avgPace: stats.avgPace,
        avgPaceSeconds: stats.avgPaceSeconds,
        numRuns: stats.totalRuns,
      });
    }
    return months;
  };

  // 🎨 Render view mode tabs
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(['week', 'month', 'all'] as ViewMode[]).map(mode => (
        <TouchableOpacity
          key={mode}
          style={[styles.tab, viewMode === mode && styles.tabActive]}
          onPress={() => setViewMode(mode)}
        >
          <Text style={[styles.tabText, viewMode === mode && styles.tabTextActive]}>
            {mode === 'week' ? 'Weekly' : mode === 'month' ? 'Monthly' : 'All Time'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // 📊 Render weekly view with chart
  const renderWeeklyView = () => {
    const chartData = getWeeklyChartData();
    
    // Calculate totals for summary
    const totalKm = chartData.reduce((sum, d) => sum + d.totalKm, 0);
    const totalRuns = chartData.reduce((sum, d) => sum + d.numRuns, 0);
    
    return (
      <View>
        {/* Summary */}
        <View style={[styles.summaryRow, shadows.small]}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalRuns}</Text>
            <Text style={styles.summaryLabel}>Total Runs</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalKm.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>Total KM</Text>
          </View>
        </View>
        
        {/* Chart */}
        <StatsChart 
          data={chartData} 
          title="Last 8 Weeks (2026+)" 
        />
        
        {/* Pace Trend */}
        <PaceTrendChart 
          data={chartData.map(d => ({
            label: d.shortLabel,
            avgPaceSeconds: d.avgPaceSeconds,
            numRuns: d.numRuns,
          }))}
          title="📈 Pace Trend"
        />
        
        {/* Weekly Details */}
        <Text style={styles.sectionTitle}>Week Details</Text>
        {chartData.slice().reverse().slice(0, 4).map((week, index) => (
          <View key={index} style={[styles.detailCard, shadows.small]}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{week.label}</Text>
              <Text style={styles.detailBadge}>{week.numRuns} runs</Text>
            </View>
            <View style={styles.detailStats}>
              <Text style={styles.detailStat}>
                <Text style={styles.detailValue}>{week.totalKm.toFixed(1)}</Text> km
              </Text>
              <Text style={styles.detailStat}>
                <Text style={styles.detailValue}>{week.avgPace}</Text> avg pace
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // 📊 Render monthly view with chart
  const renderMonthlyView = () => {
    const chartData = getMonthlyChartData();
    
    // Calculate totals
    const totalKm = chartData.reduce((sum, d) => sum + d.totalKm, 0);
    const totalRuns = chartData.reduce((sum, d) => sum + d.numRuns, 0);
    
    return (
      <View>
        {/* Summary */}
        <View style={[styles.summaryRow, shadows.small]}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalRuns}</Text>
            <Text style={styles.summaryLabel}>Total Runs</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalKm.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>Total KM</Text>
          </View>
        </View>
        
        {/* Chart */}
        <StatsChart 
          data={chartData} 
          title="Monthly Overview (2026+)" 
        />
        
        {/* Monthly Details */}
        <Text style={styles.sectionTitle}>Month Details</Text>
        {chartData.slice().reverse().slice(0, 6).map((month, index) => (
          <View key={index} style={[styles.detailCard, shadows.small]}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{month.label}</Text>
              <Text style={styles.detailBadge}>{month.numRuns} runs</Text>
            </View>
            <View style={styles.detailStats}>
              <Text style={styles.detailStat}>
                <Text style={styles.detailValue}>{month.totalKm.toFixed(1)}</Text> km
              </Text>
              <Text style={styles.detailStat}>
                <Text style={styles.detailValue}>{month.avgPace}</Text> avg pace
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // 📊 Render all time view (consistent with weekly/monthly)
  const renderAllTimeView = () => {
    const allStats = calculateStats(runs);
    
    // Build "all time" chart data by aggregating all runs
    const chartData = [{
      label: 'All Time',
      shortLabel: '2026',
      totalKm: allStats.totalKm,
      avgPace: allStats.avgPace,
      avgPaceSeconds: allStats.avgPaceSeconds,
      numRuns: allStats.totalRuns,
    }];
    
    return (
      <View>
        {/* Summary */}
        <View style={[styles.summaryRow, shadows.small]}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{runs.length}</Text>
            <Text style={styles.summaryLabel}>Total Runs</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{allStats.totalKm.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>Total KM</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{allStats.avgPace}</Text>
            <Text style={styles.summaryLabel}>Avg Pace</Text>
          </View>
        </View>
        
        {/* Run Type Breakdown */}
        <Text style={styles.sectionTitle}>Runs by Distance</Text>
        <View style={styles.typeGrid}>
          {['3k', '5k', '10k', '15k', '20k'].map(type => {
            const count = allStats.byType[type] || 0;
            const totalForType = count * (
              type === '3k' ? 3 : type === '5k' ? 5 : type === '10k' ? 10 : type === '15k' ? 15 : 20
            );
            return (
              <View key={type} style={[styles.typeCard, shadows.small]}>
                <View style={[styles.typeIcon, { backgroundColor: colors.runTypes[type] }]}>
                  <Text style={styles.typeIconText}>{type.toUpperCase()}</Text>
                </View>
                <Text style={styles.typeCount}>{count}</Text>
                <Text style={styles.typeLabel}>runs</Text>
                <Text style={styles.typeKm}>{totalForType} km</Text>
              </View>
            );
          })}
        </View>
        
        {/* All Time Details */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={[styles.detailCard, shadows.small]}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>2026 Progress</Text>
            <Text style={styles.detailBadge}>{runs.length} runs</Text>
          </View>
          <View style={styles.detailStats}>
            <Text style={styles.detailStat}>
              <Text style={styles.detailValue}>{allStats.totalKm.toFixed(1)}</Text> km total
            </Text>
            <Text style={styles.detailStat}>
              <Text style={styles.detailValue}>{allStats.avgPace}</Text> avg pace
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>📊 Loading stats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Statistics</Text>
          <Text style={styles.subtitle}>Data from 2026 onwards</Text>
        </View>

        {/* Tabs */}
        {renderTabs()}

        {/* Content */}
        {viewMode === 'week' && renderWeeklyView()}
        {viewMode === 'month' && renderMonthlyView()}
        {viewMode === 'all' && renderAllTimeView()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textOnPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.textLight,
    marginHorizontal: spacing.md,
  },
  summaryValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  detailBadge: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  detailStats: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  detailStat: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  detailValue: {
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: spacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: spacing.xs / 2,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  typeIconText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  typeCount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  typeLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  typeKm: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 2,
  },
});
