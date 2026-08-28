import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Circle, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';
import { COLORS } from '../theme/colors';

// 3D Vertices for a Luxury Cut Diamond / Gem
const VERTICES_3D = [
  // Top apex
  [0, -1.2, 0],
  // Upper ring
  [0.85, -0.4, 0.85],
  [-0.85, -0.4, 0.85],
  [-0.85, -0.4, -0.85],
  [0.85, -0.4, -0.85],
  // Mid girdle
  [1.2, 0.2, 0],
  [0, 0.2, 1.2],
  [-1.2, 0.2, 0],
  [0, 0.2, -1.2],
  // Bottom culet apex
  [0, 1.3, 0],
];

// Edges connecting vertices
const EDGES = [
  // Top cone
  [0, 1], [0, 2], [0, 3], [0, 4],
  // Upper ring loop
  [1, 2], [2, 3], [3, 4], [4, 1],
  // Upper to mid
  [1, 5], [1, 6], [2, 6], [2, 7], [3, 7], [3, 8], [4, 8], [4, 5],
  // Mid loop
  [5, 6], [6, 7], [7, 8], [8, 5],
  // Bottom pavilion to apex
  [9, 5], [9, 6], [9, 7], [9, 8],
];

export const HoloGem3D = ({ size = 110, style }) => {
  const [angle, setAngle] = useState({ x: 0.3, y: 0.2, z: 0 });
  const animRef = useRef(null);
  const angleRef = useRef({ x: 0.2, y: 0, z: 0 });

  useEffect(() => {
    let lastTime = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Smooth continuous 3D rotation
      angleRef.current.y += dt * 0.75;
      angleRef.current.x = 0.35 + Math.sin(now * 0.001) * 0.25;
      angleRef.current.z = Math.cos(now * 0.0008) * 0.15;

      setAngle({ ...angleRef.current });
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // 3D Matrix Rotation & Perspective Projection
  const projected = VERTICES_3D.map(([x, y, z]) => {
    const { x: ax, y: ay, z: az } = angle;

    // Rotate around Y
    let cosY = Math.cos(ay), sinY = Math.sin(ay);
    let x1 = x * cosY + z * sinY;
    let y1 = y;
    let z1 = -x * sinY + z * cosY;

    // Rotate around X
    let cosX = Math.cos(ax), sinX = Math.sin(ax);
    let x2 = x1;
    let y2 = y1 * cosX - z1 * sinX;
    let z2 = y1 * sinX + z1 * cosX;

    // Perspective projection
    const distance = 3.2;
    const fov = size * 0.38;
    const scale = fov / (distance + z2);

    const px = size / 2 + x2 * scale;
    const py = size / 2 + y2 * scale;

    return { x: px, y: py, z: z2, scale };
  });

  return (
    <View style={[styles.container, { width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="gemEdgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#4F46E5" stopOpacity="0.9" />
            <Stop offset="50%" stopColor="#818CF8" stopOpacity="0.85" />
            <Stop offset="100%" stopColor="#06B6D4" stopOpacity="0.9" />
          </LinearGradient>
          <RadialGradient id="gemCoreGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#818CF8" stopOpacity="0.3" />
            <Stop offset="70%" stopColor="#4F46E5" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ambient Core Glow */}
        <Circle cx={size / 2} cy={size / 2} r={size * 0.42} fill="url(#gemCoreGlow)" />

        {/* 3D Wireframe Edges */}
        {EDGES.map(([i1, i2], index) => {
          const p1 = projected[i1];
          const p2 = projected[i2];
          if (!p1 || !p2) return null;

          // Depth-based stroke opacity and width
          const avgZ = (p1.z + p2.z) / 2;
          const opacity = Math.max(0.2, Math.min(0.95, (avgZ + 1.5) / 2.5));
          const strokeWidth = Math.max(0.8, Math.min(1.8, (avgZ + 1.5) * 0.7));

          return (
            <Line
              key={`edge-${index}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="url(#gemEdgeGrad)"
              strokeWidth={strokeWidth}
              strokeOpacity={opacity}
              strokeLinecap="round"
            />
          );
        })}

        {/* 3D Glowing Vertices */}
        {projected.map((p, i) => {
          const depthAlpha = Math.max(0.3, Math.min(1, (p.z + 1.5) / 2.5));
          const radius = Math.max(1.8, Math.min(3.6, (p.z + 1.5) * 1.3));

          return (
            <Circle
              key={`node-${i}`}
              cx={p.x}
              cy={p.y}
              r={radius}
              fill="#FFFFFF"
              stroke="#6366F1"
              strokeWidth={1}
              opacity={depthAlpha}
            />
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
