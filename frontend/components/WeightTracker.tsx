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

      {/* Mini Line Chart - Last 7 entries */}
      {showChart && chartData.length > 1 && (
        <View style={styles.miniChart}>
          <Text style={styles.chartTitle}>Weight Trend</Text>
          {(() => {
            const recentData = chartData.slice(-7);
            // Fixed scale from 180 to 210 lbs
            const minWeight = 180;
            const maxWeight = 210;
            const range = maxWeight - minWeight;
            const chartHeight = 60;
            
            return (
              <View style={styles.lineChartContainer}>
                {/* Y-axis labels */}
                <View style={styles.yAxisLabels}>
                  <Text style={styles.yAxisLabel}>{maxWeight}</Text>
                  <Text style={styles.yAxisLabel}>{(minWeight + maxWeight) / 2}</Text>
                  <Text style={styles.yAxisLabel}>{minWeight}</Text>
                </View>
                
                {/* Chart area */}
                <View style={styles.lineChartArea}>
                  {/* Grid lines */}
                  <View style={[styles.gridLine, { top: 0 }]} />
                  <View style={[styles.gridLine, { top: 30 }]} />
                  <View style={[styles.gridLine, { top: 60 }]} />
                  
                  {/* Line connecting dots */}
                  <View style={styles.lineContainer}>
                    {recentData.map((entry, index) => {
                      const y = chartHeight - ((entry.weight - minWeight) / range) * chartHeight;
                      const x = (index / (recentData.length - 1)) * 100;
                      
                      // Draw line segment to next point
                      if (index < recentData.length - 1) {
                        const nextEntry = recentData[index + 1];
                        const nextY = chartHeight - ((nextEntry.weight - minWeight) / range) * chartHeight;
                        const nextX = ((index + 1) / (recentData.length - 1)) * 100;
                        const lineLength = Math.sqrt(Math.pow((nextX - x) * 2.5, 2) + Math.pow(nextY - y, 2));
                        const angle = Math.atan2(nextY - y, (nextX - x) * 2.5) * (180 / Math.PI);
                        
                        return (
                          <View
                            key={`line-${index}`}
                            style={[
                              styles.lineSegment,
                              {
                                left: `${x}%`,
                                top: y,
                                width: lineLength,
                                transform: [{ rotate: `${angle}deg` }],
                              }
                            ]}
                          />
                        );
                      }
                      return null;
                    })}
                  </View>
                  
                  {/* Dots with labels */}
                  {recentData.map((entry, index) => {
                    const y = chartHeight - ((entry.weight - minWeight) / range) * chartHeight;
                    const x = (index / (recentData.length - 1)) * 100;
                    const isLast = index === recentData.length - 1;
                    
                    return (
                      <View
                        key={`dot-${index}`}
                        style={[
                          styles.chartDotContainer,
                          {
                            left: `${x}%`,
                            top: y - 5,
                          }
                        ]}
                      >
                        {/* Weight label above dot */}
                        <Text style={[
                          styles.dotLabel,
                          isLast && styles.dotLabelLast
                        ]}>
                          {entry.weight.toFixed(0)}
                        </Text>
                        {/* Dot */}
                        <View
                          style={[
                            styles.chartDot,
                            {
                              backgroundColor: isLast ? colors.secondary : colors.primary,
                              width: isLast ? 10 : 6,
                              height: isLast ? 10 : 6,
                            }
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
                
                {/* X-axis labels */}
                <View style={styles.xAxisLabels}>
                  {recentData.map((entry, index) => (
                    <Text key={index} style={styles.xAxisLabel}>
                      {entry.label.split(' ')[1]}
                    </Text>
                  ))}
                </View>
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
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  chartTitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  lineChartContainer: {
    flexDirection: 'row',
  },
  yAxisLabels: {
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
    height: 60,
  },
  yAxisLabel: {
    fontSize: 9,
    color: colors.textLight,
  },
  lineChartArea: {
    flex: 1,
    height: 60,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.background,
  },
  lineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
    backgroundColor: colors.primary,
    transformOrigin: 'left center',
  },
  chartDotContainer: {
    position: 'absolute',
    alignItems: 'center',
    marginLeft: -15,
    width: 30,
  },
  dotLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginBottom: 2,
  },
  dotLabelLast: {
    color: colors.secondary,
    fontWeight: typography.weights.bold,
    fontSize: 10,
  },
  chartDot: {
    borderRadius: 6,
  },
  xAxisLabels: {
    position: 'absolute',
    bottom: -16,
    left: 30,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xAxisLabel: {
    fontSize: 9,
    color: colors.textLight,
    textAlign: 'center',
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
