import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../theme/colors';

interface ChartDataPoint {
  label: string;
  shortLabel: string;
  totalKm: number;
  avgPace: string;
  avgPaceSeconds: number;
  numRuns: number;
}

interface StatsChartProps {
  data: ChartDataPoint[];
  title: string;
}

export function StatsChart({ data, title }: StatsChartProps) {
  const maxKm = Math.max(...data.map(d => d.totalKm), 1);
  const maxPaceSeconds = Math.max(...data.map(d => d.avgPaceSeconds), 1);
  const minPaceSeconds = Math.min(
    ...data.filter(d => d.avgPaceSeconds > 0).map(d => d.avgPaceSeconds),
    maxPaceSeconds
  );

  const chartHeight = 180;
  const barMaxHeight = chartHeight - 40;

  const totalKm = data.reduce((sum, d) => sum + d.totalKm, 0);
  const totalRuns = data.reduce((sum, d) => sum + d.numRuns, 0);
  const pacePoints = data.filter(d => d.avgPaceSeconds > 0);
  const avgPaceSeconds = pacePoints.length > 0
    ? pacePoints.reduce((sum, d) => sum + d.avgPaceSeconds, 0) / pacePoints.length
    : 0;
  const avgPaceMins = Math.floor(avgPaceSeconds / 60);
  const avgPaceSecs = Math.round(avgPaceSeconds % 60);
  const avgPaceStr = avgPaceSeconds > 0 ? `${avgPaceMins}:${avgPaceSecs.toString().padStart(2, '0')}` : '--';

  const getBarHeight = (km: number) => {
    if (maxKm === 0) return 0;
    return (km / maxKm) * barMaxHeight;
  };

  const getLineY = (paceSeconds: number) => {
    if (paceSeconds === 0) return chartHeight;
    const range = maxPaceSeconds - minPaceSeconds;
    if (range === 0) return chartHeight / 2;
    const normalized = (paceSeconds - minPaceSeconds) / range;
    return chartHeight - 20 - ((1 - normalized) * (barMaxHeight - 20));
  };

  const getLineBottom = (paceSeconds: number) => {
    return chartHeight - getLineY(paceSeconds) - 4;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {/* Summary header */}
      <View style={styles.summaryHeader}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {totalKm.toFixed(1)} km{' '}
            <Text style={styles.summarySecondary}>({totalRuns} runs)</Text>
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {avgPaceStr}{' '}
            <Text style={styles.summarySecondary}>avg pace</Text>
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Total KM</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.secondary }]} />
          <Text style={styles.legendText}>Avg Pace</Text>
        </View>
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <View style={styles.yAxisLeft}>
          <Text style={styles.axisLabel}>{maxKm.toFixed(0)}</Text>
          <Text style={styles.axisLabel}>{(maxKm / 2).toFixed(0)}</Text>
          <Text style={styles.axisLabel}>0</Text>
        </View>

        <View style={[styles.chart, { height: chartHeight }]}>
          <View style={styles.barsContainer}>
            {data.map((point, index) => {
              const barHeight = getBarHeight(point.totalKm);
              const prevPoint = index > 0 ? data[index - 1] : null;
              const hasPace = point.avgPaceSeconds > 0;
              const prevHasPace = prevPoint && prevPoint.avgPaceSeconds > 0;

              return (
                <View key={index} style={styles.barColumn}>
                  {/* Run count on bar */}
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
                      },
                    ]}
                  />

                  {/* Pace line dot + connecting line */}
                  {hasPace && (
                    <View
                      style={[
                        styles.linePoint,
                        { bottom: getLineBottom(point.avgPaceSeconds) },
                      ]}
                    >
                      <View style={styles.lineDot} />
                    </View>
                  )}

                  {/* Line segment connecting to previous point */}
                  {hasPace && prevHasPace && (
                    <View
                      style={[
                        styles.lineSegment,
                        getLineSegmentStyle(
                          getLineBottom(prevPoint!.avgPaceSeconds),
                          getLineBottom(point.avgPaceSeconds),
                          chartHeight
                        ),
                      ]}
                    />
                  )}

                  <Text style={styles.xLabel}>{point.shortLabel}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.yAxisRight}>
          <Text style={styles.axisLabel}>Fast</Text>
          <Text style={styles.axisLabel}></Text>
          <Text style={styles.axisLabel}>Slow</Text>
        </View>
      </View>
    </View>
  );
}

function getLineSegmentStyle(prevBottom: number, currBottom: number, chartHeight: number) {
  const midBottom = (prevBottom + currBottom) / 2;
  const height = Math.abs(prevBottom - currBottom) || 2;
  return {
    position: 'absolute' as const,
    left: '-50%',
    width: '100%',
    bottom: midBottom + 4 - height / 2,
    height: Math.max(height, 2),
    backgroundColor: colors.secondary,
    opacity: 0.6,
    borderRadius: 1,
    transform: [{ rotate: prevBottom > currBottom ? `${Math.atan2(prevBottom - currBottom, 40) * (180 / Math.PI)}deg` : `${-Math.atan2(currBottom - prevBottom, 40) * (180 / Math.PI)}deg` }],
  };
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
    marginBottom: spacing.xs,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  summaryItem: {},
  summaryValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  summarySecondary: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    color: colors.textSecondary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
    marginRight: spacing.xs,
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
  lineSegment: {},
  xLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    position: 'absolute',
    bottom: 0,
  },
});
