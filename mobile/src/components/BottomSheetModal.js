import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
  TouchableWithoutFeedback,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { COLORS, SHADOWS } from '../theme/colors';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const BottomSheetModal = ({
  visible,
  onClose,
  children,
  maxHeight = SCREEN_HEIGHT * 0.88,
  showHandle = true,
}) => {
  const [showModal, setShowModal] = useState(visible);
  const animProgress = useRef(new Animated.Value(0)).current; // 0 (hidden) -> 1 (open)
  const panY = useRef(new Animated.Value(0)).current;

  // Pan Responder for interactive swipe-down-to-dismiss gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.8) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          handleClose();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 250,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      panY.setValue(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      Animated.spring(animProgress, {
        toValue: 1,
        useNativeDriver: true,
        damping: 24,
        mass: 0.85,
        stiffness: 220,
      }).start();
    } else {
      Animated.timing(animProgress, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setShowModal(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(animProgress, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setShowModal(false);
      onClose && onClose();
    });
  };

  if (!showModal) return null;

  // Dynamic spring translateY: from off-screen down to 0
  const translateY = Animated.add(
    animProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [SCREEN_HEIGHT * 0.9, 0],
    }),
    panY
  );

  // Dynamic backdrop opacity
  const backdropOpacity = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  // Dynamic top scale & morphing curvature
  const sheetScale = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Animated Dim Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        </TouchableWithoutFeedback>

        {/* Keyboard Avoiding Container for modal spacing */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          {/* Morphing Curved Bottom Sheet Container */}
          <Animated.View
            style={[
              styles.sheet,
              {
                maxHeight,
                transform: [{ translateY }, { scale: sheetScale }],
              },
              SHADOWS.lg,
            ]}
          >
            {/* Top Drag Handle */}
            {showHandle && (
              <View style={styles.handleArea} {...panResponder.panHandlers}>
                <View style={styles.handleBar} />
              </View>
            )}

            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
  keyboardAvoid: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    paddingBottom: 28,
  },
  handleArea: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  handleBar: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
});
