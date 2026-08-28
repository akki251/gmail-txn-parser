import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, getBankMeta, getCategoryColor } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { BottomSheetModal } from './BottomSheetModal';

export const TransactionDetailModal = ({
  visible,
  transaction,
  onClose,
  onOpenSplit,
  onOpenCategoryPicker,
}) => {
  const { handleMarkPersonal, handleAcknowledge, handleRetryReview } = useApp();
  const [isRetrying, setIsRetrying] = useState(false);

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
    rawText,
    refNo,
    last4,
    acknowledged = true,
  } = transaction;

  const isCredit = type === 'credit';
  const bankMeta = getBankMeta(bank || sourceParser);
  const catColor = getCategoryColor(category);

  let formattedDate = '';
  if (date) {
    const d = new Date(date);
    formattedDate = d.toLocaleString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const onPersonalPress = async () => {
    try {
      await handleMarkPersonal(id);
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to mark personal');
    }
  };

  const onRetryAI = async () => {
    setIsRetrying(true);
    try {
      if (handleRetryReview) {
        await handleRetryReview(id);
      }
      onClose();
    } catch (err) {
      Alert.alert('AI Extraction Failed', err.message || 'Could not parse transaction');
    } finally {
      setIsRetrying(false);
    }
  };

  const onAcknowledgeToggle = async () => {
    try {
      await handleAcknowledge(id, !acknowledged);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update acknowledged state');
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      {/* Header Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transaction Details</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Amount Hero */}
        <View style={styles.amountHero}>
          <Text style={[styles.amountText, isCredit ? styles.amountIncome : styles.amountExpense]}>
            {isCredit ? '+' : '−'}₹{Number(amount || 0).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.merchantText}>
            {needsReview ? 'Unparsed Alert' : merchant || 'Bank Transaction'}
          </Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { borderColor: COLORS.primary }]}
            onPress={() => {
              onClose();
              onOpenSplit && onOpenSplit(transaction);
            }}
          >
            <Feather name="users" size={18} color={COLORS.primary} />
            <Text style={styles.actionCardText}>
              {splitStatus === 'split' ? 'Edit Split' : 'Split Expense'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionCard,
              splitStatus === 'personal' && { backgroundColor: COLORS.bgSubtle },
            ]}
            onPress={onPersonalPress}
          >
            <Feather name="user" size={18} color={COLORS.textSecondary} />
            <Text style={styles.actionCardText}>
              {splitStatus === 'personal' ? 'Personal ✓' : 'Mark Personal'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => {
              onClose();
              onOpenCategoryPicker && onOpenCategoryPicker(transaction);
            }}
          >
            <Feather name="tag" size={18} color={COLORS.textSecondary} />
            <Text style={styles.actionCardText}>{category}</Text>
          </TouchableOpacity>
        </View>

        {/* Details Section */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bank / Source</Text>
            <View style={styles.detailValueRow}>
              <View style={[styles.bankDot, { backgroundColor: bankMeta.color }]} />
              <Text style={styles.detailValue}>{bank || sourceParser || 'Unknown'}</Text>
            </View>
          </View>

          {last4 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Card / Account</Text>
              <Text style={styles.detailValue}>•••• {last4}</Text>
            </View>
          )}

          {refNo && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference No.</Text>
              <Text style={styles.detailValue}>{refNo}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <View style={styles.detailValueRow}>
              <View style={[styles.bankDot, { backgroundColor: catColor }]} />
              <Text style={styles.detailValue}>{category}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Channel Sources</Text>
            <Text style={styles.detailValue}>
              {sourceIds.length > 1
                ? `Fused (${sourceIds.length} messages)`
                : /SMS/i.test(sourceParser)
                ? 'SMS Parse'
                : 'Gmail Sync'}
            </Text>
          </View>
        </View>

        {/* Split Details Card if split */}
        {splitStatus === 'split' && Object.keys(shares).length > 0 && (
          <View style={styles.splitCard}>
            <Text style={styles.splitCardTitle}>Split Breakdown</Text>
            {Object.entries(shares).map(([friend, amt]) => (
              <View key={friend} style={styles.splitRow}>
                <Text style={styles.splitFriend}>{friend}</Text>
                <Text style={styles.splitAmt}>₹{amt.toLocaleString('en-IN')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Raw Text Card */}
        {rawText && (
          <View style={styles.rawCard}>
            <Text style={styles.rawTitle}>Raw Sync Message</Text>
            <Text style={styles.rawContent} numberOfLines={8} selectable>
              {rawText}
            </Text>
          </View>
        )}

        {/* AI Retry Button for unparsed / needs review */}
        {needsReview && (
          <View style={styles.aiRetrySection}>
            <Text style={styles.aiRetryDesc}>
              This notification couldn't be parsed automatically. Tap below to run AI extraction.
            </Text>
            <TouchableOpacity
              style={styles.aiButton}
              onPress={onRetryAI}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="robot-outline" size={18} color="#fff" />
                  <Text style={styles.aiButtonText}>Retry AI Extraction</Text>
                </>
              )}
            </TouchableOpacity>
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
  headerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
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
    maxHeight: 520,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  amountHero: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  amountText: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  amountIncome: {
    color: COLORS.income,
  },
  amountExpense: {
    color: COLORS.text,
  },
  merchantText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  dateText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionCardText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bankDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  splitCard: {
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  splitCardTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitFriend: {
    color: COLORS.text,
    fontSize: 13,
  },
  splitAmt: {
    color: COLORS.income,
    fontSize: 13,
    fontWeight: '700',
  },
  rawCard: {
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rawTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rawContent: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  aiRetrySection: {
    backgroundColor: COLORS.warningBg,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  aiRetryDesc: {
    color: COLORS.warning,
    fontSize: 12,
    lineHeight: 17,
  },
  aiButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
