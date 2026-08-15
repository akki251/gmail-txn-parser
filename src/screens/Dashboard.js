import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import db from '../store/db';

import { DeviceEventEmitter } from 'react-native';

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    const subscription = DeviceEventEmitter.addListener('TRANSACTION_ADDED', () => {
      loadData();
    });
    return () => subscription.remove();
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

  const filteredTxns = transactions.filter((t) => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Debit') return t.type === 'debit';
    if (selectedFilter === 'Credit') return t.type === 'credit';
    if (selectedFilter === 'Needs Review') return t.needsReview;
    return true;
  });

  const totalSpent = transactions
    .filter((t) => t.type === 'debit' && !t.notATransaction)
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const totalCredited = transactions
    .filter((t) => t.type === 'credit' && !t.notATransaction)
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const renderTxnItem = ({ item }) => {
    const isDebit = item.type === 'debit';
    const amountColor = isDebit ? '#f43f5e' : '#10b981';
    const formattedAmount = `${isDebit ? '-' : '+'}₹${Number(item.amount || 0).toLocaleString('en-IN')}`;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedTxn(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconText}>
              {item.bank ? item.bank.charAt(0) : '₹'}
            </Text>
          </View>
          <View style={styles.cardMainInfo}>
            <Text style={styles.merchantTitle} numberOfLines={1}>
              {item.merchant || item.sourceParser || 'Bank Transaction'}
            </Text>
            <Text style={styles.bankSubtext}>
              {item.bank || 'Bank'} • {item.instrument || 'SMS Alert'}
            </Text>
          </View>
          <View style={styles.cardAmountContainer}>
            <Text style={[styles.amountText, { color: amountColor }]}>
              {formattedAmount}
            </Text>
            {item.needsReview && (
              <View style={styles.reviewPill}>
                <Text style={styles.reviewPillText}>Review</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Offline Ledger</Text>
        <Text style={styles.headerSubtitle}>Air-Gapped Bank SMS Parser</Text>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.spentCard]}>
          <Text style={styles.metricLabel}>Total Spent</Text>
          <Text style={styles.metricValue}>₹{totalSpent.toLocaleString('en-IN')}</Text>
        </View>
        <View style={[styles.metricCard, styles.creditedCard]}>
          <Text style={styles.metricLabel}>Total Received</Text>
          <Text style={styles.metricValue}>₹{totalCredited.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Filter Pills */}
      <View style={styles.filtersRow}>
        {['All', 'Debit', 'Credit', 'Needs Review'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterPill,
              selectedFilter === filter && styles.activeFilterPill,
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterPillText,
                selectedFilter === filter && styles.activeFilterPillText,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <FlatList
        data={filteredTxns}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderTxnItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions found</Text>
            <Text style={styles.emptySubtext}>
              Incoming bank SMS will appear here automatically.
            </Text>
          </View>
        }
      />

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <Modal
          visible={Boolean(selectedTxn)}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedTxn(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Transaction Details</Text>
                <TouchableOpacity onPress={() => setSelectedTxn(null)}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalBody}>
                <Text style={styles.modalAmount}>
                  ₹{Number(selectedTxn.amount || 0).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.modalMerchant}>
                  {selectedTxn.merchant || 'Bank Alert'}
                </Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank:</Text>
                  <Text style={styles.detailValue}>{selectedTxn.bank || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Instrument:</Text>
                  <Text style={styles.detailValue}>{selectedTxn.instrument || 'Account'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Parser Mode:</Text>
                  <Text style={styles.detailValue}>{selectedTxn.sourceParser || 'Regex'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{selectedTxn.date || selectedTxn.rawDate || 'Today'}</Text>
                </View>

                {selectedTxn.rawText && (
                  <View style={styles.rawTextContainer}>
                    <Text style={styles.rawTextLabel}>Raw SMS Payload:</Text>
                    <Text style={styles.rawTextContent}>{selectedTxn.rawText}</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 10,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  spentCard: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  creditedCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  metricLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 6,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeFilterPill: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterPillText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeFilterPillText: {
    color: '#ffffff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#818cf8',
  },
  cardMainInfo: {
    flex: 1,
  },
  merchantTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  bankSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  cardAmountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '700',
  },
  reviewPill: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  reviewPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  closeBtn: {
    fontSize: 20,
    color: '#94a3b8',
  },
  modalBody: {
    marginTop: 16,
  },
  modalAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
  },
  modalMerchant: {
    fontSize: 16,
    color: '#818cf8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  detailValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  rawTextContainer: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#0f172a',
    borderRadius: 12,
  },
  rawTextLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 6,
  },
  rawTextContent: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
