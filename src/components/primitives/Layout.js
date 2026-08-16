import React from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { colors, spacing } from '../../design';

export function ScreenContainer({ children, style, ...props }) {
  return (
    <SafeAreaView style={[styles.screen, style]} {...props}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      {children}
    </SafeAreaView>
  );
}

export function Stack({ children, space = spacing.md, style, ...props }) {
  return (
    <View style={[{ gap: space }, style]} {...props}>
      {children}
    </View>
  );
}

export function Row({ children, align = 'center', justify = 'space-between', space = spacing.md, style, ...props }) {
  return (
    <View style={[styles.row, { alignItems: align, justifyContent: justify, gap: space }, style]} {...props}>
      {children}
    </View>
  );
}

export function Section({ children, style, ...props }) {
  return (
    <View style={[styles.section, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
  },
  section: {
    marginBottom: spacing.xl,
  },
});
