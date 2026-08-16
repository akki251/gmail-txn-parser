import React, { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Repeat2, Sparkles } from 'lucide-react-native';
import db from '../store/db';
import { generateInsights } from '../engine/insights';
import { BodyText, Caption, DisplayText, Heading } from '../components/primitives/Text';
import { Pressable } from '../components/primitives/Pressable';
import { Card, ThinDivider } from '../components/primitives/Surfaces';
import { TransactionRow } from '../components/primitives/TransactionRow';
import { Skeleton, SkeletonRow } from '../components/primitives/Skeleton';
import HeroSpendingChart from '../components/charts/HeroSpendingChart';
import { colors, radius, spacing } from '../design';

const formatAmount = (value = 0) => `₹${Math.round(value).toLocaleString('en-IN')}`;

function isInMonth(item, month, year) {
  const rawDate = item.date || item.rawDate;
  if (!rawDate || rawDate === 'Today') {
    const now = new Date();
    return now.getMonth() === month && now.getFullYear() === year;
  }
  const date = new Date(rawDate);
  return !Number.isNaN(date.getTime()) && date.getMonth() === month && date.getFullYear() === year;
}

function SummaryCard({ label, amount, trend, positive }) {
  const hasTrend = Boolean(trend?.text);
  const trendUp = trend?.isUp;
  return (
    <Card style={styles.summaryCard} accessibilityLabel={`${label}, ${formatAmount(amount)}${trend?.text ? `, ${trend.text}` : ''}`}>
      <Caption style={styles.summaryLabel}>{label}</Caption>
      <BodyText style={[styles.summaryAmount, positive && { color: colors.income }]}>{positive ? '+' : '−'}{formatAmount(amount)}</BodyText>
      {hasTrend && <View style={styles.summaryTrend}>
        {trendUp ? <ArrowUpRight size={14} color={positive ? colors.income : colors.textSecondary} /> : <ArrowDownRight size={14} color={colors.income} />}
      <Caption style={[styles.summaryTrendText, positive && { color: colors.income }]}>{trend.text}</Caption>
      </View>}
    </Card>
  );
}

function InsightPreview({ insight, recurringTotal }) {
  if (!insight && !recurringTotal) return null;
  const title = insight?.title || 'RECURRING COSTS';
  const headline = insight?.headline || `${formatAmount(recurringTotal)} in subscriptions`;
  const description = insight?.description || 'Recurring payments detected from your transaction history.';
  return (
    <Card style={styles.insightCard} accessibilityLabel={`${title}. ${headline}. ${description}`}>
      <View style={styles.insightIcon}>{insight?.type === 'recurring_payment' ? <Repeat2 size={18} color={colors.primary} /> : <Sparkles size={18} color={colors.primary} />}</View>
      <View style={styles.insightBody}>
        <Caption style={styles.insightKicker}>{title}</Caption>
        <Heading level={3} style={styles.insightTitle}>{headline}</Heading>
        <BodyText small color={colors.textSecondary} style={styles.insightCopy}>{description}</BodyText>
      </View>
      <ChevronRight size={19} color={colors.textMuted} />
    </Card>
  );
}

function DashboardSkeleton() {
  return <View style={styles.skeletonWrap}>
    <Skeleton width="32%" height={11} /><Skeleton width="62%" height={36} style={{ marginTop: 12 }} /><Skeleton width="55%" height={48} style={{ marginTop: 14 }} />
    <Skeleton height={226} rad={radius.large} style={{ marginTop: 28 }} />
    <View style={styles.summaryRow}><Skeleton width="48%" height={132} rad={radius.large} /><Skeleton width="48%" height={132} rad={radius.large} /></View>
    <View style={{ marginTop: 34 }}>
      <Skeleton width="42%" height={26} />
      <View style={styles.transactionCard}><SkeletonRow /><ThinDivider margin={0} /><SkeletonRow /><ThinDivider margin={0} /><SkeletonRow /></View>
    </View>
  </View>;
}

