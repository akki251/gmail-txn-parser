import React from 'react';
import { Text, TextInput, View, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radius, spacing, typography } from '../../design';
import { Pressable } from './Pressable';

export function Button({ title, onPress, variant = 'primary', size = 'medium', style, textStyle, ...props }) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      accessibilityLabel={title}
      haptic
      scaleTo={0.96}
      onPress={onPress}
      style={[
        styles.button,
        isPrimary && styles.btnPrimary,
        isDanger && styles.btnDanger,
        isGhost && styles.btnGhost,
        size === 'small' && styles.btnSmall,
        style,
      ]}
      {...props}
    >
      <Text
        style={[
          styles.btnText,
          isPrimary && styles.btnTextPrimary,
          isDanger && styles.btnTextDanger,
          isGhost && styles.btnTextGhost,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Input({ placeholder, value, onChangeText, icon, style, ...props }) {
  return (
    <View style={[styles.inputContainer, style]}>
      {icon ? (typeof icon === 'string' ? <Text style={styles.inputIcon}>{icon}</Text> : icon) : null}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        style={styles.textInput}
        {...props}
      />
      {value ? (
        <TouchableOpacity onPress={() => onChangeText && onChangeText('')}>
          <Text style={styles.clearIcon}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.medium, // Master prompt says Radius: 12 for buttons
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnDanger: {
    backgroundColor: colors.expenseBackground,
    borderWidth: 1,
    borderColor: colors.expense,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  btnText: {
    ...typography.bodyBold,
  },
  btnTextPrimary: {
    color: '#ffffff',
  },
  btnTextDanger: {
    color: colors.expense,
  },
  btnTextGhost: {
    color: colors.textPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.body,
  },
  clearIcon: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: spacing.xs,
  },
});
