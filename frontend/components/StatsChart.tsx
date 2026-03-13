import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
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
  const [chartWidth, setChartWidth] = React.useState(0);
  const maxKm = Math.max(...data.map(d => d.totalKm), 1);
  const maxPaceSeconds = Math.max(...data.map(d => d.avgPaceSeconds), 1);
  const minPaceSeconds = Math.min(
    ...data.filter(d => d.avgPaceSeconds > 0).map(d => d.avgPaceSeconds),
    maxPaceSeconds
  );

  const chartHeight = 180;
  const barAreaHeight = chartHeight - 20;
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

  const getPaceY = (paceSeconds: number): number => {
    if (paceSeconds === 0) return barAreaHeight;
    const range = maxPaceSeconds - minPaceSeconds;
    if (range === 0) return barAreaHeight / 2;
    const normalized = (paceSeconds - minPaceSeconds) / range;
    return 10 + normalized * (barMaxHeight - 20);
  };

  const onChartLayout = (e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  };

  const paceLinePoints = React.useMemo(() => {
    if (chartWidth === 0 || data.length === 0) return [];
    const colWidth = chartWidth / data.length;
    return data
      .map((point, i) => {
        if (point.avgPaceSeconds <= 0) return null;
        const x = colWidth * i + colWidth / 2;
        const y = getPaceY(point.avgPaceSeconds);
        return { x, y };
      })
      .filter(Boolean) as { x: number; y: number }[];
  }, [chartWidth, data, minPaceSeconds, maxPaceSeconds]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

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

      <View style={styles.chartContainer}>
        <View style={styles.yAxisLeft}>
          <Text style={styles.axisLabel}>{maxKm.toFixed(0)}</Text>
          <Text style={styles.axisLabel}>{(maxKm / 2).toFixed(0)}</Text>
          <Text style={styles.axisLabel}>0</Text>
        </View>

        <View style={[styles.chart, { height: chartHeight }]} onLayout={onChartLayout}>
          <View style={styles.barsContainer}>
            {data.map((point, index) => {
              const barHeight = getBarHeight(point.totalKm);
              const isWeekly = title.toLowerCase().includes('week');
              const runLabel = isWeekly ? `${point.numRuns}` : `${point.numRuns} runs`;
              return (
                <View key={index} style={styles.barColumn}>
                  <View style={[styles.kmBadge, { bottom: barHeight + 24 }]}>
                    <Text style={styles.kmBadgeText}>
                      {point.totalKm > 0 ? point.totalKm.toFixed(0) : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: point.totalKm > 0 ? colors.primary : colors.textLight,
                        opacity: point.totalKm > 0 ? 1 : 0.3,
                      },
                    ]}
                  >
                    {point.numRuns > 0 && barHeight > 18 && (
                      <Text style={styles.barInsideText}>{runLabel}</Text>
                    )}
                  </View>
                  <Text style={styles.xLabel}>{point.shortLabel}</Text>
                </View>
              );
            })}
          </View>

          {chartWidth > 0 && paceLinePoints.length > 0 && (
            <Svg
              style={StyleSheet.absoluteFill}
              width={chartWidth}
              height={chartHeight}
              pointerEvents="none"
            >
              {paceLinePoints.length > 1 && (
                <Polyline
                  points={paceLinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={colors.secondary}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {paceLinePoints.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={colors.secondary}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              ))}
            </Svg>
          )}
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
  },
  yAxisRight: {
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  barInsideText: {
    fontSize: 9,
    fontWeight: typography.weights.semibold,
    color: '#fff',
  },
  kmBadge: {
    position: 'absolute',
    zIndex: 10,
  },
  kmBadgeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  xLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
