/**
 * ⚖️ WEIGHT TRACKER COMPONENT
 * ============================
 * 
 * Shows weight progress and allows logging new entries.
 * Goal: 209lb → 180lb by end of 2026
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { WeightProgress, WeightChartData } from '../services/api';
import { weightApi } from '../services/api';

interface WeightTrackerProps {
  progress: WeightProgress;
  chartData: WeightChartData[];
  onUpdate: () => void;
  showChart?: boolean;
}

export function WeightTracker({ progress, chartData, onUpdate, showChart = false }: WeightTrackerProps) {
  const [showModal, setShowModal] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveWeight = async () => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0 || weight > 500) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight between 1 and 500 lbs');
      return;
    }

    setSaving(true);
    try {
      await weightApi.create({
        weight_lbs: weight,
        notes: notes || undefined,
      });
      setShowModal(false);
      setNewWeight('');
      setNotes('');
      onUpdate();
    } catch (error) {
      Alert.alert('Error', 'Failed to save weight entry');
    } finally {
      setSaving(false);
    }
  };

  const getTrendEmoji = () => {
    switch (progress.trend) {
      case 'down': return '📉';
      case 'up': return '📈';
      default: return '➡️';
    }
  };

  const getTrendColor = () => {
    switch (progress.trend) {
      case 'down': return colors.success;
      case 'up': return colors.error;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, shadows.small]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚖️ Weight Goal</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowModal(true)}
        >
          <Text style={styles.addButtonText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.goalRow}>
        <Text style={styles.goalLabel}>{progress.start_weight} lb</Text>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${progress.percent_complete}%`,
                  backgroundColor: progress.percent_complete >= 100 ? colors.success : colors.secondary,
                }
              ]} 
            />
          </View>
        </View>
        <Text style={styles.goalLabel}>{progress.goal_weight} lb</Text>
      </View>

      {/* Current Weight */}
      <View style={styles.currentWeight}>
        <View style={styles.weightDisplay}>
          <Text style={styles.weightValue}>{progress.current_weight}</Text>
          <Text style={styles.weightUnit}>lbs</Text>
          <Text style={[styles.trendIndicator, { color: getTrendColor() }]}>
            {getTrendEmoji()}
          </Text>
        </View>
        <Text style={[styles.statusText, { color: progress.on_track ? colors.success : colors.warning }]}>
          {progress.on_track ? '✓ On track!' : 'Keep pushing!'}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {progress.weight_lost > 0 ? '-' : ''}{Math.abs(progress.weight_lost)}
          </Text>
          <Text style={styles.statLabel}>lbs lost</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{progress.weight_to_lose}</Text>
          <Text style={styles.statLabel}>lbs to go</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{progress.percent_complete}%</Text>
          <Text style={styles.statLabel}>complete</Text>
        </View>
      </View>

      {/* Monthly Column Chart */}
      {showChart && chartData.length > 0 && (
        <View style={styles.miniChart}>
          <Text style={styles.chartTitle}>Monthly Average</Text>
          {(() => {
            const monthMap: Record<string, { total: number; count: number }> = {};
            chartData.forEach(entry => {
              const d = new Date(entry.date);
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              if (!monthMap[key]) monthMap[key] = { total: 0, count: 0 };
              monthMap[key].total += entry.weight;
              monthMap[key].count += 1;
            });

            const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const months = Object.keys(monthMap).sort().map(key => {
              const avg = monthMap[key].total / monthMap[key].count;
              const m = parseInt(key.split('-')[1], 10);
              return { key, label: MONTH_LABELS[m - 1], avg: Math.round(avg) };
            });

            if (months.length === 0) return null;

            const allAvgs = months.map(m => m.avg);
            const minW = Math.min(...allAvgs) - 5;
            const maxW = Math.max(...allAvgs) + 5;
            const range = maxW - minW || 1;
            const chartHeight = 100;

            return (
              <View>
                <View style={styles.colChartContainer}>
                  {months.map((month) => {
                    const barH = Math.max(8, ((month.avg - minW) / range) * chartHeight);
                    return (
                      <View key={month.key} style={styles.colChartCol}>
                        <Text style={styles.colChartValue}>{month.avg}</Text>
                        <View style={styles.colChartBarWrap}>
                          <View style={[styles.colChartBar, { height: barH }]} />
                        </View>
                        <Text style={styles.colChartLabel}>{month.label}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.colChartUnit}>avg lbs per month</Text>
              </View>
            );
          })()}
        </View>
      )}

      {/* Add Weight Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚖️ Log Weight</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Weight (lbs)"
              placeholderTextColor={colors.textLight}
              keyboardType="decimal-pad"
              value={newWeight}
              onChangeText={setNewWeight}
              autoFocus
            />
            
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textLight}
              value={notes}
              onChangeText={setNotes}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveWeight}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  addButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  addButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  goalLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    width: 45,
  },
  progressBarContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  progressBar: {
    height: 10,
    backgroundColor: colors.background,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  currentWeight: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weightDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  weightValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  weightUnit: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  trendIndicator: {
    fontSize: typography.sizes.lg,
    marginLeft: spacing.sm,
  },
  statusText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.background,
  },
  statValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.secondary,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  miniChart: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  chartTitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  colChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  colChartCol: {
    alignItems: 'center',
    flex: 1,
  },
  colChartValue: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: 4,
  },
  colChartBarWrap: {
    width: '100%',
    alignItems: 'center',
  },
  colChartBar: {
    width: '70%',
    backgroundColor: colors.secondary,
    borderRadius: 4,
    minHeight: 8,
  },
  colChartLabel: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: 4,
    fontWeight: typography.weights.medium,
  },
  colChartUnit: {
    fontSize: 10,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.lg,
    color: colors.text,
    marginBottom: spacing.md,
  },
  notesInput: {
    fontSize: typography.sizes.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  saveButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
});
