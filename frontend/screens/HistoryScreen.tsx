/**
 * 📜 HISTORY SCREEN
 * ==================
 * 
 * View all your past runs with filtering options.
 * Tap a run to edit it!
 * 
 * 🎓 LEARNING NOTES:
 * - FlatList is better than ScrollView for long lists
 * - We implement filtering with state
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { RunHistoryCard } from '../components/RunHistoryCard';
import { EditRunModal } from '../components/EditRunModal';
import { MonthInReview } from '../components/MonthInReview';
import { runApi, statsApi, type Run, type MonthInReview as MonthInReviewType } from '../services/api';

const RUN_TYPES = ['all', '3k', '5k', '10k', '15k', '18k', '21k'];

interface HistoryScreenProps {
  navigation: any;
}

// Generate available months (from Jan 2026 to current month)
const getAvailableMonths = () => {
  const months: { month: number; year: number; label: string }[] = [];
  const now = new Date();
  const startYear = 2026;
  const startMonth = 1; // January
  
  for (let year = startYear; year <= now.getFullYear(); year++) {
    const endMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const start = year === startYear ? startMonth : 1;
    
    for (let month = start; month <= endMonth; month++) {
      const date = new Date(year, month - 1, 1);
      months.push({
        month,
        year,
        label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      });
    }
  }
  
  return months.reverse(); // Most recent first
};

export function HistoryScreen({ navigation }: HistoryScreenProps) {
  // 📊 State
  const [runs, setRuns] = useState<Run[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // ✏️ Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  
  // 📅 Month in Review state
  const [monthReviewData, setMonthReviewData] = useState<MonthInReviewType | null>(null);
  const [showMonthReview, setShowMonthReview] = useState(false);
  const availableMonths = getAvailableMonths();
  
  // 📅 Fetch month review for a specific month
  const fetchMonthReview = async (month: number, year: number) => {
    try {
      const data = await statsApi.getMonthReview(month, year);
      if (data) {
        // Force should_show to true when explicitly requested
        setMonthReviewData({ ...data, should_show: true });
        setShowMonthReview(true);
      }
    } catch (error) {
      console.error('Failed to fetch month review:', error);
    }
  };
  
  // 📡 Fetch runs
  const fetchRuns = useCallback(async () => {
    try {
      const params = filter === 'all' ? {} : { run_type: filter };
      const data = await runApi.getAll(params);
      setRuns(data);
    } catch (error) {
      console.error('Failed to fetch runs:', error);
      setRuns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);
  
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);
  
  // 🔄 Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchRuns();
    }, [fetchRuns])
  );
  
  // 🔄 Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchRuns();
  };
  
  // ✏️ Handle run tap for editing
  const handleRunPress = (run: Run) => {
    setSelectedRun(run);
    setEditModalVisible(true);
  };
  
  // 💾 Save edited run
  const handleSaveRun = async (id: number, data: { run_type?: string; duration_seconds?: number; notes?: string; category?: string }) => {
    await runApi.update(id, data);
    fetchRuns(); // Refresh the list
  };
  
  // 🗑️ Delete run
  const handleDeleteRun = async (id: number) => {
    await runApi.delete(id);
    fetchRuns(); // Refresh the list
  };
  
  // 📊 Calculate stats for filtered runs
  const totalDistance = runs.reduce((sum, run) => sum + run.distance_km, 0);
  const totalTime = runs.reduce((sum, run) => sum + run.duration_seconds, 0);
  const avgPace = totalDistance > 0 
    ? Math.floor((totalTime / totalDistance) / 60) + ':' + 
      Math.floor((totalTime / totalDistance) % 60).toString().padStart(2, '0')
    : '0:00';
  
  // 🎨 Render filter button
  const renderFilterButton = (type: string) => {
    const isActive = filter === type;
    const label = type === 'all' ? 'All' : type.toUpperCase();
    const bgColor = type === 'all' 
      ? (isActive ? colors.text : colors.surface)
      : (isActive ? colors.runTypes[type] : colors.surface);
    
    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.filterButton,
          { backgroundColor: bgColor },
          !isActive && styles.filterButtonInactive,
        ]}
        onPress={() => setFilter(type)}
      >
        <Text style={[
          styles.filterButtonText,
          { color: isActive ? colors.textOnPrimary : colors.textSecondary }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };
  
  // 📄 Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🏃</Text>
      <Text style={styles.emptyTitle}>No runs yet</Text>
      <Text style={styles.emptyText}>
        {filter === 'all' 
          ? 'Complete your first run to see it here!'
          : `No ${filter.toUpperCase()} runs recorded yet`
        }
      </Text>
    </View>
  );
  
  // 📋 Render header
  const renderHeader = () => (
    <View style={styles.statsBar}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{runs.length}</Text>
        <Text style={styles.statLabel}>Runs</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
        <Text style={styles.statLabel}>KM</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{avgPace}</Text>
        <Text style={styles.statLabel}>Avg Pace</Text>
      </View>
    </View>
  );
  
  return (
    <SafeAreaView style={styles.container}>
      {/* 📋 Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Run History</Text>
            <Text style={styles.subtitle}>Tap a run to edit</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddRun')}
          >
            <Text style={styles.addButtonText}>+ Add Past Run</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* 📅 Month in Review Section */}
      <View style={styles.monthReviewSection}>
        <Text style={styles.monthReviewTitle}>📅 Month in Review</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthScrollContent}
        >
          {availableMonths.map(({ month, year, label }) => (
            <TouchableOpacity
              key={`${year}-${month}`}
              style={[styles.monthChip, shadows.small]}
              onPress={() => fetchMonthReview(month, year)}
            >
              <Text style={styles.monthChipText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* 🔍 Filters */}
      <View style={styles.filterContainer}>
        {RUN_TYPES.map(renderFilterButton)}
      </View>
      
      {/* 📊 Stats */}
      {renderHeader()}
      
      {/* 📜 Run List */}
      <FlatList
        data={runs}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <RunHistoryCard 
            run={item} 
            onPress={() => handleRunPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />
      
      {/* ✏️ Edit Modal */}
      <EditRunModal
        visible={editModalVisible}
        run={selectedRun}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedRun(null);
        }}
        onSave={handleSaveRun}
        onDelete={handleDeleteRun}
      />
      
      {/* 📅 Month in Review Modal */}
      {monthReviewData && showMonthReview && (
        <MonthInReview
          data={monthReviewData}
          onDismiss={() => setShowMonthReview(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  // Month in Review section
  monthReviewSection: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  monthReviewTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  monthScrollContent: {
    paddingHorizontal: spacing.lg,
  },
  monthChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginRight: spacing.sm,
  },
  monthChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  addButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  filterButtonInactive: {
    borderWidth: 1,
    borderColor: colors.textLight,
  },
  filterButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
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
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
