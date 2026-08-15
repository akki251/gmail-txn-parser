import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import db from '../store/db';
import { ScreenContainer, Stack, Row, Section } from '../components/primitives/Layout';
import { DisplayText, Heading, BodyText, Caption } from '../components/primitives/Text';
import { Card, ThinDivider } from '../components/primitives/Surfaces';
import HeroSpendingChart from '../components/charts/HeroSpendingChart';
import { Colors, Radius, Spacing } from '../theme/tokens';

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    const sub = DeviceEventEmitter.addListener('TRANSACTION_ADDED', loadData);
    return () => sub.remove();
  }, []);

  const loadData = async () => {
    await db.loadDb();
    setTransactions(db.getTransactions());
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const totalSpent = transactions
    .filter((t) => t.type === 'debit' && !t.notATransaction)
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const totalCredited = transactions
    .filter((t) => t.type === 'credit' && !t.notATransaction)
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Group recent activity
  const recentTxns = transactions.slice(0, 8);

  const renderTxnRow = ({ item }) => {
    const isDebit = item.type === 'debit';
    const amountColor = isDebit ? Colors.negative : Colors.positive;
    const formattedAmount = `${isDebit ? '-' : '+'}₹${Number(item.amount || 0).toLocaleString('en-IN')}`;

    return (
      <View style={styles.rowItem}>
        <Row>
          <View style={[styles.avatar, { backgroundColor: isDebit ? Colors.negativeMuted : Colors.positiveMuted }]}>
            <Text style={[styles.avatarText, { color: amountColor }]}>
              {item.merchant ? item.merchant.charAt(0).toUpperCase() : '₹'}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <BodyText bold numberOfLines={1}>{item.merchant || item.sourceParser || 'Bank Transaction'}</BodyText>
            <Caption>{item.bank || 'Bank'} • {item.instrument || 'SMS Alert'}</Caption>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <BodyText bold style={{ color: amountColor }}>{formattedAmount}</BodyText>
            {item.needsReview && (
              <View style={styles.reviewBadge}>
                <Caption color={Colors.warning}>Needs Review</Caption>
              </View>
            )}
          </View>
        </Row>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentLight} />}
      >
        {/* Editorial Greeting Header */}
        <View style={styles.editorialHeader}>
          <Caption color={Colors.textMuted}>Good evening</Caption>
          <Heading level={1} style={{ marginTop: 2 }}>Your finances</Heading>

          <View style={styles.heroAmountBox}>
            <DisplayText style={{ color: Colors.negative }}>
              ₹{totalSpent.toLocaleString('en-IN')}
            </DisplayText>
            <Caption style={{ marginTop: 4 }}>spent this month</Caption>
          </View>
        </View>

        {/* Hero Interactive SVG Spending Chart */}
        <HeroSpendingChart transactions={transactions} />

        {/* Summary Metrics Row */}
        <View style={styles.metricsRow}>
          <Card style={[styles.metricCard, { borderLeftColor: Colors.negative, borderLeftWidth: 4 }]}>
            <Caption color={Colors.textMuted}>Total Debits</Caption>
            <BodyText bold style={{ fontSize: 18, color: Colors.negative, marginTop: 4 }}>
              ₹{totalSpent.toLocaleString('en-IN')}
            </BodyText>
          </Card>

          <Card style={[styles.metricCard, { borderLeftColor: Colors.positive, borderLeftWidth: 4 }]}>
            <Caption color={Colors.textMuted}>Total Income</Caption>
            <BodyText bold style={{ fontSize: 18, color: Colors.positive, marginTop: 4 }}>
              ₹{totalCredited.toLocaleString('en-IN')}
            </BodyText>
          </Card>
        </View>

        {/* Recent Activity List */}
        <Section style={{ paddingHorizontal: Spacing.lg }}>
          <Row style={{ marginBottom: Spacing.md }}>
            <Heading level={2}>Recent Activity</Heading>
            <Caption color={Colors.accentLight}>{recentTxns.length} records</Caption>
          </Row>

          <Card style={{ padding: 0 }}>
            {recentTxns.length === 0 ? (
              <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                <BodyText color={Colors.textMuted}>No activity recorded yet</BodyText>
              </View>
            ) : (
              recentTxns.map((item, index) => (
                <React.Fragment key={item.id || index}>
                  {renderTxnRow({ item })}
                  {index < recentTxns.length - 1 && <ThinDivider margin={0} />}
                </React.Fragment>
              ))
            )}
          </Card>
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  editorialHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  heroAmountBox: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    padding: Spacing.md,
  },
  rowItem: {
    padding: Spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  reviewBadge: {
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.small,
    marginTop: 4,
  },
});
