import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, spacing } from '../../design';
import { Caption } from '../primitives/Text';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHART_HEIGHT = 118;
const CHART_WIDTH = Dimensions.get('window').width - (spacing.xl * 2) - 36;

function usableDate(transaction) {
  if (!transaction.date || transaction.date === 'Today') return new Date();
  const date = new Date(transaction.date || transaction.rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function HeroSpendingChart({ transactions = [] }) {
  const reveal = useSharedValue(0);
  const points = useMemo(() => {
    const now = new Date();
    const totals = {};
    transactions
      .filter((item) => item.type === 'debit' && !item.notATransaction && Number(item.amount) > 0)
      .forEach((item) => {
        const date = usableDate(item);
        if (!date || date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return;
        const day = date.getDate();
        totals[day] = (totals[day] || 0) + Number(item.amount);
      });
    let total = 0;
    return Object.keys(totals).map(Number).sort((a, b) => a - b).map((day) => {
      total += totals[day];
      return { day, value: total };
    });
  }, [transactions]);

  const path = useMemo(() => {
    if (!points.length) return null;
    const maxValue = Math.max(...points.map((point) => point.value), 1);
    const usableHeight = CHART_HEIGHT - 32;
    const horizontalSpace = Math.max(CHART_WIDTH - 8, 1);
    const plotted = points.map((point, index) => ({
      ...point,
      x: points.length === 1 ? horizontalSpace / 2 : (horizontalSpace / (points.length - 1)) * index + 4,
      y: CHART_HEIGHT - 21 - ((point.value / maxValue) * usableHeight),
    }));
    const line = plotted.reduce((result, point, index) => `${result}${index === 0 ? 'M' : ' L'} ${point.x} ${point.y}`, '');
    return { plotted, line, fill: `${line} L ${plotted[plotted.length - 1].x} ${CHART_HEIGHT - 13} L ${plotted[0].x} ${CHART_HEIGHT - 13} Z` };
  }, [points]);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [path?.line]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: (1 - reveal.value) * (CHART_WIDTH * 1.5) }));

  if (!path) return <View style={styles.empty}><Caption style={styles.emptyText}>No spending recorded this month</Caption></View>;

  const shownLabels = path.plotted.filter((point, index) => index === 0 || index === path.plotted.length - 1 || index === Math.floor(path.plotted.length / 2));
  return <View style={styles.container} accessible accessibilityLabel="Cumulative spending trend for this month">
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      <Defs><LinearGradient id="spendingFade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#E8E7FF" stopOpacity="0.9" /><Stop offset="1" stopColor="#E8E7FF" stopOpacity="0" /></LinearGradient></Defs>
      <Line x1="0" y1={CHART_HEIGHT - 13} x2={CHART_WIDTH} y2={CHART_HEIGHT - 13} stroke={colors.border} strokeWidth="1" />
      <Line x1="0" y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} stroke={colors.border} strokeWidth="1" strokeDasharray="3 5" />
      <Path d={path.fill} fill="url(#spendingFade)" />
      <AnimatedPath d={path.line} fill="none" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={CHART_WIDTH * 1.5} animatedProps={animatedProps} />
      {path.plotted.length === 1 && <Circle cx={path.plotted[0].x} cy={path.plotted[0].y} r="4" fill={colors.primary} stroke={colors.white} strokeWidth="2" />}
    </Svg>
    <View style={styles.labels}>{shownLabels.map((point) => <Caption key={point.day} style={[styles.label, { left: Math.max(0, Math.min(point.x - 10, CHART_WIDTH - 20)) }]}>{point.day}</Caption>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  container: { height: 142, marginTop: spacing.sm }, empty: { height: 142, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: colors.textMuted, textTransform: 'none', letterSpacing: 0 }, labels: { position: 'absolute', left: 0, right: 0, bottom: 1, height: 16 }, label: { position: 'absolute', color: colors.textMuted, fontSize: 9 },
});
