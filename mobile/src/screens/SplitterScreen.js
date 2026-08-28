import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, getBankMeta, getCategoryColor } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Skeleton, TransactionItemSkeleton } from '../components/Skeleton';

export const SplitterScreen = ({ onOpenSplit, onOpenTxnDetail }) => {
  const { unsplitList, handleMarkPersonal, isLoading, isSyncing, refreshAll } = useApp();

  const totalUnsplitAmount = unsplitList.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );

  const onPersonalPress = async (tx) => {
    try {
      await handleMarkPersonal(tx.id);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to mark as personal');
    }
  };

  if (isLoading && unsplitList.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ gap: 6 }}>
            <Skeleton width={100} height={12} borderRadius={4} />
            <Skeleton width={140} height={22} borderRadius={6} />
          </View>
          <Skeleton width={80} height={36} borderRadius={10} />
        </View>
        <View style={{ paddingTop: 8 }}>
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
          <TransactionItemSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero Summary Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerCaption}>PENDING SPLITS</Text>
          <Text style={styles.headerCount}>
            {unsplitList.length} {unsplitList.length === 1 ? 'Transaction' : 'Transactions'}
          </Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalAmount}>₹{totalUnsplitAmount.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      {/* Unsplit Items List */}
      <FlatList
        data={unsplitList}
        keyExtractor={(item) => item.id}
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
          const bankMeta = getBankMeta(item.bank || item.sourceParser);
          const catColor = getCategoryColor(item.category);
          const dateStr = item.date
            ? new Date(item.date).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              })
            : '';

          return (
            <View style={styles.card}>
              <TouchableOpacity
                onPress={() => onOpenTxnDetail && onOpenTxnDetail(item)}
                activeOpacity={0.7}
              >
                {/* Top Info */}
                <View style={styles.cardTop}>
                  <View style={styles.bankAndCat}>
                    <View
                      style={[
                        styles.bankTag,
                        { backgroundColor: bankMeta.bg, borderColor: bankMeta.border },
                      ]}
                    >
                      <Text style={[styles.bankTagText, { color: bankMeta.text }]}>
                        {bankMeta.short}
                      </Text>
                    </View>
                    <View style={styles.catPill}>
                      <View style={[styles.catDot, { backgroundColor: catColor }]} />
                      <Text style={styles.catText}>{item.category || 'General'}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardAmount}>
                    −₹{Number(item.amount || 0).toLocaleString('en-IN')}
                  </Text>
                </View>

                {/* Merchant & Date */}
                <View style={styles.cardMiddle}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {item.merchant || 'Bank Transaction'}
                  </Text>
                  <Text style={styles.date}>{dateStr}</Text>
                </View>
              </TouchableOpacity>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.personalBtn}
                  onPress={() => onPersonalPress(item)}
                  activeOpacity={0.7}
                >
                  <Feather name="user" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.personalBtnText}>Mark Personal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.splitBtn}
                  onPress={() => onOpenSplit && onOpenSplit(item)}
                  activeOpacity={0.7}
                >
                  <Feather name="users" size={14} color="#fff" />
                  <Text style={styles.splitBtnText}>Split Expense</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MaterialCommunityIcons name="check-decagram" size={42} color={COLORS.income} />
            </View>
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySubtitle}>
              You have no pending unsplit transactions. New alerts from Gmail or SMS will appear here automatically.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  headerCaption: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  headerCount: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  totalBadge: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-end',
  },
  totalLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  totalAmount: {
    color: COLORS.warning,
    fontSize: 15,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankAndCat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  bankTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.bgSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  catText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  cardAmount: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 14,
  },
  merchant: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  date: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 12,
  },
  personalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personalBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  splitBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  splitBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.incomeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
