import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme/colors';
import { useApp } from '../context/AppContext';
import * as Haptics from 'expo-haptics';

export const Header = ({ onOpenSettings, onOpenAdd }) => {
  const { isConnected, isSyncing, isRefreshingMail, handleTriggerSync, metrics } = useApp();
  const spinAnim = useRef(new Animated.Value(0)).current;

  const isBusy = isSyncing || isRefreshingMail;

  useEffect(() => {
    if (isBusy) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [isBusy]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Brand & Sync Status */}
      <View style={styles.brandContainer}>
        <View style={[styles.badge, SHADOWS.glow]}>
          <Text style={styles.badgeText}>₹</Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Finances</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isConnected ? COLORS.income : COLORS.purple },
              ]}
            />
            <Text style={styles.statusText}>
              {isConnected ? 'GCP Synced' : 'Offline Mode'}
            </Text>
            {metrics.needsReviewCount > 0 && (
              <View style={styles.reviewBadge}>
                <Text style={styles.reviewBadgeText}>{metrics.needsReviewCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 3 Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Quick Add Button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onOpenAdd();
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.actionBtn, styles.addBtn, SHADOWS.glow]}>
            <Feather name="plus" size={18} color={COLORS.textInverse} />
          </View>
        </TouchableOpacity>

        {/* Sync Trigger Button */}
        <TouchableOpacity
          style={[styles.actionBtn, isBusy && styles.actionBtnActive, SHADOWS.sm]}
          onPress={() => {
            Haptics.selectionAsync();
            handleTriggerSync();
          }}
          disabled={isBusy}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Feather name="refresh-cw" size={15} color={isBusy ? COLORS.primary : COLORS.textSecondary} />
          </Animated.View>
        </TouchableOpacity>

        {/* Settings Button */}
        <TouchableOpacity
          style={[styles.actionBtn, SHADOWS.sm]}
          onPress={() => {
            Haptics.selectionAsync();
            onOpenSettings();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: COLORS.textInverse,
    fontSize: 18,
    fontWeight: '800',
  },
  titleWrap: {
    justifyContent: 'center',
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  reviewBadge: {
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 3,
  },
  reviewBadgeText: {
    color: COLORS.warning,
    fontSize: 9,
    fontWeight: '700',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  actionBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryGlow,
  },
});
