import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design';
import { BodyText, Caption } from './Text';
import { Pressable } from './Pressable';

function formatTransactionDate(dateValue) {
  if (!dateValue || dateValue === 'Today' || dateValue === 'Yesterday') return dateValue || 'Today';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Recent';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((startOfToday - startOfDate) / 86400000);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function TransactionRow({ item, onPress }) {
  const isDebit = item.type === 'debit';
  // Normal expenses are black, income is green, as per Editorial guidelines
  const amountColor = isDebit ? colors.textPrimary : colors.income;
  const formattedAmount = `${isDebit ? '−' : '+'}₹${Number(item.amount || 0).toLocaleString('en-IN')}`;

  const Container = onPress ? Pressable : View;
  const containerProps = onPress ? { onPress, scaleTo: 0.985 } : {};

  const dateStr = formatTransactionDate(item.date || item.rawDate);

  return (
    <Container style={styles.row} {...containerProps}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <BodyText style={{ fontSize: 16 }}>{item.merchant || item.sourceParser || 'Bank Transaction'}</BodyText>
        <Caption style={styles.metadata}>
          {item.category || item.bank || 'Transaction'} · {dateStr}
        </Caption>
      </View>

      <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start' }}>
        <BodyText style={{ color: amountColor, fontSize: 16 }}>{formattedAmount}</BodyText>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  metadata: {
    marginTop: 4, 
    textTransform: 'none', 
    color: colors.textSecondary, 
    letterSpacing: 0, 
    fontSize: 14, 
    fontFamily: 'Gilroy_Medium'
  }
});
