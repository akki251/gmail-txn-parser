import React, { useEffect, useState, useRef } from 'react';
import { Text } from 'react-native';

export const AnimatedNumber = ({ value = 0, style, prefix = '₹', formatter = (n) => n.toLocaleString('en-IN') }) => {
  const [displayVal, setDisplayVal] = useState(value);
  const prevValRef = useRef(0);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const startVal = prevValRef.current;
    const endVal = Number(value) || 0;
    const startTime = Date.now();
    const duration = 900; // ms

    if (startVal === endVal) {
      setDisplayVal(endVal);
      return;
    }

    const updateCounter = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease-out cubic formula
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * easeOut);

      setDisplayVal(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(updateCounter);
      } else {
        prevValRef.current = endVal;
      }
    };

    animFrameRef.current = requestAnimationFrame(updateCounter);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [value]);

  return (
    <Text style={style}>
      {prefix}
      {formatter(displayVal)}
    </Text>
  );
};
