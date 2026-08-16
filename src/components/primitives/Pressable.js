import React from 'react';
import { Pressable as RNPressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

const SPRING = { damping: 16, stiffness: 260, mass: 0.5 };

export function Pressable({
  children,
  style,
  onPress,
  scaleTo = 0.96,
  haptic = false,
  disabled = false,
  enforceMinSize = true,
  ...props
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(scaleTo, SPRING);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING);
  };

  const handlePress = (e) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress && onPress(e);
  };

  return (
    <AnimatedPressable
      accessible
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      hitSlop={8}
      style={[enforceMinSize && { minWidth: 44, minHeight: 44 }, animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
