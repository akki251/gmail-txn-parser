import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Path, Rect, Circle } from 'react-native-svg';
import { COLORS } from '../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export const LiquidMeshWave = ({ height = 180, style }) => {
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const orbAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Wave 1 animation loop
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim1, {
          toValue: 1,
          duration: 6000,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim1, {
          toValue: 0,
          duration: 6000,
          useNativeDriver: true,
        }),
      ])
    );

    // Wave 2 offset loop
    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim2, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim2, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    );

    // Orb float loop
    const animOrb = Animated.loop(
      Animated.sequence([
        Animated.timing(orbAnim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(orbAnim, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    );

    anim1.start();
    anim2.start();
    animOrb.start();

    return () => {
      anim1.stop();
      anim2.stop();
      animOrb.stop();
    };
  }, [waveAnim1, waveAnim2, orbAnim]);

  // Interpolated transforms for 3D liquid wave illusion
  const translateX1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 20],
  });
  const translateY1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 10],
  });

  const translateX2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [25, -25],
  });
  const translateY2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -8],
  });

  const orbScale = orbAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.95, 1.08, 0.95],
  });

  return (
    <View style={[styles.container, { height }, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${SCREEN_WIDTH} ${height}`}>
        <Defs>
          {/* Liquid Aurora Primary Gradient */}
          <LinearGradient id="liquidGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4F46E5" stopOpacity="0.16" />
            <Stop offset="50%" stopColor="#7C3AED" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#06B6D4" stopOpacity="0.04" />
          </LinearGradient>

          {/* Liquid Aurora Secondary Gradient */}
          <LinearGradient id="liquidGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#6366F1" stopOpacity="0.14" />
            <Stop offset="60%" stopColor="#EC4899" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.02" />
          </LinearGradient>

          {/* Glowing 3D Radial Core */}
          <RadialGradient id="glowCore" cx="70%" cy="30%" rx="60%" ry="60%">
            <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.25" />
            <Stop offset="50%" stopColor="#6366F1" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#F8FAFC" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ambient Radial Mesh Glow */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={height} fill="url(#glowCore)" />
      </Svg>

      {/* Floating Animated 3D Liquid Wave Layer 1 */}
      <Animated.View
        style={[
          styles.absoluteLayer,
          {
            transform: [{ translateX: translateX1 }, { translateY: translateY1 }],
          },
        ]}
      >
        <Svg width={SCREEN_WIDTH + 60} height={height + 30} viewBox={`0 0 ${SCREEN_WIDTH + 60} ${height + 30}`}>
          <Path
            d={`M 0,${height * 0.45} Q ${SCREEN_WIDTH * 0.3},${height * 0.15} ${SCREEN_WIDTH * 0.6},${height * 0.55} T ${SCREEN_WIDTH + 60},${height * 0.35} L ${SCREEN_WIDTH + 60},${height + 30} L 0,${height + 30} Z`}
            fill="url(#liquidGrad1)"
          />
        </Svg>
      </Animated.View>

      {/* Floating Animated 3D Liquid Wave Layer 2 */}
      <Animated.View
        style={[
          styles.absoluteLayer,
          {
            transform: [
              { translateX: translateX2 },
              { translateY: translateY2 },
              { scale: orbScale },
            ],
          },
        ]}
      >
        <Svg width={SCREEN_WIDTH + 60} height={height + 30} viewBox={`0 0 ${SCREEN_WIDTH + 60} ${height + 30}`}>
          <Path
            d={`M 0,${height * 0.6} Q ${SCREEN_WIDTH * 0.35},${height * 0.8} ${SCREEN_WIDTH * 0.7},${height * 0.3} T ${SCREEN_WIDTH + 60},${height * 0.5} L ${SCREEN_WIDTH + 60},${height + 30} L 0,${height + 30} Z`}
            fill="url(#liquidGrad2)"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  absoluteLayer: {
    position: 'absolute',
    top: -15,
    left: -30,
    right: -30,
    bottom: -15,
  },
});
