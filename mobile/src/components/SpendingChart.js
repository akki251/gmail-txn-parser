import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { COLORS } from '../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 72; // Card padding + horizontal insets
const CHART_HEIGHT = 130;

export const SpendingChart = ({ dailySpend = [], daysInMonth = 30, currentDay = 15 }) => {
  // Find max value in dailySpend
  const validValues = dailySpend.filter((v) => v !== null);
  const maxVal = Math.max(...validValues, 100);
  const ceiling = Math.ceil(maxVal * 1.15); // Add headroom

  // Generate SVG path coordinates
  const points = [];
  for (let i = 0; i < dailySpend.length; i++) {
    const val = dailySpend[i];
    if (val === null) break;
    const x = (i / (daysInMonth - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - (val / ceiling) * (CHART_HEIGHT - 20) - 10;
    points.push({ x, y, val, day: i + 1 });
  }

  if (points.length === 0) {
    return (
      <View style={[styles.container, { height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.emptyText}>No spending recorded this month</Text>
      </View>
    );
  }

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    linePath += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x} ${CHART_HEIGHT} L ${points[0].x} ${CHART_HEIGHT} Z`;

  const midDay = Math.round(daysInMonth / 2);

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={styles.svg}>
        <Defs>
          <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.primary} stopOpacity="0.35" />
            <Stop offset="0.8" stopColor={COLORS.primary} stopOpacity="0.03" />
            <Stop offset="1" stopColor={COLORS.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        <Line x1="0" y1="20" x2={CHART_WIDTH} y2="20" stroke={COLORS.borderSubtle} strokeDasharray="4 4" strokeWidth="1" />
        <Line x1="0" y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} stroke={COLORS.borderSubtle} strokeDasharray="4 4" strokeWidth="1" />
        <Line x1="0" y1={CHART_HEIGHT - 1} x2={CHART_WIDTH} y2={CHART_HEIGHT - 1} stroke={COLORS.border} strokeWidth="1" />

        {/* Area fill */}
        <Path d={areaPath} fill="url(#chartGradient)" />

        {/* Curve line */}
        <Path d={linePath} fill="none" stroke={COLORS.primaryLight} strokeWidth="2.5" strokeLinecap="round" />

        {/* Current day pulsing dot */}
        <Circle cx={lastPoint.x} cy={lastPoint.y} r="5" fill={COLORS.primaryLight} stroke={COLORS.bg} strokeWidth="2" />
      </Svg>

      {/* Axis Day Labels */}
      <View style={styles.labelsRow}>
        <Text style={styles.axisLabel}>Day 1</Text>
        <Text style={styles.axisLabel}>Day {midDay}</Text>
        <Text style={styles.axisLabel}>Day {daysInMonth}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 12,
  },
  svg: {
    overflow: 'visible',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  axisLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});
