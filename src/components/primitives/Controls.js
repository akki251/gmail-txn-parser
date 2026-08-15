import React from 'react';
import { TouchableOpacity, Text, TextInput, View, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../theme/tokens';

export function Button({ title, onPress, variant = 'primary', size = 'medium', style, textStyle, ...props }) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
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
    </TouchableOpacity>
  );
}

export function Input({ placeholder, value, onChangeText, icon, style, ...props }) {
  return (
    <View style={[styles.inputContainer, style]}>
      {icon ? <Text style={styles.inputIcon}>{icon}</Text> : null}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.accent,
  },
  btnDanger: {
    backgroundColor: Colors.negativeMuted,
    borderWidth: 1,
    borderColor: Colors.negative,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnSmall: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  btnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  btnTextPrimary: {
    color: '#ffffff',
  },
  btnTextDanger: {
    color: Colors.negative,
  },
  btnTextGhost: {
    color: Colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  clearIcon: {
    color: Colors.textMuted,
    fontSize: 14,
    paddingHorizontal: Spacing.xs,
  },
});
