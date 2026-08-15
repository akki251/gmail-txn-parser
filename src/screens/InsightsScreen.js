import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, DeviceEventEmitter } from 'react-native';
import db from '../store/db';
import { ScreenContainer, Stack, Row, Section } from '../components/primitives/Layout';
import { Heading, BodyText, Caption, DisplayText } from '../components/primitives/Text';
import { Card, ThinDivider } from '../components/primitives/Surfaces';
import { Colors, Radius, Spacing } from '../theme/tokens';

export default function InsightsScreen() {
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

  // Generate intelligent story insights
  const debits = transactions.filter((t) => t.type === 'debit' && !t.notATransaction);
  const totalSpent = debits.reduce((acc, c) => acc + (c.amount || 0), 0);
  const topTxn = debits.sort((a, b) => (b.amount || 0) - (a.amount || 0))[0];

  const merchantCounts = {};
  debits.forEach((t) => {
    const m = t.merchant || 'Other';
    merchantCounts[m] = (merchantCounts[m] || 0) + (t.amount || 0);
  });

  const topMerchant = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentLight} />}
      >
        <Heading level={1}>Financial Insights</Heading>
        <Caption style={{ marginTop: 2, marginBottom: Spacing.xl }}>Editorial Money Intelligence</Caption>

        <Stack space={Spacing.md}>
          {topMerchant && (
            <Card elevated style={styles.insightCard}>
              <Caption color={Colors.accentLight}>Top Spending Destination</Caption>
              <Heading level={2} style={{ marginTop: 4 }}>
                You spent ₹{topMerchant[1].toLocaleString('en-IN')} on {topMerchant[0]}
              </Heading>
              <BodyText small color={Colors.textSecondary} style={{ marginTop: 6 }}>
                {topMerchant[0]} represents your highest expenditure category this month.
              </BodyText>
            </Card>
          )}

          {topTxn && (
            <Card style={styles.insightCard}>
              <Caption color={Colors.warning}>Largest Single Expense</Caption>
              <Heading level={2} style={{ marginTop: 4 }}>
                ₹{topTxn.amount.toLocaleString('en-IN')} at {topTxn.merchant || 'Merchant'}
              </Heading>
              <BodyText small color={Colors.textSecondary} style={{ marginTop: 6 }}>
                Recorded on {topTxn.date || 'Today'} via {topTxn.bank || 'Bank SMS'}.
              </BodyText>
            </Card>
          )}

          <Card style={styles.insightCard}>
            <Caption color={Colors.positive}>Air-Gapped Efficiency</Caption>
            <Heading level={2} style={{ marginTop: 4 }}>
              100% On-Device Deterministic Parsing
            </Heading>
            <BodyText small color={Colors.textSecondary} style={{ marginTop: 6 }}>
              All {transactions.length} SMS transactions were parsed locally with zero data leaving your device.
            </BodyText>
          </Card>
        </Stack>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  insightCard: {
    padding: Spacing.xl,
  },
});
