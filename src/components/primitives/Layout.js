import React from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Colors, Spacing } from '../../theme/tokens';

export function ScreenContainer({ children, style, ...props }) {
  return (
    <SafeAreaView style={[styles.screen, style]} {...props}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      {children}
    </SafeAreaView>
  );
}

export function Stack({ children, space = Spacing.md, style, ...props }) {
  return (
    <View style={[{ gap: space }, style]} {...props}>
      {children}
    </View>
  );
}

export function Row({ children, align = 'center', justify = 'space-between', space = Spacing.md, style, ...props }) {
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
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
  },
  section: {
    marginBottom: Spacing.xl,
  },
});
