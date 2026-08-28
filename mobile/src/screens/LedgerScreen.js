import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Skeleton, LedgerRowSkeleton } from '../components/Skeleton';
import { AnimatedBorderCard } from '../components/AnimatedBorderCard';

export const LedgerScreen = ({ onOpenSettle, onOpenHistory }) => {
  const { ledgerSummary, isLoading, isSyncing, refreshAll } = useApp();
  const { netBalance, owesYou, youOwe, history } = ledgerSummary;

  if (isLoading && owesYou.length === 0 && youOwe.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Net Card Skeleton */}
        <View style={styles.netCard}>
          <Skeleton width={90} height={12} borderRadius={4} />
          <Skeleton width={140} height={36} borderRadius={8} style={{ marginVertical: 8 }} />
          <Skeleton width={180} height={14} borderRadius={4} />
        </View>

        {/* Section Skeleton */}
        <View style={styles.section}>
          <Skeleton width={120} height={12} borderRadius={4} style={{ marginHorizontal: 20, marginBottom: 10 }} />
          <View style={styles.cardGroup}>
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isSyncing}
          onRefresh={() => refreshAll()}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {/* Hero Net Balance Card with Laser Border */}
      <AnimatedBorderCard borderRadius={18} style={{ marginHorizontal: 0 }}>
        <View style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Text style={styles.netCaption}>NET BALANCE</Text>
          <Text
            style={[
              styles.netAmount,
              netBalance > 0
                ? styles.amountPositive
                : netBalance < 0
                ? styles.amountNegative
                : styles.amountZero,
            ]}
          >
            {netBalance > 0 ? '+' : netBalance < 0 ? '−' : ''}₹
            {Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.netDesc}>
            {netBalance > 0
              ? 'Overall, friends owe you money'
              : netBalance < 0
              ? 'Overall, you owe money to friends'
              : 'All shared balances are completely settled'}
          </Text>
        </View>
      </AnimatedBorderCard>

      {/* Friends Who Owe You */}
      {owesYou.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OWED TO YOU</Text>
          <View style={styles.cardGroup}>
            {owesYou.map((f) => (
              <TouchableOpacity
                key={f.friendName}
                style={styles.friendRow}
                onPress={() => onOpenHistory && onOpenHistory(f)}
                activeOpacity={0.7}
              >
                <View style={styles.friendLeft}>
                  <View style={[styles.avatar, { backgroundColor: COLORS.incomeBg }]}>
                    <Text style={[styles.avatarText, { color: COLORS.income }]}>
                      {f.friendName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName} numberOfLines={1}>
                      {f.friendName}
                    </Text>
                    <Text style={styles.friendSub} numberOfLines={1}>
                      Owes you • Tap for history
                    </Text>
                  </View>
                </View>

                <View style={styles.friendRight}>
                  <Text style={styles.owedAmount}>
                    +₹{f.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </Text>
                  <TouchableOpacity
                    style={styles.settleBtn}
                    onPress={(e) => {
                      e.stopPropagation && e.stopPropagation();
                      onOpenSettle && onOpenSettle(f);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.settleBtnText}>Settle</Text>
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={14} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Friends You Owe */}
      {youOwe.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOU OWE</Text>
          <View style={styles.cardGroup}>
            {youOwe.map((f) => (
              <TouchableOpacity
                key={f.friendName}
                style={styles.friendRow}
                onPress={() => onOpenHistory && onOpenHistory(f)}
                activeOpacity={0.7}
              >
                <View style={styles.friendLeft}>
                  <View style={[styles.avatar, { backgroundColor: COLORS.expenseBg }]}>
                    <Text style={[styles.avatarText, { color: COLORS.expense }]}>
                      {f.friendName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName} numberOfLines={1}>
                      {f.friendName}
                    </Text>
                    <Text style={styles.friendSub} numberOfLines={1}>
                      You owe • Tap for history
                    </Text>
                  </View>
                </View>

                <View style={styles.friendRight}>
                  <Text style={styles.youOweAmount}>
                    −₹{f.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </Text>
                  <TouchableOpacity
                    style={[styles.settleBtn, { backgroundColor: COLORS.expenseBg }]}
                    onPress={(e) => {
                      e.stopPropagation && e.stopPropagation();
                      onOpenSettle && onOpenSettle(f);
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={[styles.settleBtnText, { color: COLORS.expense }]}>Settle</Text>
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={14} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Empty State if no balances */}
      {owesYou.length === 0 && youOwe.length === 0 && (
        <View style={styles.emptyCard}>
          <Ionicons name="sparkles-outline" size={32} color={COLORS.income} />
          <Text style={styles.emptyTitle}>Zero Outstanding Debts</Text>
          <Text style={styles.emptyDesc}>
            Split transactions with friends from the Split tab to start tracking shared balances here.
          </Text>
        </View>
      )}

      {/* Activity / Settlement History */}
      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LEDGER HISTORY</Text>
          <View style={styles.cardGroup}>
            {history.slice(0, 10).map((h, i) => (
              <View key={h.id || i} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <View
                    style={[
                      styles.historyIcon,
                      {
                        backgroundColor:
                          h.type === 'settle' ? COLORS.incomeBg : COLORS.bgSubtle,
                      },
                    ]}
                  >
                    <Feather
                      name={h.type === 'settle' ? 'check' : 'users'}
                      size={13}
                      color={h.type === 'settle' ? COLORS.income : COLORS.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {h.type === 'settle'
                        ? `Settled with ${h.friendName}`
                        : `${h.merchant || 'Split'} with ${h.friendName}`}
                    </Text>
                    <Text style={styles.historyDate}>
                      {h.date ? new Date(h.date).toLocaleDateString() : ''}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.historyAmount,
                    h.type === 'settle' ? { color: COLORS.income } : { color: COLORS.text },
                  ]}
                >
                  ₹{Number(h.amount || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  netCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  netCaption: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  netAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginVertical: 4,
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
  netDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  cardGroup: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  friendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  friendInfo: {
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  friendName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  friendSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  friendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  owedAmount: {
    color: COLORS.income,
    fontSize: 14,
    fontWeight: '700',
  },
  youOweAmount: {
    color: COLORS.expense,
    fontSize: 14,
    fontWeight: '700',
  },
  settleBtn: {
    backgroundColor: COLORS.incomeBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  settleBtnText: {
    color: COLORS.income,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  historyIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  historyDate: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
});
