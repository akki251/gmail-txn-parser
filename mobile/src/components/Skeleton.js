import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../theme/colors';

export const Skeleton = ({ width, height, borderRadius = 8, style }) => {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width !== undefined ? width : '100%',
          height: height !== undefined ? height : 16,
          borderRadius,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
};

export const TransactionItemSkeleton = () => {
  return (
    <View style={styles.txnCard}>
      {/* Top Row */}
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <Skeleton width={48} height={18} borderRadius={5} />
          <Skeleton width={52} height={18} borderRadius={5} style={{ marginLeft: 8 }} />
        </View>
        <Skeleton width={70} height={20} borderRadius={6} />
      </View>

      {/* Middle Row */}
      <View style={[styles.rowBetween, { marginVertical: 10 }]}>
        <Skeleton width="55%" height={16} borderRadius={4} />
        <Skeleton width={50} height={14} borderRadius={4} />
      </View>

      {/* Bottom Row */}
      <View style={styles.rowBetween}>
        <Skeleton width={90} height={20} borderRadius={6} />
        <Skeleton width={65} height={20} borderRadius={6} />
      </View>
    </View>
  );
};

export const MetricCardSkeleton = ({ style }) => {
  return (
    <View style={[styles.metricCard, style]}>
      <View style={styles.rowBetween}>
        <Skeleton width={60} height={12} borderRadius={4} />
        <Skeleton width={22} height={22} borderRadius={6} />
      </View>
      <Skeleton width="75%" height={24} borderRadius={6} style={{ marginVertical: 8 }} />
      <Skeleton width={90} height={14} borderRadius={4} />
    </View>
  );
};

export const ChartSkeleton = () => {
  return (
    <View style={styles.chartCard}>
      <View style={styles.rowBetween}>
        <View style={{ gap: 6 }}>
          <Skeleton width={110} height={12} borderRadius={4} />
          <Skeleton width={140} height={14} borderRadius={4} />
        </View>
        <Skeleton width={65} height={20} borderRadius={6} />
      </View>
      <View style={styles.chartArea}>
        <Skeleton width="100%" height={100} borderRadius={10} />
      </View>
      <View style={styles.rowBetween}>
        <Skeleton width={30} height={10} borderRadius={3} />
        <Skeleton width={40} height={10} borderRadius={3} />
        <Skeleton width={30} height={10} borderRadius={3} />
      </View>
    </View>
  );
};

export const CategoryRowSkeleton = () => {
  return (
    <View style={{ gap: 6, marginVertical: 4 }}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <Skeleton width={10} height={10} borderRadius={5} />
          <Skeleton width={100} height={14} borderRadius={4} style={{ marginLeft: 8 }} />
        </View>
        <Skeleton width={55} height={14} borderRadius={4} />
      </View>
      <Skeleton width="100%" height={6} borderRadius={3} />
    </View>
  );
};

export const LedgerRowSkeleton = () => {
  return (
    <View style={styles.ledgerRow}>
      <View style={styles.row}>
        <Skeleton width={38} height={38} borderRadius={12} />
        <View style={{ marginLeft: 12, gap: 4 }}>
          <Skeleton width={90} height={16} borderRadius={4} />
          <Skeleton width={50} height={12} borderRadius={4} />
        </View>
      </View>
      <View style={styles.row}>
        <Skeleton width={65} height={18} borderRadius={4} style={{ marginRight: 10 }} />
        <Skeleton width={55} height={28} borderRadius={8} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txnCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 14,
    marginVertical: 4,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartArea: {
    marginVertical: 14,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
});
