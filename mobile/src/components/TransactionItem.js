import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, getBankMeta, getCategoryColor } from '../theme/colors';
import * as Haptics from 'expo-haptics';

export const TransactionItem = ({ transaction, onPress, onQuickSplit }) => {
  if (!transaction) return null;

  const {
    id,
    merchant,
    amount,
    currency = 'INR',
    type = 'debit',
    bank,
    date,
    category = 'General',
    splitStatus,
    shares = {},
    sourceIds = [],
    sourceParser = '',
    needsReview = false,
  } = transaction;

  const isCredit = type === 'credit';
  const bankMeta = getBankMeta(bank || sourceParser);
  const catColor = getCategoryColor(category);

  // Format Date & Time
  let timeStr = '';
  let dateStr = '';
  if (date) {
    const d = new Date(date);
    timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Format Channel Sources
  const isMultiSource = sourceIds && sourceIds.length > 1;
  const isSms = /SMS/i.test(sourceParser);

  // Split description
  const friendNames = Object.keys(shares || {});
  let splitLabel = '';
  if (splitStatus === 'split') {
    splitLabel = `Split with ${friendNames.slice(0, 2).join(', ')}${friendNames.length > 2 ? ` +${friendNames.length - 2}` : ''}`;
  } else if (splitStatus === 'personal') {
    splitLabel = 'Personal';
  } else {
    splitLabel = 'Unsplit';
  }

  return (
    <TouchableOpacity
      style={[styles.card, SHADOWS.sm, needsReview && styles.cardNeedsReview]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress && onPress(transaction);
      }}
      activeOpacity={0.7}
    >
      {/* Top Row: Bank Badge, Channel & Amount */}
      <View style={styles.topRow}>
        <View style={styles.leftMeta}>
          {/* Bank Badge */}
          <View style={[styles.bankBadge, { backgroundColor: bankMeta.bg, borderColor: bankMeta.border }]}>
            <Text style={[styles.bankBadgeText, { color: bankMeta.text }]}>{bankMeta.short}</Text>
          </View>

          {/* Multi-Source or Channel tag */}
          {isMultiSource ? (
            <View style={styles.mergedPill}>
              <Feather name="layers" size={10} color={COLORS.purple} />
              <Text style={styles.mergedText}>Reconciled (SMS+Mail)</Text>
            </View>
          ) : (
            <View style={styles.channelPill}>
              <MaterialCommunityIcons
                name={isSms ? 'cellphone-message' : 'email-outline'}
                size={11}
                color={COLORS.textMuted}
              />
              <Text style={styles.channelText}>{isSms ? 'SMS' : 'Email'}</Text>
            </View>
          )}
        </View>

        {/* Amount */}
        <Text style={[styles.amount, isCredit ? styles.amountIncome : styles.amountExpense]}>
          {isCredit ? '+' : '−'}₹{Number(amount || 0).toLocaleString('en-IN')}
        </Text>
      </View>

      {/* Middle Row: Merchant & Time */}
      <View style={styles.middleRow}>
        <Text style={styles.merchant} numberOfLines={1}>
          {needsReview ? 'Raw Bank Alert (Needs Review)' : merchant || 'Transaction'}
        </Text>
        <Text style={styles.time}>{timeStr || dateStr}</Text>
      </View>

      {/* Bottom Row: Category & Split Pill */}
      <View style={styles.bottomRow}>
        {/* Category Pill */}
        <View style={styles.categoryPill}>
          <View style={[styles.catDot, { backgroundColor: catColor }]} />
          <Text style={styles.categoryText}>{category}</Text>
        </View>

        {/* Split Status Pill */}
        <View
          style={[
            styles.splitPill,
            splitStatus === 'unsplit' && styles.splitPillUnsplit,
            splitStatus === 'split' && styles.splitPillSplit,
            splitStatus === 'personal' && styles.splitPillPersonal,
          ]}
        >
          <Text
            style={[
              styles.splitText,
              splitStatus === 'unsplit' && styles.splitTextUnsplit,
              splitStatus === 'split' && styles.splitTextSplit,
              splitStatus === 'personal' && styles.splitTextPersonal,
            ]}
          >
            {splitLabel}
          </Text>
        </View>
      </View>

      {/* Needs Review Alert Footer */}
      {needsReview && (
        <View style={styles.reviewBanner}>
          <Feather name="alert-triangle" size={12} color={COLORS.warning} />
          <Text style={styles.reviewText}>Unparsed template • Tap to review & heal with AI</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 14,
    marginVertical: 4,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardNeedsReview: {
    borderColor: COLORS.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  bankBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.bgSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  channelText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '500',
  },
  mergedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.purpleBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  mergedText: {
    color: COLORS.purple,
    fontSize: 10,
    fontWeight: '600',
  },
  amount: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  amountIncome: {
    color: COLORS.income,
  },
  amountExpense: {
    color: COLORS.text,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  merchant: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  time: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.bgSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  splitPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.bgSubtle,
  },
  splitPillUnsplit: {
    backgroundColor: COLORS.warningBg,
  },
  splitPillSplit: {
    backgroundColor: COLORS.incomeBg,
  },
  splitPillPersonal: {
    backgroundColor: COLORS.bgSubtle,
  },
  splitText: {
    fontSize: 11,
    fontWeight: '600',
  },
  splitTextUnsplit: {
    color: COLORS.warning,
  },
  splitTextSplit: {
    color: COLORS.income,
  },
  splitTextPersonal: {
    color: COLORS.textMuted,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.2)',
  },
  reviewText: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: '500',
  },
});
