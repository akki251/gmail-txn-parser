import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SpendingChart({ transactions = [] }) {
  // Aggregate transactions by merchant / category
  const merchantTotals = {};
  let maxAmount = 1;

  transactions
    .filter((t) => t.type === 'debit' && !t.notATransaction && t.amount > 0)
    .forEach((t) => {
      const name = t.merchant || t.bank || 'Other';
      merchantTotals[name] = (merchantTotals[name] || 0) + t.amount;
      if (merchantTotals[name] > maxAmount) maxAmount = merchantTotals[name];
    });

  const sortedCategories = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sortedCategories.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyChartText}>No spending data recorded yet</Text>
      </View>
    );
  }

  const colors = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b'];

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Top Spending Breakdown</Text>
      {sortedCategories.map(([merchant, amount], index) => {
        const percentage = Math.min(100, Math.round((amount / maxAmount) * 100));
        const barColor = colors[index % colors.length];

        return (
          <View key={merchant} style={styles.barRow}>
            <View style={styles.barLabelContainer}>
              <Text style={styles.merchantLabel} numberOfLines={1}>{merchant}</Text>
              <Text style={styles.amountLabel}>₹{amount.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: barColor }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chartTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  barRow: {
    marginBottom: 12,
  },
  barLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  merchantLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '70%',
  },
  amountLabel: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyChart: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyChartText: {
    color: '#64748b',
    fontSize: 13,
  },
});
