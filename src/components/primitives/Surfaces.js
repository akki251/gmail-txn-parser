import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Radius, Spacing } from '../../theme/tokens';

export function Card({ children, style, onPress, elevated = false, ...props }) {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        elevated && styles.elevated,
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

export function ThinDivider({ style, margin = Spacing.md }) {
  return <View style={[styles.divider, { marginVertical: margin }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.large,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.borderLight,
  },
  surface: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.medium,
    padding: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    width: '100%',
  },
});
