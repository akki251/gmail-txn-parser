import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable } from '../primitives/Pressable';
import { colors, spacing, radius } from '../../design';

const ICONS = {
  Home: 'home',
  Txns: 'list', // more editorial than credit-card
  Insights: 'pie-chart',
  Review: 'zap',
  Settings: 'settings',
};

export function TabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.floatingContainer}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const iconName = ICONS[route.name] || 'circle';

          const onPress = () => {
            Haptics.selectionAsync();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              scaleTo={0.85}
              style={[
                styles.tab,
                isFocused && { backgroundColor: 'rgba(0,0,0,0.04)' }
              ]}
            >
              <Feather
                name={iconName}
                size={22}
                color={isFocused ? colors.black : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    // Minimal shadow for floating tab bar to separate from pure white content
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  container: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: colors.surface, 
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    marginHorizontal: 4,
  },
});
