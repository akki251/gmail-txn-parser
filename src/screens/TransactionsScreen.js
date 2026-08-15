import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import db from '../store/db';
import { ScreenContainer, Stack, Row, Section } from '../components/primitives/Layout';
import { Heading, BodyText, Caption, DisplayText } from '../components/primitives/Text';
import { Card, ThinDivider } from '../components/primitives/Surfaces';
import { Input, Button } from '../components/primitives/Controls';
import { Colors, Radius, Spacing } from '../theme/tokens';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [bankFilter, setBankFilter] = useState('All');
  const [selectedTxn, setSelectedTxn] = useState(null);
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

  const availableBanks = ['All', ...new Set(transactions.map((t) => t.bank).filter(Boolean))];

  const filteredTxns = transactions.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchM = (t.merchant || '').toLowerCase().includes(q);
      const matchB = (t.bank || '').toLowerCase().includes(q);
      const matchR = (t.rawText || '').toLowerCase().includes(q);
      if (!matchM && !matchB && !matchR) return false;
    }
    if (typeFilter === 'Debit' && t.type !== 'debit') return false;
    if (typeFilter === 'Credit' && t.type !== 'credit') return false;
    if (typeFilter === 'Needs Review' && !t.needsReview) return false;
    if (bankFilter !== 'All' && t.bank !== bankFilter) return false;
    return true;
  });

  const renderItem = ({ item }) => {
    const isDebit = item.type === 'debit';
    const amountColor = isDebit ? Colors.negative : Colors.positive;
    const formattedAmount = `${isDebit ? '-' : '+'}₹${Number(item.amount || 0).toLocaleString('en-IN')}`;

    return (
      <Card style={styles.txnCard} onPress={() => setSelectedTxn(item)}>
        <Row>
          <View style={[styles.avatar, { backgroundColor: isDebit ? Colors.negativeMuted : Colors.positiveMuted }]}>
            <Text style={[styles.avatarText, { color: amountColor }]}>
              {item.merchant ? item.merchant.charAt(0).toUpperCase() : '₹'}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <BodyText bold numberOfLines={1}>{item.merchant || item.sourceParser || 'Bank Transaction'}</BodyText>
            <BodyText small color={Colors.textMuted}>{item.bank || 'Bank'} • {item.instrument || 'SMS Alert'}</BodyText>
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
      </Card>
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Heading level={1}>Transactions</Heading>
        <Caption style={{ marginTop: 2 }}>{filteredTxns.length} records found</Caption>
      </View>

      <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }}>
        <Input
          placeholder="Search by merchant, bank, or text..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="🔍"
        />
      </View>

      <View style={{ marginBottom: Spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: Spacing.lg }}>
          {['All', 'Debit', 'Credit', 'Needs Review'].map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.pill, typeFilter === filter && styles.pillActive]}
              onPress={() => setTypeFilter(filter)}
            >
              <Text style={[styles.pillText, typeFilter === filter && styles.pillTextActive]}>{filter}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {availableBanks.length > 2 && (
        <View style={{ marginBottom: Spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: Spacing.lg }}>
            {availableBanks.map((bank) => (
              <TouchableOpacity
                key={bank}
                style={[styles.bankPill, bankFilter === bank && styles.bankPillActive]}
                onPress={() => setBankFilter(bank)}
              >
                <Text style={[styles.bankPillText, bankFilter === bank && styles.bankPillTextActive]}>{bank}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={filteredTxns}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: Spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accentLight} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <BodyText bold style={{ textAlign: 'center' }}>No matching transactions</BodyText>
            <BodyText small color={Colors.textMuted} style={{ textAlign: 'center', marginTop: 4 }}>
              Try adjusting your search query or filters.
            </BodyText>
          </View>
        }
      />

      {/* Transaction Details Modal */}
      {selectedTxn && (
        <Modal transparent animationType="slide" visible={!!selectedTxn}>
          <View style={styles.modalOverlay}>
            <Card elevated style={styles.modalCard}>
              <Row>
                <Heading level={2}>Details</Heading>
                <TouchableOpacity onPress={() => setSelectedTxn(null)}>
                  <BodyText color={Colors.textMuted}>✕</BodyText>
                </TouchableOpacity>
              </Row>

              <View style={{ alignItems: 'center', marginVertical: Spacing.xl }}>
                <DisplayText style={{ color: selectedTxn.type === 'debit' ? Colors.negative : Colors.positive }}>
                  {selectedTxn.type === 'debit' ? '-' : '+'}₹{Number(selectedTxn.amount || 0).toLocaleString('en-IN')}
                </DisplayText>
                <Heading level={2} style={{ marginTop: 4 }}>{selectedTxn.merchant || 'Bank Transaction'}</Heading>
              </View>

              <Stack space={Spacing.md}>
                <Row>
                  <Caption>Bank</Caption>
                  <BodyText bold small>{selectedTxn.bank || 'N/A'}</BodyText>
                </Row>
                <Row>
                  <Caption>Instrument</Caption>
                  <BodyText bold small>{selectedTxn.instrument || 'SMS Alert'}</BodyText>
                </Row>
                <Row>
                  <Caption>Source Parser</Caption>
                  <BodyText bold small>{selectedTxn.sourceParser || 'Deterministic Regex'}</BodyText>
                </Row>
                <Row>
                  <Caption>Date</Caption>
                  <BodyText bold small>{selectedTxn.date || 'Today'}</BodyText>
                </Row>
              </Stack>

              {selectedTxn.rawText ? (
                <View style={styles.rawBox}>
                  <Caption color={Colors.textSecondary}>Raw SMS Payload</Caption>
                  <BodyText small style={{ fontFamily: 'monospace', color: Colors.textSecondary, marginTop: 4 }}>
                    {selectedTxn.rawText}
                  </BodyText>
                </View>
              ) : null}

              <Button title="Close" variant="ghost" style={{ marginTop: Spacing.xl }} onPress={() => setSelectedTxn(null)} />
            </Card>
          </View>
        </Modal>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  txnCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  reviewBadge: {
    backgroundColor: Colors.warningMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.small,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  pillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: '#ffffff',
  },
  bankPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.medium,
    backgroundColor: Colors.background,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bankPillActive: {
    borderColor: Colors.accentLight,
    backgroundColor: Colors.surfaceElevated,
  },
  bankPillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
  },
  bankPillTextActive: {
    color: Colors.accentLight,
  },
  emptyBox: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    padding: Spacing.xl,
  },
  rawBox: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: Radius.medium,
    marginTop: Spacing.lg,
  },
});
