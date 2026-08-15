import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { Typography, Colors } from '../../theme/tokens';

export function DisplayText({ children, style, color = Colors.textPrimary, ...props }) {
  return (
    <RNText style={[Typography.display, { color }, style]} {...props}>
      {children}
    </RNText>
  );
}

export function Heading({ level = 1, children, style, color = Colors.textPrimary, ...props }) {
  const headingStyle = level === 1 ? Typography.h1 : level === 2 ? Typography.h2 : Typography.h3;
  return (
    <RNText style={[headingStyle, { color }, style]} {...props}>
      {children}
    </RNText>
  );
}

export function BodyText({ children, style, color = Colors.textPrimary, bold = false, small = false, ...props }) {
  const textStyle = small ? Typography.bodySmall : bold ? Typography.bodyBold : Typography.body;
  return (
    <RNText style={[textStyle, { color }, style]} {...props}>
      {children}
    </RNText>
  );
}

export function Caption({ children, style, color = Colors.textMuted, ...props }) {
  return (
    <RNText style={[Typography.caption, { color }, style]} {...props}>
      {children}
    </RNText>
  );
}
