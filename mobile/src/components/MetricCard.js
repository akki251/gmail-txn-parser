import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme/colors';

export const MetricCard = ({ label, value, trend, isPositiveTrend, subtitle, icon, iconColor, style }) => {
  return (
    <View style={[styles.card, SHADOWS.sm, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: `${iconColor || COLORS.primary}20` }]}>
            <Feather name={icon} size={14} color={iconColor || COLORS.primary} />
          </View>
        )}
      </View>

      <Text style={styles.value}>{value}</Text>

      {(trend !== undefined || subtitle) && (
        <View style={styles.footerRow}>
          {trend !== undefined && (
            <View
              style={[
                styles.trendPill,
                { backgroundColor: isPositiveTrend ? COLORS.incomeBg : COLORS.expenseBg },
              ]}
            >
              <Feather
                name={isPositiveTrend ? 'arrow-up-right' : 'arrow-down-right'}
                size={11}
                color={isPositiveTrend ? COLORS.income : COLORS.expense}
              />
              <Text
                style={[
                  styles.trendText,
                  { color: isPositiveTrend ? COLORS.income : COLORS.expense },
                ]}
              >
                {trend > 0 ? `+${trend}%` : `${trend}%`}
              </Text>
            </View>
          )}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
});
