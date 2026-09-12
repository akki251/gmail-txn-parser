import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SHADOWS, getCategoryColor } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { SpendingChart } from '../components/SpendingChart';
import { MetricCard } from '../components/MetricCard';
import { TransactionItem } from '../components/TransactionItem';
import { LiquidMeshWave } from '../components/LiquidMeshWave';
import { AnimatedBorderCard } from '../components/AnimatedBorderCard';
import { AnimatedNumber } from '../components/AnimatedNumber';
import {
  Skeleton,
  ChartSkeleton,
  MetricCardSkeleton,
  CategoryRowSkeleton,
  TransactionItemSkeleton,
} from '../components/Skeleton';
import * as Haptics from 'expo-haptics';

export const DashboardScreen = ({
  onOpenTxnDetail,
  onOpenSplit,
  onNavigateTab,
}) => {
  const { metrics, transactions, isLoading, isSyncing, refreshAll } = useApp();

  const recentTxns = transactions.slice(0, 6);
  const monthName = new Date().toLocaleString('default', { month: 'long' }).toUpperCase();

  if (isLoading && transactions.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Hero Section Skeleton */}
        <View style={styles.heroSection}>
          <Skeleton width={120} height={12} borderRadius={4} />
          <Skeleton width={180} height={38} borderRadius={8} style={{ marginVertical: 8 }} />
          <Skeleton width={130} height={20} borderRadius={6} />
        </View>

        {/* Chart Skeleton */}
        <ChartSkeleton />

        {/* Summary Row Skeleton */}
        <View style={styles.summaryRow}>
          <MetricCardSkeleton style={styles.halfCard} />
          <MetricCardSkeleton style={styles.halfCard} />
        </View>

        {/* Top Categories Skeleton */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Skeleton width={160} height={12} borderRadius={4} />
          </View>
          <View style={styles.categoryCard}>
            <CategoryRowSkeleton />
            <CategoryRowSkeleton />
            <CategoryRowSkeleton />
          </View>
        </View>

        {/* Recent Txns Skeleton */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Skeleton width={120} height={12} borderRadius={4} />
          </View>
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
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
          onRefresh={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            refreshAll();
          }}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Dynamic 3D Liquid Aurora Wave Backdrop */}
      <LiquidMeshWave height={230} />

      {/* Hero Section with Animated Counter and Baseline Pill */}
      <View style={styles.heroSection}>
        <Text style={styles.caption}>SPENT IN {monthName}</Text>
        <AnimatedNumber
          value={metrics.thisMonthSpend}
          style={styles.heroAmount}
        />
        <View style={styles.netSubtitleRow}>
          <Text style={styles.netSubtitleText}>
            Net Outflow:{' '}
            <Text style={styles.netSubtitleBold}>
              {metrics.thisMonthNet <= 0
                ? `+₹${Math.abs(metrics.thisMonthNet || 0).toLocaleString('en-IN')}`
                : `₹${(metrics.thisMonthNet || 0).toLocaleString('en-IN')}`}
            </Text>
          </Text>
        </View>

        {metrics.lastMonthSpend > 0 ? (
          <View style={styles.trendRow}>
            <View
              style={[
                styles.trendPill,
                {
                  backgroundColor:
                    metrics.spendTrendPct <= 0 ? COLORS.incomeBg : COLORS.expenseBg,
                },
              ]}
            >
              <Feather
                name={metrics.spendTrendPct <= 0 ? 'arrow-down-right' : 'arrow-up-right'}
                size={12}
                color={metrics.spendTrendPct <= 0 ? COLORS.income : COLORS.expense}
              />
              <Text
                style={[
                  styles.trendText,
                  {
                    color:
                      metrics.spendTrendPct <= 0 ? COLORS.income : COLORS.expense,
                  },
                ]}
              >
                {Math.abs(metrics.spendTrendPct)}% vs last month
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.trendRow}>
            <View style={[styles.trendPill, { backgroundColor: 'rgba(79, 70, 229, 0.08)' }]}>
              <Feather name="activity" size={12} color={COLORS.primary} />
              <Text style={[styles.trendText, { color: COLORS.primary }]}>
                Baseline Cycle • Month 1
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Spending Overview Curve Card with Animated Laser Border & Glass Sheen */}
      <AnimatedBorderCard
        borderRadius={18}
        style={{ marginTop: 10 }}
      >
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.chartTitle}>CUMULATIVE SPENDING</Text>
            <Text style={styles.chartSubtitle}>Month-to-date progression</Text>
          </View>
          <View style={styles.periodPill}>
            <Text style={styles.periodPillText}>{monthName}</Text>
          </View>
        </View>

        <SpendingChart
          dailySpend={metrics.dailyCumulativeSpend}
          daysInMonth={metrics.daysInCurrentMonth}
          currentDay={metrics.currentDay}
        />
      </AnimatedBorderCard>

      {/* Summary Row: Income & Expense */}
      <View style={styles.summaryRow}>
        <MetricCard
          label="Income"
          value={`+₹${metrics.thisMonthIncome.toLocaleString('en-IN')}`}
          icon="arrow-down-left"
          iconColor={COLORS.income}
          style={styles.halfCard}
        />
        <MetricCard
          label="Gross Spend"
          value={`−₹${metrics.thisMonthSpend.toLocaleString('en-IN')}`}
          icon="arrow-up-right"
          iconColor={COLORS.expense}
          subtitle={`Net: ${metrics.thisMonthNet <= 0 ? `+₹${Math.abs(metrics.thisMonthNet || 0).toLocaleString('en-IN')}` : `₹${(metrics.thisMonthNet || 0).toLocaleString('en-IN')}`}`}
          style={styles.halfCard}
        />
      </View>

      {/* Net Outflow Card alongside Gross Spend */}
      <View style={[styles.netCard, SHADOWS.sm]}>
        <View style={styles.netCardLeft}>
          <View style={styles.netIconWrap}>
            <Feather name="layers" size={15} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.netLabel}>NET OUTFLOW</Text>
            <Text style={styles.netFormula}>Gross spend − credits & refunds</Text>
          </View>
        </View>
        <Text
          style={[
            styles.netValue,
            { color: metrics.thisMonthNet <= 0 ? COLORS.income : COLORS.text },
          ]}
        >
          {metrics.thisMonthNet <= 0
            ? `+₹${Math.abs(metrics.thisMonthNet || 0).toLocaleString('en-IN')}`
            : `₹${(metrics.thisMonthNet || 0).toLocaleString('en-IN')}`}
        </Text>
      </View>

      {/* Unsplit Alert Banner */}
      {metrics.unsplitCount > 0 && (
        <TouchableOpacity
          style={[styles.unsplitBanner, SHADOWS.sm]}
          onPress={() => {
            Haptics.selectionAsync();
            onNavigateTab && onNavigateTab('splitter');
          }}
          activeOpacity={0.8}
        >
          <View style={styles.unsplitLeft}>
            <View style={styles.unsplitIcon}>
              <Feather name="users" size={16} color={COLORS.warning} />
            </View>
            <View>
              <Text style={styles.unsplitTitle}>
                {metrics.unsplitCount} Unsplit {metrics.unsplitCount === 1 ? 'Expense' : 'Expenses'}
              </Text>
              <Text style={styles.unsplitDesc}>Tap to split with friends or mark personal</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={COLORS.warning} />
        </TouchableOpacity>
      )}

      {/* Top Categories Breakdown */}
      {metrics.categoryBreakdown.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>TOP SPENDING CATEGORIES</Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                onNavigateTab && onNavigateTab('insights');
              }}
            >
              <Text style={styles.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.categoryCard, SHADOWS.md]}>
            {metrics.categoryBreakdown.slice(0, 4).map((cat) => {
              const color = getCategoryColor(cat.name);
              return (
                <View key={cat.name} style={styles.categoryItem}>
                  <View style={styles.catMetaRow}>
                    <View style={styles.catNameRow}>
                      <View style={[styles.catDot, { backgroundColor: color }]} />
                      <Text style={styles.catName}>{cat.name}</Text>
                    </View>
                    <Text style={styles.catAmount}>₹{cat.amount.toLocaleString('en-IN')}</Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { backgroundColor: color, width: `${Math.min(cat.pct, 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              onNavigateTab && onNavigateTab('transactions');
            }}
          >
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentTxns.map((tx) => (
          <TransactionItem
            key={tx.id}
            transaction={tx}
            onPress={onOpenTxnDetail}
            onQuickSplit={onOpenSplit}
          />
        ))}

        {recentTxns.length === 0 && (
          <View style={[styles.emptyCard, SHADOWS.sm]}>
            <Feather name="inbox" size={24} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No transactions fetched yet.</Text>
          </View>
        )}
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
    paddingBottom: 40,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  caption: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  heroAmount: {
    color: COLORS.text,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginTop: 4,
  },
  netSubtitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  netSubtitleText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  netSubtitleBold: {
    color: COLORS.text,
    fontWeight: '700',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chartTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chartSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  periodPill: {
    backgroundColor: COLORS.bgSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  periodPillText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  halfCard: {
    flex: 1,
  },
  netCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
  },
  netCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  netIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  netLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  netFormula: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  netValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  unsplitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 14,
  },
  unsplitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  unsplitIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsplitTitle: {
    color: COLORS.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  unsplitDesc: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionLink: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  categoryItem: {
    gap: 6,
  },
  catMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  catAmount: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 30,
    marginHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
});
