import React, { useState } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { Colors, Radius, Spacing } from '../../theme/tokens';
import { BodyText, Caption } from '../primitives/Text';

const SCREEN_WIDTH = Dimensions.get('window').width - 64; // Account for card padding & margins

export default function HeroSpendingChart({ transactions = [] }) {
  const [selectedIndex, setSelectedIndex] = useState(null);

  // Filter valid spend debits
  const debits = transactions.filter((t) => t.type === 'debit' && !t.notATransaction && t.amount > 0);

  if (debits.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Caption style={{ textAlign: 'center' }}>No spending data recorded yet</Caption>
      </View>
    );
  }

  // Create 7 data points for chart representation
  const chartPoints = debits.slice(-7).map((t, idx) => ({
    x: (SCREEN_WIDTH / 6) * idx,
    amount: t.amount,
    label: t.merchant || 'Bank',
  }));

  const maxAmt = Math.max(...chartPoints.map((p) => p.amount), 1);
  const minAmt = Math.min(...chartPoints.map((p) => p.amount), 0);
  const height = 120;

  // Convert points to SVG Y coordinates
  const normalizedPoints = chartPoints.map((p) => {
    const y = height - ((p.amount - minAmt) / (maxAmt - minAmt || 1)) * (height - 20) - 10;
    return { ...p, y };
  });

  // Construct SVG Path
  let pathD = `M ${normalizedPoints[0].x} ${normalizedPoints[0].y}`;
  for (let i = 1; i < normalizedPoints.length; i++) {
    const prev = normalizedPoints[i - 1];
    const curr = normalizedPoints[i];
    const cx = (prev.x + curr.x) / 2;
    pathD += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const fillD = `${pathD} L ${normalizedPoints[normalizedPoints.length - 1].x} ${height} L ${normalizedPoints[0].x} ${height} Z`;

  const activePoint = selectedIndex !== null ? normalizedPoints[selectedIndex] : normalizedPoints[normalizedPoints.length - 1];

  const handleTouch = (event) => {
    const x = event.nativeEvent.locationX;
    const closestIdx = Math.min(
      normalizedPoints.length - 1,
      Math.max(0, Math.round((x / SCREEN_WIDTH) * (normalizedPoints.length - 1)))
    );
    setSelectedIndex(closestIdx);
  };

  return (
    <View style={styles.card}>
      <View style={styles.chartHeader}>
        <View>
          <Caption color={Colors.accentLight}>Selected Expense</Caption>
          <BodyText bold style={{ fontSize: 20, marginTop: 2 }}>
            ₹{activePoint.amount.toLocaleString('en-IN')}
          </BodyText>
        </View>
        <Caption style={{ alignSelf: 'flex-end' }}>{activePoint.label}</Caption>
      </View>

      <TouchableWithoutFeedback onPressIn={handleTouch} onPressOut={() => setSelectedIndex(null)}>
        <View style={{ height, width: SCREEN_WIDTH, marginTop: 12 }}>
          <Svg width={SCREEN_WIDTH} height={height}>
            <Defs>
              <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={Colors.accent} stopOpacity="0.4" />
                <Stop offset="1" stopColor={Colors.accent} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            <Path d={fillD} fill="url(#chartGrad)" />
            <Path d={pathD} fill="none" stroke={Colors.accentLight} strokeWidth="3" />

            {/* Vertical Guide Line */}
            {activePoint && (
              <Line
                x1={activePoint.x}
                y1={0}
                x2={activePoint.x}
                y2={height}
                stroke={Colors.borderLight}
                strokeWidth="1"
                strokeDasharray="4, 4"
              />
            )}

            {/* Active Point Highlight Circle */}
            {activePoint && (
              <Circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                fill={Colors.accentLight}
                stroke={Colors.background}
                strokeWidth="2"
              />
            )}
          </Svg>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.large,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptyChart: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.large,
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