export default function Dashboard({ navigation }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadData();
    const subscription = DeviceEventEmitter.addListener('TRANSACTION_ADDED', loadData);
    return () => subscription.remove();
  }, []);

  const loadData = async () => {
    try {
      await db.loadDb();
      setTransactions(db.getTransactions());
      setError(false);
    } catch (loadError) {
      console.warn('[Dashboard] Could not load transactions', loadError);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  };

  const finance = useMemo(() => {
    const now = new Date();
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const validTransactions = transactions.filter((item) => !item.notATransaction && Number(item.amount) > 0);
    const current = validTransactions.filter((item) => isInMonth(item, now.getMonth(), now.getFullYear()));
    const previousMonth = validTransactions.filter((item) => isInMonth(item, previous.getMonth(), previous.getFullYear()));
    const totalByType = (items, type) => items.filter((item) => item.type === type).reduce((total, item) => total + Number(item.amount || 0), 0);
    const spending = totalByType(current, 'debit');
    const income = totalByType(current, 'credit');
    const previousSpending = totalByType(previousMonth, 'debit');
    const previousIncome = totalByType(previousMonth, 'credit');
    const trendFor = (currentValue, previousValue) => {
      if (!previousValue) return null;
      const percentage = Math.round(Math.abs(currentValue - previousValue) / previousValue * 100);
      return { text: `${percentage}% vs last month`, isUp: currentValue > previousValue };
    };
    return { spending, income, spendingTrend: trendFor(spending, previousSpending), incomeTrend: trendFor(income, previousIncome) };
  }, [transactions]);

  const insights = useMemo(() => generateInsights(transactions), [transactions]);
  const recurringTotal = (insights.recurring || []).reduce((total, item) => total + item.amount, 0);
  const recentTransactions = transactions.slice(0, 5);
  const greeting = new Date().getHours() < 12 ? 'GOOD MORNING' : new Date().getHours() < 17 ? 'GOOD AFTERNOON' : 'GOOD EVENING';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        {loading ? <DashboardSkeleton /> : error ? <View style={styles.errorState}><Heading level={2}>Unable to load your finances</Heading><BodyText color={colors.textSecondary} style={styles.errorCopy}>Your transactions are safe. Please try loading them again.</BodyText><Pressable haptic onPress={loadData} style={styles.retryButton}><BodyText bold color={colors.white}>Try again</BodyText></Pressable></View> : <>
          <Animated.View entering={FadeInUp.duration(380)}>
            <Caption style={styles.greeting}>{greeting}</Caption>
            <Heading level={1} style={styles.pageTitle}>Your finances</Heading>
            <DisplayText style={styles.primaryAmount} accessibilityLabel={`Monthly spending, ${formatAmount(finance.spending)}`}>{formatAmount(finance.spending)}</DisplayText>
            <Caption style={styles.primaryLabel}>SPENT THIS MONTH</Caption>
            {finance.spendingTrend && <View style={styles.primaryTrend}>{finance.spendingTrend.isUp ? <ArrowUpRight size={16} color={colors.expense} /> : <ArrowDownRight size={16} color={colors.income} />}<BodyText color={colors.textSecondary}>{finance.spendingTrend.text}</BodyText></View>}
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(70).duration(380)}>
            <Card style={styles.overviewCard} accessibilityLabel="Monthly spending overview chart">
              <View style={styles.overviewHeader}><View><Caption style={styles.overviewLabel}>SPENDING OVERVIEW</Caption><BodyText bold style={styles.overviewValue}>{formatAmount(finance.spending)}</BodyText></View><Caption style={styles.overviewPeriod}>THIS MONTH</Caption></View>
              <HeroSpendingChart transactions={transactions} />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(120).duration(380)} style={styles.summaryRow}>
            <SummaryCard label="INCOME" amount={finance.income} trend={finance.incomeTrend} positive />
            <SummaryCard label="SPENDING" amount={finance.spending} trend={finance.spendingTrend} />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(170).duration(380)} style={styles.section}>
            <View style={styles.sectionHeader}><Heading level={2} style={styles.sectionTitle}>Your activity</Heading><Caption style={styles.sectionMeta}>THIS MONTH</Caption></View>
            <InsightPreview insight={insights.hero} recurringTotal={recurringTotal} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(210).duration(380)} style={styles.section}>
            <View style={styles.sectionHeader}><Heading level={2} style={styles.sectionTitle}>Recent transactions</Heading><Pressable haptic onPress={() => navigation.navigate('Txns')} style={styles.seeAll}><BodyText small bold color={colors.primary}>See all</BodyText><ChevronRight size={15} color={colors.primary} /></Pressable></View>
            <View style={styles.transactionCard}>
              {recentTransactions.length === 0 ? <View style={styles.emptyTransactions}><BodyText bold>No transactions yet</BodyText><BodyText small color={colors.textSecondary} style={{ marginTop: 4 }}>Your financial activity will appear here once transactions are added.</BodyText></View> : recentTransactions.map((item, index) => <React.Fragment key={item.id || `${item.merchant}-${index}`}><TransactionRow item={item} onPress={() => navigation.navigate('Txns')} />{index < recentTransactions.length - 1 && <ThinDivider margin={0} style={styles.rowDivider} />}</React.Fragment>)}
            </View>
          </Animated.View>
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, scrollContent: { paddingTop: 58, paddingHorizontal: spacing.xl, paddingBottom: 152 },
  greeting: { color: colors.textSecondary, letterSpacing: 1.8 }, pageTitle: { marginTop: 12, fontSize: 34, lineHeight: 40 }, primaryAmount: { marginTop: 16, fontSize: 48, lineHeight: 54 }, primaryLabel: { marginTop: 8, color: colors.textMuted }, primaryTrend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  overviewCard: { marginTop: 28, borderRadius: radius.large, paddingTop: 19, paddingHorizontal: 18, paddingBottom: 8 }, overviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, overviewLabel: { color: colors.textMuted }, overviewValue: { marginTop: 5, fontSize: 22, lineHeight: 28 }, overviewPeriod: { color: colors.primary, fontSize: 10, backgroundColor: '#EEECFB', borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  summaryRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }, summaryCard: { flex: 1, minHeight: 126, borderRadius: radius.large, padding: 16 }, summaryLabel: { color: colors.textMuted }, summaryAmount: { fontFamily: 'Gilroy_SemiBold', fontSize: 21, lineHeight: 28, color: colors.textPrimary, marginTop: 12 }, summaryTrend: { flexDirection: 'row', gap: 3, alignItems: 'center', marginTop: 12 }, summaryTrendText: { color: colors.textSecondary, textTransform: 'none', letterSpacing: 0, fontSize: 10 },
  section: { marginTop: 34 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }, sectionTitle: { fontSize: 25, lineHeight: 31 }, sectionMeta: { color: colors.textMuted }, insightCard: { borderRadius: radius.large, padding: 16, flexDirection: 'row', alignItems: 'center' }, insightIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEECFB', marginRight: 12 }, insightBody: { flex: 1, paddingRight: 8 }, insightKicker: { color: colors.primary, fontSize: 10 }, insightTitle: { marginTop: 3, fontSize: 18, lineHeight: 24 }, insightCopy: { marginTop: 3, lineHeight: 18 },
  seeAll: { flexDirection: 'row', alignItems: 'center', minHeight: 36, gap: 1 }, transactionCard: { backgroundColor: colors.surface, borderRadius: radius.large, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' }, rowDivider: { marginHorizontal: spacing.lg, width: 'auto' }, emptyTransactions: { padding: spacing.xl, alignItems: 'center' }, skeletonWrap: { paddingTop: 12 }, errorState: { alignItems: 'center', paddingVertical: 120, paddingHorizontal: spacing.xl }, errorCopy: { textAlign: 'center', marginTop: 10, lineHeight: 22 }, retryButton: { marginTop: 22, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: radius.pill },
});
