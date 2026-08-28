import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { parseTxnDate } from '../data/localStore';
import { TransactionItem } from '../components/TransactionItem';
import { TransactionItemSkeleton } from '../components/Skeleton';
import { DateRangePickerModal } from '../components/DateRangePickerModal';
import * as Haptics from 'expo-haptics';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'debit', label: 'Debit' },
  { id: 'credit', label: 'Credit' },
  { id: 'unsplit', label: 'Unsplit' },
  { id: 'needsReview', label: 'Needs Review' },
  { id: 'unacknowledged', label: 'Unread' },
];

export const TransactionsScreen = ({
  onOpenTxnDetail,
  onOpenSplit,
}) => {
  const { transactions, isLoading, isSyncing, refreshAll } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Date Range state
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isDateModalVisible, setIsDateModalVisible] = useState(false);

  // Filtered transactions
  const filteredTxns = useMemo(() => {
    return transactions.filter((tx) => {
      if (!tx) return false;

      // Date Range Filter
      if (startDate || endDate) {
        const d = parseTxnDate(tx);
        if (!d) return false;
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
      }

      // Filter chip
      if (activeFilter === 'debit' && tx.type !== 'debit') return false;
      if (activeFilter === 'credit' && tx.type !== 'credit') return false;
      if (activeFilter === 'unsplit' && tx.splitStatus !== 'unsplit') return false;
      if (activeFilter === 'needsReview' && !tx.needsReview) return false;
      if (activeFilter === 'unacknowledged' && tx.acknowledged !== false) return false;

      // Category filter
      if (selectedCategory && tx.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const merchantMatch = (tx.merchant || '').toLowerCase().includes(query);
        const bankMatch = (tx.bank || '').toLowerCase().includes(query);
        const amountMatch = String(tx.amount || '').includes(query);
        const refMatch = (tx.refNo || '').toLowerCase().includes(query);
        const catMatch = (tx.category || '').toLowerCase().includes(query);
        if (!merchantMatch && !bankMatch && !amountMatch && !refMatch && !catMatch) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, startDate, endDate, activeFilter, selectedCategory, searchQuery]);

  // Group by date
  const groupedData = useMemo(() => {
    const groups = [];
    let currentHeader = null;
    let currentItems = [];

    filteredTxns.forEach((tx) => {
      let headerTitle = 'Earlier';
      if (tx.date) {
        const d = parseTxnDate(tx);
        if (d) {
          const now = new Date();
          const isToday =
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();

          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const isYesterday =
            d.getDate() === yesterday.getDate() &&
            d.getMonth() === yesterday.getMonth() &&
            d.getFullYear() === yesterday.getFullYear();

          if (isToday) {
            headerTitle = 'Today';
          } else if (isYesterday) {
            headerTitle = 'Yesterday';
          } else {
            headerTitle = d.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
          }
        }
      }

      if (headerTitle !== currentHeader) {
        if (currentHeader !== null) {
          groups.push({ type: 'header', title: currentHeader });
          currentItems.forEach((item) => groups.push({ type: 'item', data: item }));
        }
        currentHeader = headerTitle;
        currentItems = [tx];
      } else {
        currentItems.push(tx);
      }
    });

    if (currentHeader !== null) {
      groups.push({ type: 'header', title: currentHeader });
      currentItems.forEach((item) => groups.push({ type: 'item', data: item }));
    }

    return groups;
  }, [filteredTxns]);

  const hasActiveDateRange = Boolean(startDate || endDate);

  const dateRangeLabel = useMemo(() => {
    if (!startDate && !endDate) return 'Date Range';
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    }
    if (startDate) {
      return `From ${startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    }
    return `Until ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  }, [startDate, endDate]);

  return (
    <View style={styles.container}>
      {/* Top Filter Bar: Search Input + Date Filter Button */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search merchant, bank, amount..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Date Filter Trigger Button */}
        <TouchableOpacity
          style={[
            styles.dateFilterBtn,
            hasActiveDateRange && styles.dateFilterBtnActive,
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setIsDateModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Feather
            name="calendar"
            size={14}
            color={hasActiveDateRange ? COLORS.textInverse : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.dateFilterText,
              hasActiveDateRange && styles.dateFilterTextActive,
            ]}
            numberOfLines={1}
          >
            {dateRangeLabel}
          </Text>
          {hasActiveDateRange && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setStartDate(null);
                setEndDate(null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={14} color={COLORS.textInverse} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Chips Carousel */}
      <View style={styles.filtersWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filtersContent}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.id;
            return (
              <TouchableOpacity
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(item.id)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Grouped Transactions List */}
      {isLoading && transactions.length === 0 ? (
        <View style={{ paddingTop: 8 }}>
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
        </View>
      ) : (
        <FlatList
          data={groupedData}
          keyExtractor={(item, index) =>
            item.type === 'header' ? `header-${item.title}-${index}` : item.data.id
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isSyncing}
              onRefresh={() => refreshAll()}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>{item.title}</Text>
                </View>
              );
            }
            return (
              <TransactionItem
                transaction={item.data}
                onPress={onOpenTxnDetail}
                onQuickSplit={onOpenSplit}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="search" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No matching transactions</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search query or date range</Text>
            </View>
          }
        />
      )}

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        visible={isDateModalVisible}
        onClose={() => setIsDateModalVisible(false)}
        startDate={startDate}
        endDate={endDate}
        onApplyRange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
        transactions={transactions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    marginLeft: 8,
    marginRight: 6,
  },
  dateFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateFilterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateFilterText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 110,
  },
  dateFilterTextActive: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  filtersWrapper: {
    paddingBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: COLORS.textInverse,
  },
  listContent: {
    paddingBottom: 40,
  },
  dateHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  dateHeaderText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
