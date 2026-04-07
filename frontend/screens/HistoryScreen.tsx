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
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme/colors';
import { RunHistoryCard } from '../components/RunHistoryCard';
import { EditRunModal } from '../components/EditRunModal';
import { EditStepModal } from '../components/EditStepModal';
import { MonthInReview } from '../components/MonthInReview';
import { QuarterInReview } from '../components/QuarterInReview';
import { useAuth } from '../contexts/AuthContext';
import { runApi, statsApi, stepsApi, gymApi, type Run, type StepEntry, type MonthInReview as MonthInReviewType, type GymWorkout } from '../services/api';
import { GymTracker } from '../components/GymTracker';
import { EditGymWorkoutModal } from '../components/EditGymWorkoutModal';

const RUN_TYPES = ['all', '3k', '5k', '10k', '15k', '18k', '21k'];
type CategoryFilter = 'all' | 'outdoor' | 'treadmill';

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
    const endMonth = year === now.getFullYear() ? now.getMonth() : 12;
    const start = year === startYear ? startMonth : 1;
    if (endMonth < start) continue;
    
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

type ActiveTab = 'runs' | 'steps' | 'gym';

export function HistoryScreen({ navigation }: HistoryScreenProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('runs');
  const [runs, setRuns] = useState<Run[]>([]);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // ✏️ Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  
  // 👟 Steps state
  const [stepEntries, setStepEntries] = useState<StepEntry[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [editStepModalVisible, setEditStepModalVisible] = useState(false);
  const [selectedStep, setSelectedStep] = useState<StepEntry | null>(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [addStepCount, setAddStepCount] = useState<number | null>(null);
  const [addStepDate, setAddStepDate] = useState(new Date());
  const [addingStep, setAddingStep] = useState(false);
  
  // 🏋️ Gym state
  const [gymWorkouts, setGymWorkouts] = useState<GymWorkout[]>([]);
  const [gymLoading, setGymLoading] = useState(false);
  const [showGymTracker, setShowGymTracker] = useState(false);
  const [editGymModalVisible, setEditGymModalVisible] = useState(false);
  const [selectedGymWorkout, setSelectedGymWorkout] = useState<GymWorkout | null>(null);

  // 📅 Month in Review state
  const [monthReviewData, setMonthReviewData] = useState<MonthInReviewType | null>(null);
  const [showMonthReview, setShowMonthReview] = useState(false);
  const availableMonths = getAvailableMonths();

  // 📊 Quarter in Review state
  const [showQuarterReview, setShowQuarterReview] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(2026);

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
  const availableQuarters = getAvailableQuarters();
  
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
  
  const fetchRuns = useCallback(async () => {
    try {
      const params: { run_type?: string; category?: string } = {};
      if (filter !== 'all') params.run_type = filter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      const data = await runApi.getAll(params);
      setRuns(data);
    } catch (error) {
      console.error('Failed to fetch runs:', error);
      setRuns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, categoryFilter]);
  
  const fetchSteps = useCallback(async () => {
    setStepsLoading(true);
    try {
      const data = await stepsApi.getAll(200);
      setStepEntries(data);
    } catch {
      setStepEntries([]);
    } finally {
      setStepsLoading(false);
    }
  }, []);

  const fetchGymWorkouts = useCallback(async () => {
    setGymLoading(true);
    try {
      const data = await gymApi.getAll(100);
      setGymWorkouts(data);
    } catch {
      setGymWorkouts([]);
    } finally {
      setGymLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    if (activeTab === 'steps') fetchSteps();
    if (activeTab === 'gym') fetchGymWorkouts();
  }, [activeTab, fetchSteps, fetchGymWorkouts]);
  
  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'runs') fetchRuns();
      else if (activeTab === 'steps') fetchSteps();
      else if (activeTab === 'gym') fetchGymWorkouts();
    }, [fetchRuns, fetchSteps, fetchGymWorkouts, activeTab])
  );
  
  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'runs') fetchRuns();
    else if (activeTab === 'steps') fetchSteps().finally(() => setRefreshing(false));
    else if (activeTab === 'gym') fetchGymWorkouts().finally(() => setRefreshing(false));
    else setRefreshing(false);
  };
  
  // ✏️ Handle run tap for editing
  const handleRunPress = (run: Run) => {
    setSelectedRun(run);
    setEditModalVisible(true);
  };
  
  // 💾 Save edited run
  const handleSaveRun = async (id: number, data: { run_type?: string; duration_seconds?: number; notes?: string; category?: string }) => {
    await runApi.update(id, data);
    fetchRuns();
  };
  
  // 🗑️ Delete run
  const handleDeleteRun = async (id: number) => {
    await runApi.delete(id);
    fetchRuns();
  };

  // 👟 Step handlers
  const handleStepPress = (entry: StepEntry) => {
    setSelectedStep(entry);
    setEditStepModalVisible(true);
  };

  const handleSaveStep = async (id: number, data: { step_count: number; recorded_date: string }) => {
    await stepsApi.update(id, data);
    fetchSteps();
  };

  const handleDeleteStep = async (id: number) => {
    await stepsApi.delete(id);
    fetchSteps();
  };

  const handleAddStep = async () => {
    if (!addStepCount) return;
    setAddingStep(true);
    try {
      const dateStr = addStepDate.toISOString().split('T')[0];
      await stepsApi.create({
        step_count: addStepCount,
        recorded_date: `${dateStr}T12:00:00`,
      });
      setShowAddStep(false);
      setAddStepCount(null);
      setAddStepDate(new Date());
      fetchSteps();
    } catch {
      // handled silently
    } finally {
      setAddingStep(false);
    }
  };
  
  // 📊 Calculate stats for filtered runs
  const totalDistance = runs.reduce((sum, run) => sum + run.distance_km, 0);
  const totalTime = runs.reduce((sum, run) => sum + run.duration_seconds, 0);
  const avgPace = totalDistance > 0 
    ? Math.floor((totalTime / totalDistance) / 60) + ':' + 
      Math.floor((totalTime / totalDistance) % 60).toString().padStart(2, '0')
    : '0:00';
  
  const getStepBadgeColor = (count: number) => {
    if (count >= 30000) return '#3D3D3D';
    if (count >= 25000) return colors.success;
    if (count >= 20000) return colors.runTypes['20k'];
    return colors.runTypes['15k'];
  };

  const formatStepDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

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
  
  const showTabs = !!user?.beta_steps_enabled || !!user?.beta_gym_enabled;

  return (
    <SafeAreaView style={styles.container}>
      {/* 📋 Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Activities</Text>
            <Text style={styles.subtitle}>Tap to edit</Text>
          </View>
          {activeTab === 'runs' && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddRun')}
            >
              <Text style={styles.addButtonText}>+ Add Run</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'steps' && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => { setShowAddStep(true); setAddStepCount(null); setAddStepDate(new Date()); }}
            >
              <Text style={styles.addButtonText}>+ Add Steps</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segment Toggle */}
      {showTabs && (
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'runs' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('runs')}
          >
            <Ionicons name="fitness-outline" size={16} color={activeTab === 'runs' ? colors.textOnPrimary : colors.textSecondary} />
            <Text style={[styles.segmentText, activeTab === 'runs' && styles.segmentTextActive]}>Runs</Text>
          </TouchableOpacity>
          {user?.beta_steps_enabled && (
            <TouchableOpacity
              style={[styles.segmentButton, activeTab === 'steps' && styles.segmentButtonActive]}
              onPress={() => setActiveTab('steps')}
            >
              <Ionicons name="footsteps-outline" size={16} color={activeTab === 'steps' ? colors.textOnPrimary : colors.textSecondary} />
              <Text style={[styles.segmentText, activeTab === 'steps' && styles.segmentTextActive]}>Steps</Text>
            </TouchableOpacity>
          )}
          {user?.beta_gym_enabled && (
            <TouchableOpacity
              style={[styles.segmentButton, activeTab === 'gym' && styles.segmentButtonActive]}
              onPress={() => setActiveTab('gym')}
            >
              <Ionicons name="barbell-outline" size={16} color={activeTab === 'gym' ? colors.textOnPrimary : colors.textSecondary} />
              <Text style={[styles.segmentText, activeTab === 'gym' && styles.segmentTextActive]}>Gym</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeTab === 'gym' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {showGymTracker ? (
            <>
              <TouchableOpacity
                style={styles.backToListBtn}
                onPress={() => setShowGymTracker(false)}
              >
                <Ionicons name="arrow-back" size={18} color={colors.primary} />
                <Text style={styles.backToListText}>Back to History</Text>
              </TouchableOpacity>
              <GymTracker onUpdate={() => { fetchGymWorkouts(); setShowGymTracker(false); }} />
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.newWorkoutBtn}
                onPress={() => setShowGymTracker(true)}
              >
                <Ionicons name="add-circle" size={22} color="#fff" />
                <Text style={styles.newWorkoutText}>New Workout</Text>
              </TouchableOpacity>

              {gymLoading ? (
                <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
              ) : gymWorkouts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>🏋️</Text>
                  <Text style={styles.emptyTitle}>No workouts yet</Text>
                  <Text style={styles.emptyText}>Tap "New Workout" to log your first session</Text>
                </View>
              ) : (
                gymWorkouts.map(w => {
                  const date = w.completed_at
                    ? new Date(w.completed_at)
                    : null;
                  const dateStr = date
                    ? date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                    : 'Unknown';
                  const exerciseCount = w.exercises?.length ?? 0;
                  const totalSets = w.exercises?.reduce(
                    (sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0
                  ) ?? 0;

                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.gymWorkoutCard, shadows.small]}
                      onPress={() => { setSelectedGymWorkout(w); setEditGymModalVisible(true); }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.gymWorkoutBadge}>
                        <Ionicons name="barbell" size={20} color="#fff" />
                      </View>
                      <View style={styles.gymWorkoutDetails}>
                        <Text style={styles.gymWorkoutDate}>{dateStr}</Text>
                        <Text style={styles.gymWorkoutMeta}>
                          {exerciseCount} exercises · {totalSets} sets completed
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}

      {activeTab === 'runs' && (
        <>
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

          {/* 📊 Quarter in Review Section */}
          <View style={styles.monthReviewSection}>
            <Text style={styles.monthReviewTitle}>📊 Quarter in Review</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.monthScrollContent}
            >
              {availableQuarters.map(({ q, year: qYear, label }) => (
                <TouchableOpacity
                  key={`${qYear}-Q${q}`}
                  style={[styles.monthChip, shadows.small]}
                  onPress={() => {
                    setSelectedQuarter(q);
                    setSelectedQuarterYear(qYear);
                    setShowQuarterReview(true);
                  }}
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
          
          {/* Category Filter */}
          <View style={styles.categoryFilterContainer}>
            {(['all', 'outdoor', 'treadmill'] as CategoryFilter[]).map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  categoryFilter === cat && styles.categoryChipActive,
                ]}
                onPress={() => setCategoryFilter(cat)}
              >
                <Text style={[
                  styles.categoryChipText,
                  categoryFilter === cat && styles.categoryChipTextActive,
                ]}>
                  {cat === 'all' ? 'All' : cat === 'outdoor' ? '🌳 Outdoor' : '🏋️ Treadmill'}
                </Text>
              </TouchableOpacity>
            ))}
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
        </>
      )}

      {activeTab === 'steps' && (
        <>
          {/* 👟 Steps Stats Bar */}
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stepEntries.length}</Text>
              <Text style={styles.statLabel}>Days</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stepEntries.filter(e => e.step_count >= 20000).length}
              </Text>
              <Text style={styles.statLabel}>20k+</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {stepEntries.length > 0
                  ? `${(Math.max(...stepEntries.map(e => e.step_count)) / 1000).toFixed(0)}k`
                  : '0'}
              </Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
          </View>

          {/* 👟 Step Entries List */}
          <FlatList
            data={stepEntries}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => {
              const badgeColor = getStepBadgeColor(item.step_count);
              const label = `${(item.step_count / 1000).toFixed(0)}k`;
              return (
                <TouchableOpacity
                  style={[styles.stepCard, shadows.small]}
                  onPress={() => handleStepPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.stepBadge, { backgroundColor: badgeColor }]}>
                    <Text style={styles.stepBadgeText}>{label}</Text>
                  </View>
                  <View style={styles.stepDetails}>
                    <Text style={styles.stepCount}>{item.step_count.toLocaleString()} steps</Text>
                    <Text style={styles.stepDate}>{formatStepDate(item.recorded_date)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>👟</Text>
                <Text style={styles.emptyTitle}>No step days logged</Text>
                <Text style={styles.emptyText}>Tap "+ Add Steps" to log a high step day</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
      
      {/* ✏️ Edit Run Modal */}
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

      {/* ✏️ Edit Step Modal */}
      <EditStepModal
        visible={editStepModalVisible}
        entry={selectedStep}
        onClose={() => {
          setEditStepModalVisible(false);
          setSelectedStep(null);
        }}
        onSave={handleSaveStep}
        onDelete={handleDeleteStep}
      />

      {/* ➕ Add Step Modal */}
      {showAddStep && (
        <AddStepInline
          stepCount={addStepCount}
          date={addStepDate}
          saving={addingStep}
          onSelectSteps={setAddStepCount}
          onDateChange={setAddStepDate}
          onSubmit={handleAddStep}
          onClose={() => setShowAddStep(false)}
        />
      )}
      
      {/* 📅 Month in Review Modal */}
      {monthReviewData && showMonthReview && (
        <MonthInReview
          data={monthReviewData}
          onDismiss={() => setShowMonthReview(false)}
        />
      )}

      {/* 📊 Quarter in Review Modal */}
      <QuarterInReview
        visible={showQuarterReview}
        quarter={selectedQuarter}
        year={selectedQuarterYear}
        onClose={() => setShowQuarterReview(false)}
      />

      {/* 🏋️ Edit Gym Workout Modal */}
      <EditGymWorkoutModal
        visible={editGymModalVisible}
        workout={selectedGymWorkout}
        onClose={() => { setEditGymModalVisible(false); setSelectedGymWorkout(null); }}
        onSave={fetchGymWorkouts}
        onDelete={fetchGymWorkouts}
      />
    </SafeAreaView>
  );
}

// ——————————————————————————————
// Inline Add Step Modal
// ——————————————————————————————

const ADD_STEP_OPTIONS = [
  { value: 15000, label: '15k', color: colors.runTypes['15k'] },
  { value: 20000, label: '20k', color: colors.runTypes['20k'] },
  { value: 25000, label: '25k', color: colors.success },
  { value: 30000, label: '30k', color: '#3D3D3D' },
];

function AddStepInline({
  stepCount,
  date,
  saving,
  onSelectSteps,
  onDateChange,
  onSubmit,
  onClose,
}: {
  stepCount: number | null;
  date: Date;
  saving: boolean;
  onSelectSteps: (v: number) => void;
  onDateChange: (d: Date) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={addStyles.container}>
        <View style={addStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={addStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={addStyles.title}>Log High Step Day</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={addStyles.content}>
          <Text style={{ fontSize: 64, marginBottom: spacing.xl }}>👟</Text>

          <Text style={addStyles.label}>Date</Text>
          {Platform.OS === 'ios' ? (
            <View style={addStyles.dateRow}>
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              <DateTimePicker
                value={date}
                mode="date"
                display="compact"
                onChange={(_e, d) => d && onDateChange(d)}
                maximumDate={new Date()}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <>
              <TouchableOpacity style={addStyles.dateRow} onPress={() => setShowPicker(true)}>
                <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                <Text style={{ flex: 1, fontSize: typography.sizes.md, color: colors.text }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              {showPicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(_e, d) => { setShowPicker(false); d && onDateChange(d); }}
                  maximumDate={new Date()}
                />
              )}
            </>
          )}

          <Text style={addStyles.label}>Step Count</Text>
          <View style={addStyles.optionsRow}>
            {ADD_STEP_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  addStyles.optionBtn,
                  stepCount === opt.value && { backgroundColor: opt.color, borderColor: opt.color },
                ]}
                onPress={() => onSelectSteps(opt.value)}
              >
                <Text style={[addStyles.optionLabel, stepCount === opt.value && { color: '#fff' }]}>{opt.label}</Text>
                <Text style={[addStyles.optionSub, stepCount === opt.value && { color: '#ffffffcc' }]}>steps</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[addStyles.submitBtn, (!stepCount || saving) && { opacity: 0.5 }]}
            onPress={onSubmit}
            disabled={!stepCount || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={addStyles.submitText}>
                {stepCount ? `Log ${(stepCount / 1000).toFixed(0)}k Steps` : 'Select Steps'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, paddingTop: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.surface,
  },
  cancelText: { fontSize: typography.sizes.md, color: colors.textSecondary },
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text },
  content: { flex: 1, padding: spacing.lg, alignItems: 'center' },
  label: {
    fontSize: typography.sizes.md, fontWeight: typography.weights.semibold,
    color: colors.text, marginBottom: spacing.md, alignSelf: 'flex-start',
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.md, padding: spacing.md, width: '100%',
    marginBottom: spacing.xl, gap: spacing.sm,
  },
  optionsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md,
    marginBottom: spacing.xl, width: '100%', justifyContent: 'center',
  },
  optionBtn: {
    width: '45%', backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, alignItems: 'center', borderWidth: 2, borderColor: colors.surface,
  },
  optionLabel: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.text },
  optionSub: { fontSize: typography.sizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
  submitBtn: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: radius.md, width: '100%', alignItems: 'center', marginTop: spacing.lg,
  },
  submitText: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.surface },
});

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
  categoryFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textLight,
  },
  categoryChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  categoryChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.textOnPrimary,
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
  // Segment toggle
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  segmentButtonActive: {
    backgroundColor: colors.text,
  },
  segmentText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textOnPrimary,
  },
  // Gym history
  newWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  newWorkoutText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  backToListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  backToListText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  gymWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  gymWorkoutBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gymWorkoutDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  gymWorkoutDate: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  gymWorkoutMeta: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Step cards
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stepBadge: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    color: '#fff',
    fontWeight: typography.weights.bold,
    fontSize: typography.sizes.sm,
  },
  stepDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  stepCount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  stepDate: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
});
