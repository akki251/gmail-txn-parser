import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, DeviceEventEmitter } from 'react-native';
import db from '../store/db';
import { ScreenContainer, Stack, Row, Section } from '../components/primitives/Layout';
import { Heading, BodyText, Caption, DisplayText } from '../components/primitives/Text';
import { Card, ThinDivider } from '../components/primitives/Surfaces';
import { Colors, Radius, Spacing } from '../theme/tokens';

export default function AccountsScreen() {
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

  // Group accounts by Bank / Financial Instrument
  const bankTotals = {};
  const bnplTotals = {};

  transactions.forEach((t) => {
    const bankName = t.bank || 'Bank Account';
    const isBNPL = /LazyPay|Simpl|Paytm Postpaid|Amazon Pay Later/i.test(bankName) || /LazyPay|Simpl|Paytm Postpaid|Amazon Pay Later/i.test(t.merchant || '');

    if (isBNPL) {
      const bnplName = /LazyPay/i.test(t.merchant || bankName)
        ? 'LazyPay'
        : /Simpl/i.test(t.merchant || bankName)
        ? 'Simpl'
        : /Paytm/i.test(t.merchant || bankName)
        ? 'Paytm Postpaid'
        : 'Amazon Pay Later';
      bnplTotals[bnplName] = (bnplTotals[bnplName] || 0) + (t.amount || 0);
    } else {
      bankTotals[bankName] = (bankTotals[bankName] || 0) + (t.amount || 0);
    }
  });

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentLight} />}
      >
        <Heading level={1}>Accounts & BNPL</Heading>
        <Caption style={{ marginTop: 2, marginBottom: Spacing.xl }}>Air-Gapped Financial Instruments</Caption>

        {/* Bank Accounts & Cards */}
        <Section>
          <Heading level={2} style={{ marginBottom: Spacing.md }}>Bank Accounts & Cards</Heading>
          <Stack space={Spacing.md}>
            {Object.keys(bankTotals).length === 0 ? (
              <Card>
                <BodyText color={Colors.textMuted}>No bank accounts detected yet.</BodyText>
              </Card>
            ) : (
              Object.entries(bankTotals).map(([bank, amount]) => (
                <Card key={bank}>
                  <Row>
                    <View style={styles.bankAvatar}>
                      <Text style={styles.bankAvatarText}>{bank.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <BodyText bold>{bank}</BodyText>
                      <Caption>Automated SMS Ledger</Caption>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <BodyText bold>₹{amount.toLocaleString('en-IN')}</BodyText>
                      <Caption color={Colors.positive}>Active</Caption>
                    </View>
                  </Row>
                </Card>
              ))
            )}
          </Stack>
        </Section>

        {/* Pay-Later & BNPL Accounts */}
        <Section>
          <Heading level={2} style={{ marginBottom: Spacing.md }}>Pay-Later Accounts (BNPL)</Heading>
          <Stack space={Spacing.md}>
            {Object.keys(bnplTotals).length === 0 ? (
              <Card>
                <BodyText color={Colors.textMuted}>No BNPL Pay-Later accounts detected.</BodyText>
              </Card>
            ) : (
              Object.entries(bnplTotals).map(([bnpl, amount]) => (
                <Card key={bnpl} elevated>
                  <Row>
                    <View style={[styles.bankAvatar, { backgroundColor: Colors.warningMuted }]}>
                      <Text style={[styles.bankAvatarText, { color: Colors.warning }]}>⚡</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <BodyText bold>{bnpl}</BodyText>
                      <Caption color={Colors.warning}>Upcoming Bill Credit</Caption>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <BodyText bold style={{ color: Colors.warning }}>₹{amount.toLocaleString('en-IN')}</BodyText>
                      <Caption color={Colors.warning}>Due Soon</Caption>
                    </View>
                  </Row>
                </Card>
              ))
            )}
          </Stack>
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bankAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  bankAvatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.accentLight,
  },
});
