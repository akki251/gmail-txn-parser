import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../design';
import { avatarColorFor } from '../../design/colors';
import { Pressable } from './Pressable';

// Single source of truth for every filter/tab-style pill in the app (type filters,
// bank filters, etc) — previously each screen hand-rolled its own pill styling
// with slightly different heights/radii/active-states, which read as inconsistent.
export function Pill({ label, active, onPress, style }) {
  return (
    <Pressable
      haptic
      scaleTo={0.94}
      enforceMinSize={false}
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive, style]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function DeltaChip({ value, positive, dark = false, style }) {
  const isUp = positive;
  const bg = isUp ? colors.incomeSoft : colors.expenseSoft;
  const fg = isUp ? colors.income : colors.expense;

  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      <Text style={[styles.chipText, { color: fg }]}>
        {isUp ? '↑' : '↓'} {value}
      </Text>
    </View>
  );
}

export function AvatarChip({ label, size = 44, style }) {
  const initials = (label || '₹').substring(0, 2).toUpperCase();
  const { bg, fg } = avatarColorFor(label);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }, style]}>
      <Text style={[styles.avatarText, { color: fg, fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  chipText: {
    ...typography.caption,
    fontWeight: '700',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.bodyBold,
  },
  pill: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    ...typography.bodySmallBold,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: '#ffffff',
  },
});
