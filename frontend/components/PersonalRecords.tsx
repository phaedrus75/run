/**
 * 🏆 PERSONAL RECORDS COMPONENT
 * ==============================
 * 
 * Shows fastest times for each distance.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import type { PersonalRecords as PersonalRecordsType } from '../services/api';

interface PersonalRecordsProps {
  records: PersonalRecordsType;
}

export function PersonalRecords({ records }: PersonalRecordsProps) {
  const distances = ['3k', '5k', '10k', '15k', '18k', '21k'];

  return (
    <View style={[styles.container, shadows.small]}>
      <Text style={styles.title}>🏆 Personal Records</Text>
      
      <View style={styles.recordsGrid}>
        {distances.map(distance => {
          const record = records[distance];
          const hasRecord = record !== null;
          
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
    marginBottom: spacing.md,
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
});
