import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, getCategoryColor } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { BottomSheetModal } from './BottomSheetModal';
import * as Haptics from 'expo-haptics';

export const FriendHistoryModal = ({
  visible,
  friend,
  onClose,
  onOpenSettle,
  onOpenTxnDetail,
}) => {
  const { transactions, ledgerSummary } = useApp();

  if (!friend) return null;

  const friendName = friend.friendName || friend.name || '';
  const netAmount = Number(friend.amount || 0);
  const isOwed = netAmount > 0;
  const isDebt = netAmount < 0;

  // Filter transactions where this friend is in shares
  const friendTxns = transactions.filter((t) => {
    if (!t) return false;
    if (t.shares && typeof t.shares === 'object') {
      return Object.keys(t.shares).some(
        (name) => name.toLowerCase() === friendName.toLowerCase()
      );
    }
    return false;
  });

  // Filter settlement history for this friend
  const friendSettlements = (ledgerSummary?.history || []).filter(
    (h) => (h.friendName || '').toLowerCase() === friendName.toLowerCase()
  );

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight={650}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.friendHeaderLeft}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: isOwed ? COLORS.incomeBg : isDebt ? COLORS.expenseBg : COLORS.bgSubtle },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: isOwed ? COLORS.income : isDebt ? COLORS.expense : COLORS.textSecondary },
              ]}
            >
              {friendName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.title}>{friendName}</Text>
            <Text style={styles.subtitle}>Split & Settlement History</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Balance Card with Quick Settle */}
        <View style={[styles.balanceCard, SHADOWS.sm]}>
          <View>
            <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
            <Text
              style={[
                styles.balanceAmount,
                isOwed ? styles.amountPositive : isDebt ? styles.amountNegative : styles.amountZero,
              ]}
            >
              {isOwed ? '+' : isDebt ? '−' : ''}₹
              {Math.abs(netAmount).toLocaleString('en-IN', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </Text>
            <Text style={styles.balanceDesc}>
              {isOwed
                ? `${friendName} owes you money`
                : isDebt
                ? `You owe ${friendName}`
                : 'All balances settled'}
            </Text>
          </View>

          {netAmount !== 0 && (
            <TouchableOpacity
              style={[
                styles.settleActionBtn,
                { backgroundColor: isOwed ? COLORS.income : COLORS.expense },
                SHADOWS.glow,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onClose();
                onOpenSettle && onOpenSettle(friend);
              }}
              activeOpacity={0.8}
            >
              <Feather name="check-circle" size={15} color="#fff" />
              <Text style={styles.settleActionBtnText}>Settle Up</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Split Transactions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              SPLIT TRANSACTIONS ({friendTxns.length})
            </Text>
          </View>

          {friendTxns.map((tx) => {
            const dateStr = tx.date
              ? new Date(tx.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
              : '';
            const catColor = getCategoryColor(tx.category || 'General');

            // Find their exact share
            let friendShare = 0;
            if (tx.shares) {
              const matchedKey = Object.keys(tx.shares).find(
                (k) => k.toLowerCase() === friendName.toLowerCase()
              );
              if (matchedKey) friendShare = Number(tx.shares[matchedKey]) || 0;
            }

            return (
              <TouchableOpacity
                key={tx.id}
                style={[styles.txnCard, SHADOWS.sm]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onClose();
                  onOpenTxnDetail && onOpenTxnDetail(tx);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.txnLeft}>
                  <View style={[styles.catDot, { backgroundColor: catColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.merchantName} numberOfLines={1}>
                      {tx.merchant || 'Expense'}
                    </Text>
                    <Text style={styles.txnMeta}>
                      {dateStr} • Total ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                <View style={styles.txnRight}>
                  <Text style={styles.shareAmt}>
                    +₹{friendShare.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={styles.shareLabel}>their share</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {friendTxns.length === 0 && (
            <View style={styles.emptyCard}>
              <Feather name="users" size={24} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>
                No shared transactions recorded with {friendName} yet.
              </Text>
            </View>
          )}
        </View>

        {/* Settlement Records Section */}
        {friendSettlements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              SETTLEMENT HISTORY ({friendSettlements.length})
            </Text>

            {friendSettlements.map((s, idx) => {
              const dateStr = s.date
                ? new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
                : 'Settled';
              return (
                <View key={`settle-${idx}`} style={styles.settleRow}>
                  <View style={styles.settleRowLeft}>
                    <Feather name="check" size={14} color={COLORS.income} />
                    <View>
                      <Text style={styles.settleRowTitle}>Recorded Payment</Text>
                      <Text style={styles.settleRowDate}>{dateStr}</Text>
                    </View>
                  </View>
                  <Text style={styles.settleRowAmt}>
                    ₹{Number(s.amount || 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  friendHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    maxHeight: 540,
  },
  scrollContent: {
    padding: 20,
    gap: 18,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginVertical: 2,
  },
  amountPositive: {
    color: COLORS.income,
  },
  amountNegative: {
    color: COLORS.expense,
  },
  amountZero: {
    color: COLORS.textSecondary,
  },
  balanceDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  settleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  settleActionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  catDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  merchantName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  txnMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  shareAmt: {
    color: COLORS.income,
    fontSize: 14,
    fontWeight: '700',
  },
  shareLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  settleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settleRowTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  settleRowDate: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  settleRowAmt: {
    color: COLORS.income,
    fontSize: 14,
    fontWeight: '700',
  },
});
