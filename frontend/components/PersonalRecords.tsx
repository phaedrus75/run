/**
 * 🏆 PERSONAL RECORDS COMPONENT
 * ==============================
 * 
 * Shows fastest times for each distance with outdoor/treadmill toggle.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { statsApi, type PersonalRecords as PersonalRecordsType } from '../services/api';

type CategoryFilter = 'all' | 'outdoor' | 'treadmill';

interface PersonalRecordsProps {
  records: PersonalRecordsType;
}

export function PersonalRecords({ records: initialRecords }: PersonalRecordsProps) {
  const distances = ['1k', '2k', '3k', '5k', '8k', '10k', '15k', '18k', '21k'];
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [records, setRecords] = useState<PersonalRecordsType>(initialRecords);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  const handleCategoryChange = async (newCategory: CategoryFilter) => {
    if (newCategory === category) return;
    setCategory(newCategory);
    
    if (newCategory === 'all') {
      setRecords(initialRecords);
      return;
    }
    
    setLoading(true);
    try {
      const data = await statsApi.getPersonalRecords(newCategory);
      setRecords(data);
    } catch (e) {
      console.error('Failed to fetch category records:', e);
    } finally {
      setLoading(false);
    }
  };

  const CATEGORIES: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'outdoor', label: 'Outdoor' },
    { key: 'treadmill', label: 'Treadmill' },
  ];

  return (
    <View style={[styles.container, shadows.small]}>
      <Text style={styles.title}>🏆 Personal Records</Text>
      <View style={styles.toggleRow}>
        {CATEGORIES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.toggleBtn, category === key && styles.toggleBtnActive]}
            onPress={() => handleCategoryChange(key)}
          >
            <Text style={[styles.toggleText, category === key && styles.toggleTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={[styles.recordsGrid, loading && { opacity: 0.5 }]}>
        {distances.map(distance => {
          const record = records[distance];
          const hasRecord = record != null;
          
          return (
            <View 
              key={distance} 
              style={[
                styles.recordCard,
                hasRecord && styles.recordCardActive,
              ]}
            >
              <View style={[styles.distanceBadge, { backgroundColor: colors.runTypes[distance] }]}>
                <Text style={styles.distanceText}>{distance.toUpperCase()}</Text>
              </View>
              
              {hasRecord ? (
                <>
                  <Text style={styles.time}>{record.time}</Text>
                  <Text style={styles.pace}>{record.pace}/km</Text>
                  <Text style={styles.date}>{record.date}</Text>
                  <View style={styles.countChip}>
                    <Text style={styles.countText}>{record.run_count} run{record.run_count !== 1 ? 's' : ''}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.noRecord}>No runs yet</Text>
              )}
            </View>
          );
        })}
      </View>
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
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 2,
    marginBottom: spacing.md,
  },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.textOnPrimary,
  },
  recordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recordCard: {
    width: '31%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
    opacity: 0.5,
  },
  recordCardActive: {
    opacity: 1,
    backgroundColor: colors.surfaceAlt,
  },
  distanceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  distanceText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  time: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  pace: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  date: {
    fontSize: 10,
    color: colors.textLight,
    marginTop: spacing.xs / 2,
  },
  noRecord: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  countChip: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary + '18',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.primary + '35',
  },
  countText: {
    fontSize: 9,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
});
