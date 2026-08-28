import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { COLORS, SHADOWS } from '../theme/colors';
import * as Haptics from 'expo-haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;

export const AnimatedBorderCard = ({
  children,
  style,
  onPress,
  borderRadius = 18,
  glowColor = '#6366F1',
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const sheenAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Continuous Rotating Laser Border Beam
    const borderLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4500,
        useNativeDriver: true,
      })
    );

    // 2. Periodic Glass Sheen Light Sweep
    const sheenLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(sheenAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(sheenAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    borderLoop.start();
    sheenLoop.start();

    return () => {
      borderLoop.stop();
      sheenLoop.stop();
    };
  }, [rotateAnim, sheenAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sheenTranslateX = sheenAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      friction: 6,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 100,
    }).start();
  };

  const ContentWrapper = onPress ? TouchableOpacity : View;

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        { borderRadius: borderRadius + 2 },
        SHADOWS.md,
        { transform: [{ scale: scaleAnim }] },
        style,
      ]}
    >
      {/* Rotating Laser Gradient Border Background */}
      <View style={[styles.borderMask, { borderRadius: borderRadius + 2 }]}>
        <Animated.View
          style={[
            styles.laserWrapper,
            {
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <Svg width={SCREEN_WIDTH * 1.5} height={SCREEN_WIDTH * 1.5}>
            <Defs>
              <LinearGradient id="laserBeam" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#4F46E5" stopOpacity="0.8" />
                <Stop offset="25%" stopColor="#06B6D4" stopOpacity="0.9" />
                <Stop offset="50%" stopColor="#EC4899" stopOpacity="0.7" />
                <Stop offset="75%" stopColor="#8B5CF6" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#4F46E5" stopOpacity="0.8" />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width={SCREEN_WIDTH * 1.5}
              height={SCREEN_WIDTH * 1.5}
              fill="url(#laserBeam)"
            />
          </Svg>
        </Animated.View>
      </View>

      {/* Inner Card Surface */}
      <ContentWrapper
        style={[styles.innerCard, { borderRadius }]}
        onPress={() => {
          if (onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }
        }}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        activeOpacity={0.9}
      >
        {children}

        {/* Diagonal Light Sheen Overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sheenLayer,
            {
              transform: [{ translateX: sheenTranslateX }, { rotate: '-25deg' }],
            },
          ]}
        >
          <Svg width={120} height={350}>
            <Defs>
              <LinearGradient id="sheenGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.28" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={120} height={350} fill="url(#sheenGrad)" />
          </Svg>
        </Animated.View>
      </ContentWrapper>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    padding: 1.5,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.bgCard,
  },
  borderMask: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserWrapper: {
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCard: {
    backgroundColor: COLORS.bgCard,
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  sheenLayer: {
    position: 'absolute',
    top: -50,
    bottom: -50,
    width: 120,
  },
});
