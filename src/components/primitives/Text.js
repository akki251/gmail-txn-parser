import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { typography, colors } from '../../design';

export function DisplayText({ children, style, color = colors.textPrimary, ...props }) {
  return (
    <RNText style={[typography.display, { color }, style]} {...props}>
      {children}
    </RNText>
  );
}

export function Heading({ level = 1, children, style, color = colors.textPrimary, ...props }) {
  const headingStyle = level === 1 ? typography.h1 : level === 2 ? typography.h2 : typography.h3;
  return (
    <RNText style={[headingStyle, { color }, style]} {...props}>
      {children}
    </RNText>
  );
}

export function BodyText({ children, style, color = colors.textPrimary, bold = false, small = false, ...props }) {
  const textStyle = small ? (bold ? typography.bodySmallBold : typography.bodySmall) : (bold ? typography.bodyBold : typography.body);
  return (
    <RNText style={[textStyle, { color }, style]} {...props}>
      {children}
    </RNText>
  );
}

export function Caption({ children, style, color = colors.textMuted, ...props }) {
  return (
    <RNText style={[typography.caption, { color }, style]} {...props}>
      {children}
    </RNText>
  );
}
