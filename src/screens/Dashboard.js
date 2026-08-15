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
  TextInput,
  DeviceEventEmitter,
} from 'react-native';
import db from '../store/db';
import SpendingChart from '../components/SpendingChart';

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');
  const [selectedBankFilter, setSelectedBankFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleClearAll = async () => {
    await db.clearAllData();
    await loadData();
    DeviceEventEmitter.emit('TRANSACTION_ADDED');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Get unique bank names for filter pills
  const availableBanks = ['All', ...new Set(transactions.map((t) => t.bank).filter(Boolean))];

  const filteredTxns = transactions.filter((t) => {
    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMerchant = (t.merchant || '').toLowerCase().includes(q);
      const matchBank = (t.bank || '').toLowerCase().includes(q);
      const matchRaw = (t.rawText || '').toLowerCase().includes(q);
      if (!matchMerchant && !matchBank && !matchRaw) return false;
    }

    // Type Filter
    if (selectedTypeFilter === 'Debit' && t.type !== 'debit') return false;
    if (selectedTypeFilter === 'Credit' && t.type !== 'credit') return false;
    if (selectedTypeFilter === 'Needs Review' && !t.needsReview) return false;

    // Bank Filter
    if (selectedBankFilter !== 'All' && t.bank !== selectedBankFilter) return false;

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
          <View style={[styles.iconBadge, { backgroundColor: isDebit ? '#881337' : '#064e3b' }]}>
            <Text style={[styles.iconText, { color: amountColor }]}>
              {item.bank ? item.bank.charAt(0) : '₹'}
            </Text>
          </View>
          <View style={styles.cardMainInfo}>
            <Text style={styles.merchantTitle} numberOfLines={1}>
              {item.merchant || item.sourceParser || 'Bank Transaction'}
            </Text>
            <Text style={styles.bankSubtext}>
              {item.bank || 'Bank SMS'} • {item.instrument || 'SMS Alert'}
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

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.headerTitle}>Offline Ledger</Text>
            <Text style={styles.headerSubtitle}>Air-Gapped Bank SMS Parser</Text>
          </View>
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>🗑️ Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, styles.spentCard]}>
          <Text style={styles.metricLabel}>Total Spent</Text>
          <Text style={[styles.metricValue, { color: '#f43f5e' }]}>₹{totalSpent.toLocaleString('en-IN')}</Text>
        </View>
        <View style={[styles.metricCard, styles.creditedCard]}>
          <Text style={styles.metricLabel}>Total Received</Text>
          <Text style={[styles.metricValue, { color: '#10b981' }]}>₹{totalCredited.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      <FlatList
        data={filteredTxns}
        keyExtractor={(item) => item.id}
        renderItem={renderTxnItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
        }
        ListHeaderComponent={
          <View>
            {/* Visual Spending Breakdown Graph */}
            <SpendingChart transactions={transactions} />

            {/* Search Input Bar */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search transactions, merchants, or banks..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Type Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
              {['All', 'Debit', 'Credit', 'Needs Review'].map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterPill,
                    selectedTypeFilter === filter && styles.filterPillActive,
                  ]}
                  onPress={() => setSelectedTypeFilter(filter)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedTypeFilter === filter && styles.filterPillTextActive,
                    ]}
                  >
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Bank Source Filters */}
            {availableBanks.length > 2 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankFiltersRow}>
                {availableBanks.map((bank) => (
                  <TouchableOpacity
                    key={bank}
                    style={[
                      styles.bankPill,
                      selectedBankFilter === bank && styles.bankPillActive,
                    ]}
                    onPress={() => setSelectedBankFilter(bank)}
                  >
                    <Text
                      style={[
                        styles.bankPillText,
                        selectedBankFilter === bank && styles.bankPillTextActive,
                      ]}
                    >
                      {bank}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching transactions found</Text>
            <Text style={styles.emptySubtext}>Incoming bank SMS alerts will automatically appear here.</Text>
          </View>
        }
      />

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <Modal transparent animationType="fade" visible={!!selectedTxn}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Transaction Details</Text>
                <TouchableOpacity onPress={() => setSelectedTxn(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={[styles.modalAmount, { color: selectedTxn.type === 'debit' ? '#f43f5e' : '#10b981' }]}>
                  {selectedTxn.type === 'debit' ? '-' : '+'}₹{Number(selectedTxn.amount || 0).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.modalMerchant}>{selectedTxn.merchant || 'Bank Transaction'}</Text>

                <View style={styles.modalRow}>
                  <Text style={styles.modalRowLabel}>Bank:</Text>
                  <Text style={styles.modalRowValue}>{selectedTxn.bank || 'N/A'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalRowLabel}>Instrument:</Text>
                  <Text style={styles.modalRowValue}>{selectedTxn.instrument || 'SMS Alert'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalRowLabel}>Parser Source:</Text>
                  <Text style={styles.modalRowValue}>{selectedTxn.sourceParser || 'Deterministic Regex'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalRowLabel}>Date:</Text>
                  <Text style={styles.modalRowValue}>{selectedTxn.date || 'Today'}</Text>
                </View>

                {selectedTxn.rawText ? (
                  <View style={styles.rawBox}>
                    <Text style={styles.rawBoxLabel}>Raw SMS Payload:</Text>
                    <Text style={styles.rawBoxText}>{selectedTxn.rawText}</Text>
                  </View>
                ) : null}
              </View>
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
    paddingBottom: 12,
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
  clearBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  clearBtnText: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '700',
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  spentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f43f5e',
  },
  creditedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  metricLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
  },
  clearSearchText: {
    color: '#94a3b8',
    fontSize: 16,
    paddingHorizontal: 6,
  },
  filtersRow: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterPillActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterPillText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  bankFiltersRow: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  bankPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bankPillActive: {
    backgroundColor: '#334155',
    borderColor: '#818cf8',
  },
  bankPillText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  bankPillTextActive: {
    color: '#818cf8',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardMainInfo: {
    flex: 1,
  },
  merchantTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  bankSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  cardAmountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  reviewPill: {
    backgroundColor: '#b45309',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  reviewPillText: {
    color: '#fef3c7',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  modalClose: {
    color: '#94a3b8',
    fontSize: 18,
    paddingHorizontal: 8,
  },
  modalBody: {
    alignItems: 'center',
  },
  modalAmount: {
    fontSize: 32,
    fontWeight: '800',
  },
  modalMerchant: {
    fontSize: 16,
    fontWeight: '700',
    color: '#cbd5e1',
    marginTop: 4,
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalRowLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  modalRowValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  rawBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    width: '100%',
  },
  rawBoxLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  rawBoxText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
