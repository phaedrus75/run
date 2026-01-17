/**
 * 📊 STATS CHART COMPONENT
 * =========================
 * 
 * A custom chart showing:
 * - Total KM as bars (left axis)
 * - Average pace as a line (right axis)
 * - Number of runs as labels
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../theme/colors';

interface ChartDataPoint {
  label: string;
  shortLabel: string;
  totalKm: number;
  avgPace: string;  // "5:30" format
  avgPaceSeconds: number;  // For scaling
  numRuns: number;
}

interface StatsChartProps {
  data: ChartDataPoint[];
  title: string;
}

export function StatsChart({ data, title }: StatsChartProps) {
  // Find max values for scaling
  const maxKm = Math.max(...data.map(d => d.totalKm), 1);
  const maxPaceSeconds = Math.max(...data.map(d => d.avgPaceSeconds), 1);
  const minPaceSeconds = Math.min(...data.filter(d => d.avgPaceSeconds > 0).map(d => d.avgPaceSeconds), maxPaceSeconds);
  
  const chartHeight = 180;
  const barMaxHeight = chartHeight - 40; // Leave room for labels
  
  // Calculate bar height based on km
  const getBarHeight = (km: number) => {
    if (maxKm === 0) return 0;
    return (km / maxKm) * barMaxHeight;
  };
  
  // Calculate line Y position based on pace (inverted - faster pace = higher)
  const getLineY = (paceSeconds: number) => {
    if (paceSeconds === 0) return chartHeight;
    // Normalize between min and max pace
    const range = maxPaceSeconds - minPaceSeconds;
    if (range === 0) return chartHeight / 2;
    const normalized = (paceSeconds - minPaceSeconds) / range;
    // Invert so faster (lower seconds) is higher on chart
    return chartHeight - 20 - ((1 - normalized) * (barMaxHeight - 20));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Total KM</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.secondary }]} />
          <Text style={styles.legendText}>Avg Pace (min/km)</Text>
        </View>
      </View>
      
      {/* Chart */}
      <View style={styles.chartContainer}>
        {/* Y-Axis Labels - KM */}
        <View style={styles.yAxisLeft}>
          <Text style={styles.axisLabel}>{maxKm.toFixed(0)}</Text>
          <Text style={styles.axisLabel}>{(maxKm / 2).toFixed(0)}</Text>
          <Text style={styles.axisLabel}>0</Text>
        </View>
        
        {/* Chart Area */}
        <View style={[styles.chart, { height: chartHeight }]}>
          {/* Bars and Line Points */}
          <View style={styles.barsContainer}>
            {data.map((point, index) => {
              const barHeight = getBarHeight(point.totalKm);
              const lineY = getLineY(point.avgPaceSeconds);
              
              return (
                <View key={index} style={styles.barColumn}>
                  {/* Number of runs label */}
                  <View style={[styles.runCountBadge, { bottom: barHeight + 5 }]}>
                    <Text style={styles.runCountText}>
                      {point.numRuns > 0 ? point.numRuns : ''}
                    </Text>
                  </View>
                  
                  {/* Bar */}
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        height: barHeight,
                        backgroundColor: point.totalKm > 0 ? colors.primary : colors.textLight,
                        opacity: point.totalKm > 0 ? 1 : 0.3,
                      }
                    ]} 
                  />
                  
                  {/* Line point */}
                  {point.avgPaceSeconds > 0 && (
                    <View 
                      style={[
                        styles.linePoint,
                        { bottom: chartHeight - lineY - 6 }
                      ]}
                    >
                      <View style={styles.lineDot} />
                      <Text style={styles.paceLabel}>{point.avgPace}</Text>
                    </View>
                  )}
                  
                  {/* X-Axis Label */}
                  <Text style={styles.xLabel}>{point.shortLabel}</Text>
                </View>
              );
            })}
          </View>
          
          {/* Connect line points */}
          <View style={styles.lineContainer}>
            {data.map((point, index) => {
              if (index === 0 || point.avgPaceSeconds === 0) return null;
              const prevPoint = data[index - 1];
              if (prevPoint.avgPaceSeconds === 0) return null;
              
              const y1 = getLineY(prevPoint.avgPaceSeconds);
              const y2 = getLineY(point.avgPaceSeconds);
              const barWidth = 100 / data.length;
              
              // Simple line connector (using a rotated view)
              const dx = barWidth;
              const dy = y2 - y1;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              
              return (
                <View
                  key={`line-${index}`}
                  style={[
                    styles.lineSegment,
                    {
                      left: `${(index - 0.5) * barWidth}%`,
                      bottom: chartHeight - Math.max(y1, y2) - 3,
                      width: `${barWidth}%`,
                      height: Math.abs(dy) + 2,
                    }
                  ]}
                />
              );
            })}
          </View>
        </View>
        
        {/* Y-Axis Labels - Pace */}
        <View style={styles.yAxisRight}>
          <Text style={styles.axisLabel}>Fast</Text>
          <Text style={styles.axisLabel}></Text>
          <Text style={styles.axisLabel}>Slow</Text>
        </View>
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
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  yAxisLeft: {
    width: 30,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  yAxisRight: {
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textLight,
  },
  chart: {
    flex: 1,
    position: 'relative',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 20,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  bar: {
    width: '60%',
    borderRadius: radius.sm,
    minHeight: 2,
  },
  runCountBadge: {
    position: 'absolute',
    zIndex: 10,
  },
  runCountText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  linePoint: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 5,
  },
  lineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  paceLabel: {
    fontSize: 8,
    color: colors.secondary,
    marginTop: 2,
  },
  lineContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 20,
  },
  lineSegment: {
    position: 'absolute',
    backgroundColor: colors.secondary,
    opacity: 0.5,
  },
  xLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    position: 'absolute',
    bottom: 0,
  },
});
