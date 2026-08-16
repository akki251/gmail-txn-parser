import React, { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, Dimensions, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Check, ChevronRight, Repeat2, Sparkles } from 'lucide-react-native';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import db from '../store/db';
import { generateInsights } from '../engine/insights';
import { BodyText, Caption, DisplayText, Heading } from '../components/primitives/Text';
import { colors } from '../design';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = 20;
const CARD_GAP = 12;
const HALF_CARD_WIDTH = (SCREEN_WIDTH - (HORIZONTAL_PADDING * 2) - CARD_GAP) / 2;
const formatAmount = (value = 0) => `₹${Math.round(value).toLocaleString('en-IN')}`;

function InsightIcon({ type }) {
  const props = { size: 18, strokeWidth: 2.2 };
  if (type === 'recurring_payment') return <Repeat2 {...props} color={colors.primary} />;
  if (type === 'category_spike') return <ArrowUpRight {...props} color={colors.expense} />;
  return <AlertCircle {...props} color={colors.warning} />;
}

export default function InsightsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [insightsData, setInsightsData] = useState(null);

  useEffect(() => {
    loadData();
    const subscription = DeviceEventEmitter.addListener('TRANSACTION_ADDED', loadData);
    return () => subscription.remove();
  }, []);

  const loadData = async () => {
    await db.loadDb();
    const nextTransactions = db.getTransactions();
    setTransactions(nextTransactions);
    setInsightsData(generateInsights(nextTransactions));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const analytics = useMemo(() => {
    const now = new Date();
    const debits = transactions.filter((item) => item.type === 'debit' && !item.notATransaction && item.amount > 0);
    const currentMonth = debits.filter((item) => {
      const date = new Date(item.date || item.rawDate);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const totalsByDay = {};
    const totalsByCategory = {};
    currentMonth.forEach((item) => {
      const day = new Date(item.date || item.rawDate).getDate();
      const category = item.category || 'Miscellaneous';
      totalsByDay[day] = (totalsByDay[day] || 0) + item.amount;
      totalsByCategory[category] = (totalsByCategory[category] || 0) + item.amount;
    });
    let runningTotal = 0;
    const lineData = Array.from({ length: Math.max(now.getDate(), 2) }, (_, index) => {
      runningTotal += totalsByDay[index + 1] || 0;
      return { value: Math.max(runningTotal, 1), label: (index + 1) % 7 === 0 ? String(index + 1) : '' };
    });
    const categories = Object.entries(totalsByCategory)
      .sort(([, first], [, second]) => second - first)
      .slice(0, 4)
      .map(([name, value]) => ({ name, value }));
    return { categories, currentMonth, lineData };
  }, [transactions]);

  const insufficientData = !insightsData || insightsData.dataSufficiency === 'none';
  const summary = insightsData?.summary;
  const hero = insightsData?.hero;
  const recurring = insightsData?.recurring || [];
  const totalRecurring = recurring.reduce((total, item) => total + item.amount, 0);
  const recurringPercent = summary?.value ? Math.min(100, Math.round((totalRecurring / summary.value) * 100)) : 0;
  const primaryCategory = analytics.categories[0];
  const trendIsUp = summary?.trend?.startsWith('↑');
  const monthName = summary?.monthName || new Date().toLocaleString('default', { month: 'long' });
  const ringData = [{ value: Math.max(recurringPercent, 1), color: '#FFFFFF' }, { value: Math.max(100 - recurringPercent, 0), color: 'rgba(255,255,255,0.20)' }];

  if (insufficientData) {
    return <View style={styles.container}><View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Sparkles size={24} color={colors.primary} /></View>
      <Caption style={styles.eyebrow}>YOUR MONEY MAP</Caption>
      <Heading level={1} style={styles.emptyTitle}>Insights are warming up.</Heading>
      <BodyText color={colors.textSecondary} style={styles.emptyCopy}>Keep using the app for a few more transactions. We’ll surface the patterns that matter once there’s enough history.</BodyText>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min((transactions.length / 10) * 100, 100)}%` }]} /></View>
      <Caption style={styles.progressLabel}>{transactions.length} OF 10 TRANSACTIONS RECORDED</Caption>
    </View></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        <Animated.View entering={FadeInUp.duration(350)}>
          <View style={styles.header}>
            <View><Caption style={styles.eyebrow}>YOUR MONEY MAP</Caption><Heading level={1} style={styles.title}>Insights</Heading></View>
            <View style={styles.monthPill}><Caption style={styles.monthLabel}>{monthName.slice(0, 3)} ‘{String(new Date().getFullYear()).slice(-2)}</Caption></View>
          </View>
          <LinearGradient colors={['#4B42D6', '#3024AE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.spendCard}>
            <View style={styles.orbOne} /><View style={styles.orbTwo} />
            <View style={styles.spendTopRow}><Caption style={styles.onPrimaryLabel}>SPENT THIS MONTH</Caption><View style={styles.trendPill}>{trendIsUp ? <ArrowUpRight size={14} color="#FFFFFF" /> : <ArrowDownRight size={14} color="#FFFFFF" />}<Caption style={styles.trendText}>{summary?.trend || 'In progress'}</Caption></View></View>
            <DisplayText style={styles.spendTotal}>{formatAmount(summary?.value)}</DisplayText>
            <BodyText style={styles.spendSubtext}>{summary?.comparison || 'Your monthly spending summary.'}</BodyText>
            <View style={styles.chartArea}><LineChart data={analytics.lineData} width={SCREEN_WIDTH - (HORIZONTAL_PADDING * 2) - 20} height={98} thickness={2.5} color="#FFFFFF" areaChart startFillColor="rgba(255,255,255,0.24)" endFillColor="rgba(255,255,255,0.01)" hideDataPoints hideRules hideYAxisText yAxisThickness={0} xAxisThickness={0} initialSpacing={0} endSpacing={0} curved xAxisLabelTextStyle={styles.chartLabel} /></View>
          </LinearGradient>
        </Animated.View>

        {hero && <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.signalCard}>
          <View style={styles.signalIcon}><InsightIcon type={hero.type} /></View>
          <View style={styles.signalContent}><Caption style={styles.signalKicker}>{hero.title}</Caption><Heading level={3} style={styles.signalTitle}>{hero.headline}</Heading><BodyText small color={colors.textSecondary} style={styles.signalCopy}>{hero.description}</BodyText><View style={styles.signalFooter}><BodyText bold small color={colors.textPrimary}>{hero.value ? formatAmount(hero.value) : hero.comparison}</BodyText><ChevronRight size={18} color={colors.textMuted} /></View></View>
        </Animated.View>}

        <Animated.View entering={FadeInUp.delay(140).duration(350)} style={styles.statsRow}>
          <View style={[styles.statCard, styles.fixedCostCard]}><View style={styles.statTopRow}><Caption style={styles.onPrimaryLabel}>FIXED COSTS</Caption><PieChart data={ringData} donut radius={28} innerRadius={19} innerCircleColor="#17115D" /></View><BodyText style={styles.statNumber}>{recurringPercent}%</BodyText><Caption style={styles.statDescription}>{formatAmount(totalRecurring)} / MONTH</Caption></View>
          <View style={styles.statCard}><Caption style={styles.cardLabel}>TOP CATEGORY</Caption><BodyText style={[styles.statNumber, styles.darkStatNumber]} numberOfLines={1}>{primaryCategory?.name || '—'}</BodyText><Caption style={styles.cardDescription}>{primaryCategory ? formatAmount(primaryCategory.value) : 'NO SPEND YET'}</Caption></View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(350)} style={styles.section}>
          <View style={styles.sectionHeader}><Heading level={2} style={styles.sectionTitle}>Where it went</Heading><Caption style={styles.sectionMeta}>{analytics.currentMonth.length} PAYMENTS</Caption></View>
          <View style={styles.categoryCard}>{analytics.categories.length === 0 ? <BodyText color={colors.textSecondary}>No spending recorded this month.</BodyText> : analytics.categories.map((category, index) => {
            const percentage = summary?.value ? Math.min((category.value / summary.value) * 100, 100) : 0;
            const color = index === 0 ? colors.primary : index === 1 ? colors.income : index === 2 ? colors.warning : '#A1A19B';
            return <View key={category.name} style={[styles.categoryRow, index !== analytics.categories.length - 1 && styles.categoryBorder]}><View style={[styles.categoryMarker, { backgroundColor: color }]} /><View style={styles.categoryContent}><View style={styles.categoryValueRow}><BodyText bold>{category.name}</BodyText><BodyText bold>{formatAmount(category.value)}</BodyText></View><View style={styles.categoryProgress}><View style={[styles.categoryProgressFill, { width: `${percentage}%`, backgroundColor: color }]} /></View></View></View>;
          })}</View>
        </Animated.View>

        {recurring.length > 0 && <Animated.View entering={FadeInUp.delay(250).duration(350)} style={styles.section}>
          <View style={styles.sectionHeader}><Heading level={2} style={styles.sectionTitle}>On repeat</Heading><Caption style={styles.sectionMeta}>{recurring.length} DETECTED</Caption></View>
          <View style={styles.recurringCard}>{recurring.slice(0, 3).map((item, index) => <View key={item.merchant} style={[styles.recurringRow, index !== Math.min(recurring.length, 3) - 1 && styles.categoryBorder]}><View style={styles.repeatBadge}><Repeat2 size={16} color={colors.primary} /></View><View style={styles.recurringName}><BodyText bold numberOfLines={1}>{item.merchant}</BodyText><Caption>{item.count} PAYMENTS</Caption></View><BodyText bold>{formatAmount(item.amount)}</BodyText></View>)}{recurring.length > 3 && <View style={styles.moreRow}><Check size={15} color={colors.income} /><BodyText small color={colors.textSecondary}>Plus {recurring.length - 3} more recurring payment{recurring.length - 3 > 1 ? 's' : ''}</BodyText></View>}</View>
        </Animated.View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, scrollContent: { paddingTop: 58, paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: 132 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }, eyebrow: { color: colors.primary, letterSpacing: 1.2 }, title: { marginTop: 5, fontSize: 34, lineHeight: 40 }, monthPill: { backgroundColor: '#EBEAF9', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 3 }, monthLabel: { color: colors.primary, fontSize: 10 },
  spendCard: { minHeight: 268, padding: 20, overflow: 'hidden', borderRadius: 26 }, orbOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)', top: -94, right: -42 }, orbTwo: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(136,127,255,0.30)', bottom: -48, left: 54 }, spendTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, onPrimaryLabel: { color: 'rgba(255,255,255,0.70)', fontSize: 10 }, trendPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.17)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 }, trendText: { color: '#FFFFFF', textTransform: 'none', letterSpacing: 0, fontSize: 10 }, spendTotal: { color: '#FFFFFF', fontSize: 38, lineHeight: 44, marginTop: 12 }, spendSubtext: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19, marginTop: 4, maxWidth: '82%' }, chartArea: { height: 102, marginTop: 10, marginLeft: -9 }, chartLabel: { color: 'rgba(255,255,255,0.48)', fontFamily: 'Gilroy_Medium', fontSize: 9 },
  signalCard: { flexDirection: 'row', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 16, marginTop: CARD_GAP }, signalIcon: { height: 40, width: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSoft, marginRight: 12 }, signalContent: { flex: 1 }, signalKicker: { color: colors.primary, fontSize: 10 }, signalTitle: { marginTop: 3, fontSize: 19, lineHeight: 25 }, signalCopy: { marginTop: 4, lineHeight: 18 }, signalFooter: { marginTop: 11, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: CARD_GAP, marginTop: CARD_GAP }, statCard: { width: HALF_CARD_WIDTH, minHeight: 132, borderRadius: 20, backgroundColor: colors.surface, padding: 15, borderWidth: 1, borderColor: colors.border }, fixedCostCard: { backgroundColor: '#17115D', borderColor: '#17115D' }, statTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, statNumber: { color: '#FFFFFF', fontFamily: 'Gilroy_SemiBold', fontSize: 25, lineHeight: 30, letterSpacing: -0.7, marginTop: 7 }, darkStatNumber: { color: colors.textPrimary, fontSize: 19, marginTop: 13 }, statDescription: { color: 'rgba(255,255,255,0.62)', fontSize: 9, marginTop: 2 }, cardLabel: { color: colors.textMuted, fontSize: 10 }, cardDescription: { color: colors.textSecondary, fontSize: 10, marginTop: 5 },
  section: { marginTop: 30 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }, sectionTitle: { fontSize: 22, lineHeight: 28 }, sectionMeta: { color: colors.textMuted, fontSize: 10 }, categoryCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 15 }, categoryRow: { flexDirection: 'row', paddingVertical: 15 }, categoryBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, categoryMarker: { width: 7, height: 7, borderRadius: 4, marginRight: 11, marginTop: 7 }, categoryContent: { flex: 1 }, categoryValueRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, categoryProgress: { height: 4, borderRadius: 3, overflow: 'hidden', backgroundColor: '#EFEFEB', marginTop: 9 }, categoryProgressFill: { height: '100%', borderRadius: 3 },
  recurringCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 15 }, recurringRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center' }, repeatBadge: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EBEAF9', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, recurringName: { flex: 1, marginRight: 8 }, moreRow: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingVertical: 13 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: colors.background }, emptyIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#EBEAF9', marginBottom: 20 }, emptyTitle: { textAlign: 'center', marginTop: 7, fontSize: 28, lineHeight: 35 }, emptyCopy: { textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 320 }, progressTrack: { marginTop: 28, width: 210, height: 5, backgroundColor: '#E0E0DB', borderRadius: 3, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 }, progressLabel: { color: colors.textMuted, marginTop: 10, fontSize: 9 },
});
