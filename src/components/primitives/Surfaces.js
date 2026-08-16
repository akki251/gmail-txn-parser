import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../design';
import { Pressable } from './Pressable';

export function Card({ children, style, onPress, ...props }) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      accessible={!!onPress}
      accessibilityRole={onPress ? "button" : "none"}
      {...(onPress ? { onPress, scaleTo: 0.98, haptic: true } : {})}
      style={[
        styles.card,
        style,
      ]}
      {...props}
    >
      {children}
    </Container>
  );
}

export function Surface({ children, style, ...props }) {
  return (
    <View style={[styles.surface, style]} {...props}>
      {children}
    </View>
  );
}

export function ThinDivider({ style, margin = spacing.md }) {
  return <View style={[styles.divider, { marginVertical: margin }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  surface: {
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
    padding: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    width: '100%',
  },
});
