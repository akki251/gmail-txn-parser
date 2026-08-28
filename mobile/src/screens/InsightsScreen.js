import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, getCategoryColor, getBankMeta } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { MetricCard } from '../components/MetricCard';
import { Skeleton, MetricCardSkeleton, CategoryRowSkeleton } from '../components/Skeleton';

export const InsightsScreen = () => {
  const { metrics, isLoading, isSyncing, refreshAll } = useApp();

  const monthName = new Date().toLocaleString('default', { month: 'long' });
  const currentDay = Math.max(metrics.currentDay, 1);
  const dailyAverage = Math.round(metrics.thisMonthSpend / currentDay);
  const projectedMonthSpend = dailyAverage * metrics.daysInCurrentMonth;

  if (isLoading && metrics.categoryBreakdown.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.metricsGrid}>
          <MetricCardSkeleton style={styles.gridCard} />
          <MetricCardSkeleton style={styles.gridCard} />
        </View>

        <View style={styles.section}>
          <Skeleton width={140} height={12} borderRadius={4} style={{ marginHorizontal: 4 }} />
          <View style={styles.card}>
            <CategoryRowSkeleton />
            <CategoryRowSkeleton />
            <CategoryRowSkeleton />
            <CategoryRowSkeleton />
          </View>
        </View>

        <View style={styles.section}>
          <Skeleton width={160} height={12} borderRadius={4} style={{ marginHorizontal: 4 }} />
          <View style={styles.card}>
            <CategoryRowSkeleton />
            <CategoryRowSkeleton />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isSyncing}
          onRefresh={() => refreshAll()}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Overview Cards */}
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Daily Burn Rate"
          value={`₹${dailyAverage.toLocaleString('en-IN')}`}
          subtitle="Avg spend per day"
          icon="activity"
          iconColor={COLORS.primary}
          style={styles.gridCard}
        />
        <MetricCard
          label="Month Projection"
          value={`₹${projectedMonthSpend.toLocaleString('en-IN')}`}
          subtitle={`Forecast for ${monthName}`}
          icon="trending-up"
          iconColor={COLORS.purple}
          style={styles.gridCard}
        />
      </View>

      {/* Category Spend Distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALL CATEGORIES ({monthName.toUpperCase()})</Text>
        <View style={styles.card}>
          {metrics.categoryBreakdown.map((cat) => {
            const color = getCategoryColor(cat.name);
            return (
              <View key={cat.name} style={styles.breakdownRow}>
                <View style={styles.rowTop}>
                  <View style={styles.nameWrap}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <Text style={styles.categoryName}>{cat.name}</Text>
                  </View>
                  <View style={styles.amountWrap}>
                    <Text style={styles.categoryAmount}>
                      ₹{cat.amount.toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.categoryPct}>{cat.pct}%</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      { backgroundColor: color, width: `${Math.min(cat.pct, 100)}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })}

          {metrics.categoryBreakdown.length === 0 && (
            <Text style={styles.emptyText}>No spending categorized yet.</Text>
          )}
        </View>
      </View>

      {/* Bank Volume Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SPENDING BY BANK / CARD</Text>
        <View style={styles.card}>
          {Object.entries(metrics.bankTotals || {}).map(([bankName, total]) => {
            const bankMeta = getBankMeta(bankName);
            const pct =
              metrics.thisMonthSpend > 0
                ? Math.round((total / metrics.thisMonthSpend) * 100)
                : 0;

            return (
              <View key={bankName} style={styles.breakdownRow}>
                <View style={styles.rowTop}>
                  <View style={styles.nameWrap}>
                    <View
                      style={[
                        styles.bankBadge,
                        { backgroundColor: bankMeta.bg, borderColor: bankMeta.border },
                      ]}
                    >
                      <Text style={[styles.bankBadgeText, { color: bankMeta.text }]}>
                        {bankMeta.short}
                      </Text>
                    </View>
                    <Text style={styles.categoryName}>{bankName}</Text>
                  </View>
                  <View style={styles.amountWrap}>
                    <Text style={styles.categoryAmount}>
                      ₹{Number(total).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.categoryPct}>{pct}%</Text>
                  </View>
                </View>

                {/* Bar */}
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: bankMeta.border,
                        width: `${Math.min(pct, 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}

          {Object.keys(metrics.bankTotals || {}).length === 0 && (
            <Text style={styles.emptyText}>No bank alerts recorded.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCard: {
    flex: 1,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  breakdownRow: {
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bankBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  bankBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  categoryName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryAmount: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryPct: {
    color: COLORS.textMuted,
    fontSize: 12,
    width: 32,
    textAlign: 'right',
  },
  barBg: {
    height: 6,
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
