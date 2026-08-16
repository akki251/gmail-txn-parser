import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Modal,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import db from '../store/db';
import { ScreenContainer, Row, Stack } from '../components/primitives/Layout';
import { Heading, BodyText, Caption, DisplayText } from '../components/primitives/Text';
import { ThinDivider } from '../components/primitives/Surfaces';
import { Input, Button } from '../components/primitives/Controls';
import { Pill } from '../components/primitives/Chip';
import { colors, radius, spacing } from '../design';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { TransactionRow } from '../components/primitives/TransactionRow';
import { Feather } from '@expo/vector-icons';
import { ScrollView } from 'react-native';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [bankFilter, setBankFilter] = useState('All');
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [showRawText, setShowRawText] = useState(false);
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

  const filteredTxns = React.useMemo(() => {
    return transactions.filter((t) => {
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
  }, [transactions, searchQuery, typeFilter, bankFilter]);

  const renderItem = React.useCallback(({ item, index }) => {
    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index * 40, 400))}
        layout={LinearTransition}
      >
        <TransactionRow item={item} onPress={() => setSelectedTxn(item)} />
        {index < filteredTxns.length - 1 && <ThinDivider margin={0} style={{ marginHorizontal: spacing.lg, width: 'auto' }} />}
      </Animated.View>
    );
  }, [filteredTxns.length]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Row justify="space-between" align="center">
          <Heading level={1}>Transactions</Heading>
          <TouchableOpacity style={styles.filterButton}>
            <Feather name="filter" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </Row>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Input
          placeholder="Search activity..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<Feather name="search" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />}
        />
      </View>

      <View style={{ marginBottom: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {['All', 'Debit', 'Credit', 'Needs Review'].map((filter) => (
            <Pill
              key={filter}
              label={filter}
              active={typeFilter === filter}
              onPress={() => setTypeFilter(filter)}
            />
          ))}
        </ScrollView>
      </View>

      {availableBanks.length > 2 && (
        <View style={{ marginBottom: spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {availableBanks.map((bank) => (
              <Pill
                key={bank}
                label={bank}
                active={bankFilter === bank}
                onPress={() => setBankFilter(bank)}
                style={styles.bankPillSize}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Flat edge-to-edge list */}
      <View style={styles.listContainer}>
        {filteredTxns.length > 0 && (
          <Caption style={styles.dateHeader}>ALL TRANSACTIONS</Caption>
        )}
        <Animated.FlatList
          data={filteredTxns}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <BodyText bold style={{ textAlign: 'center' }}>No matching transactions</BodyText>
              <BodyText small color={colors.textMuted} style={{ textAlign: 'center', marginTop: 4 }}>
                Try adjusting your search query or filters.
              </BodyText>
            </View>
          }
        />
      </View>

      {/* Transaction Details Modal will be redesigned in Phase 9 */}
      {selectedTxn && (
        <Modal transparent animationType="slide" visible={!!selectedTxn}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Row style={{ marginBottom: spacing.xl, alignItems: 'center' }}>
                <Heading level={3}>Transaction Details</Heading>
                <TouchableOpacity 
                  onPress={() => { setSelectedTxn(null); setShowRawText(false); }} 
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <BodyText style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 18 }}>✕</BodyText>
                </TouchableOpacity>
              </Row>
              <View style={{ alignItems: 'center', marginBottom: spacing.xxxl }}>
                <DisplayText style={{ color: selectedTxn.type === 'debit' ? colors.textPrimary : colors.income, fontSize: 48, lineHeight: 52 }}>
                  {selectedTxn.type === 'debit' ? '−' : '+'}₹{Number(selectedTxn.amount || 0).toLocaleString('en-IN')}
                </DisplayText>
                <BodyText style={{ marginTop: spacing.sm, fontSize: 18, color: colors.textSecondary, textAlign: 'center' }}>
                  {selectedTxn.merchant || 'Bank Transaction'}
                </BodyText>
              </View>

              <Stack space={spacing.md} style={{ marginBottom: spacing.xl }}>
                <Row>
                  <Caption>Bank</Caption>
                  <BodyText>{selectedTxn.bank || 'N/A'}</BodyText>
                </Row>
                <Row>
                  <Caption>Instrument</Caption>
                  <BodyText>{selectedTxn.instrument || 'SMS Alert'}</BodyText>
                </Row>
                <Row>
                  <Caption>Date</Caption>
                  <BodyText>
                    {selectedTxn.date && selectedTxn.date !== 'Today' 
                      ? new Date(selectedTxn.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) 
                      : 'Today'}
                  </BodyText>
                </Row>
              </Stack>
              
              {/* Raw SMS Data Accordion */}
              {selectedTxn.rawText && (
                <View style={{ marginBottom: spacing.xl }}>
                  <TouchableOpacity onPress={() => setShowRawText(!showRawText)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
                    <Caption style={{ color: colors.primary }}>View Raw SMS Data</Caption>
                    <Feather name={showRawText ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                  </TouchableOpacity>
                  {showRawText && (
                    <View style={{ marginTop: spacing.xs, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
                      <BodyText small style={{ color: colors.textSecondary }}>{selectedTxn.rawText}</BodyText>
                      {selectedTxn.sourceParser && (
                        <Caption style={{ marginTop: spacing.sm, color: colors.textMuted }}>Parsed by: {selectedTxn.sourceParser}</Caption>
                      )}
                    </View>
                  )}
                </View>
              )}

              <Button title="Close" variant="ghost" onPress={() => { setSelectedTxn(null); setShowRawText(false); }} />
            </View>
          </View>
        </Modal>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  listContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dateHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  bankPillSize: {
    height: 30,
    paddingHorizontal: spacing.md,
  },
  emptyBox: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    paddingBottom: 40,
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
