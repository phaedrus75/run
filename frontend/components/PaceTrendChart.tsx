/**
 * 📈 PACE TREND CHART
 * ====================
 * 
 * Shows how your average pace has improved over time.
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';

interface PaceDataPoint {
  label: string;
  avgPaceSeconds: number;
  numRuns: number;
}

interface PaceTrendChartProps {
  data: PaceDataPoint[];
  title?: string;
}

export function PaceTrendChart({ data, title = "Pace Trend" }: PaceTrendChartProps) {
  if (data.length < 2) {
    return (
      <View style={[styles.container, shadows.small]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📈</Text>
          <Text style={styles.emptyText}>Need more runs to show trend</Text>
          <Text style={styles.emptyHint}>Keep running to see your pace improve!</Text>
        </View>
      </View>
    );
  }

  // Filter out weeks with no runs
  const validData = data.filter(d => d.numRuns > 0 && d.avgPaceSeconds > 0);
  
  if (validData.length < 2) {
    return (
      <View style={[styles.container, shadows.small]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📈</Text>
          <Text style={styles.emptyText}>Need more data</Text>
        </View>
      </View>
    );
  }

  // Calculate min/max for scaling
  const paces = validData.map(d => d.avgPaceSeconds);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const range = maxPace - minPace || 60; // Default range of 1 min if all same

  // Add padding to range
  const paddedMin = minPace - range * 0.1;
  const paddedMax = maxPace + range * 0.1;
  const paddedRange = paddedMax - paddedMin;

  const chartHeight = 120;
  const chartWidth = Dimensions.get('window').width - (spacing.lg * 2) - (spacing.lg * 2);
  const pointSpacing = chartWidth / (validData.length - 1);

  // Calculate improvement
  const firstPace = validData[0].avgPaceSeconds;
  const lastPace = validData[validData.length - 1].avgPaceSeconds;
  const improvement = firstPace - lastPace;
  const improvementPercent = ((improvement / firstPace) * 100).toFixed(1);
  const isImproved = improvement > 0;

  // Format pace
  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate line path points
  const points = validData.map((d, i) => {
    const x = i * pointSpacing;
    const y = chartHeight - ((d.avgPaceSeconds - paddedMin) / paddedRange) * chartHeight;
    return { x, y, pace: d.avgPaceSeconds, label: d.label };
  });

  return (
    <View style={[styles.container, shadows.small]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.trendBadge, isImproved ? styles.trendUp : styles.trendDown]}>
          <Text style={styles.trendText}>
            {isImproved ? '📉' : '📈'} {isImproved ? '-' : '+'}{Math.abs(Number(improvementPercent))}%
          </Text>
        </View>
      </View>

      {/* Improvement Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>First</Text>
          <Text style={styles.summaryValue}>{formatPace(firstPace)}</Text>
        </View>
        <View style={styles.summaryArrow}>
          <Text style={styles.arrowText}>{isImproved ? '→' : '→'}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Latest</Text>
          <Text style={[styles.summaryValue, isImproved && styles.improvedValue]}>
            {formatPace(lastPace)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Change</Text>
          <Text style={[styles.summaryValue, isImproved ? styles.improvedValue : styles.worseValue]}>
            {isImproved ? '-' : '+'}{formatPace(Math.abs(improvement))}
          </Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.yLabel}>{formatPace(paddedMax)}</Text>
          <Text style={styles.yLabel}>{formatPace((paddedMax + paddedMin) / 2)}</Text>
          <Text style={styles.yLabel}>{formatPace(paddedMin)}</Text>
        </View>

        {/* Chart area */}
        <View style={[styles.chart, { height: chartHeight }]}>
          {/* Grid lines */}
          <View style={[styles.gridLine, { top: 0 }]} />
          <View style={[styles.gridLine, { top: chartHeight / 2 }]} />
          <View style={[styles.gridLine, { top: chartHeight }]} />

          {/* Line connecting points */}
          {points.map((point, i) => {
            if (i === 0) return null;
            const prevPoint = points[i - 1];
            const length = Math.sqrt(
              Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
            );
            const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * (180 / Math.PI);
            
            return (
              <View
                key={`line-${i}`}
                style={[
                  styles.line,
                  {
                    left: prevPoint.x,
                    top: prevPoint.y,
                    width: length,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })}

          {/* Data points */}
          {points.map((point, i) => (
            <View
              key={i}
              style={[
                styles.point,
                {
                  left: point.x - 6,
                  top: point.y - 6,
                  backgroundColor: i === points.length - 1 ? colors.primary : colors.secondary,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* X-axis labels */}
      <View style={styles.xAxis}>
        {validData.map((d, i) => (
          <Text 
            key={i} 
            style={[
              styles.xLabel,
              { left: i * pointSpacing - 15, width: 30 }
            ]}
          >
            {d.label.split(' ')[0]}
          </Text>
        ))}
      </View>

      <Text style={styles.footerNote}>
        Lower pace = faster running • Based on {validData.reduce((sum, d) => sum + d.numRuns, 0)} runs
      </Text>
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
  trendBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.full,
  },
  trendUp: {
    backgroundColor: colors.success + '20',
  },
  trendDown: {
    backgroundColor: colors.error + '20',
  },
  trendText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryArrow: {
    paddingHorizontal: spacing.sm,
  },
  arrowText: {
    fontSize: typography.sizes.xl,
    color: colors.textLight,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  improvedValue: {
    color: colors.success,
  },
  worseValue: {
    color: colors.error,
  },
  chartContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  yAxis: {
    width: 40,
    justifyContent: 'space-between',
    paddingRight: spacing.xs,
  },
  yLabel: {
    fontSize: 10,
    color: colors.textLight,
    textAlign: 'right',
  },
  chart: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.background,
  },
  line: {
    position: 'absolute',
    height: 3,
    backgroundColor: colors.secondary,
    borderRadius: 1.5,
    transformOrigin: 'left center',
  },
  point: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  xAxis: {
    position: 'relative',
    height: 20,
    marginLeft: 40,
  },
  xLabel: {
    position: 'absolute',
    fontSize: 10,
    color: colors.textLight,
    textAlign: 'center',
  },
  footerNote: {
    fontSize: typography.sizes.xs,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  emptyHint: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});
