import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert, DeviceEventEmitter } from 'react-native';
import { localLlmFallbackExtract } from '../engine/localLLM';
import Animated, { FadeInUp } from 'react-native-reanimated';
import db from '../store/db';
import { ScreenContainer, Section } from '../components/primitives/Layout';
import { Heading, BodyText, Caption } from '../components/primitives/Text';
import { ThinDivider } from '../components/primitives/Surfaces';
import { Button } from '../components/primitives/Controls';
import { colors, spacing } from '../design';

export default function SettingsScreen() {
  const [isTestingLLM, setIsTestingLLM] = useState(false);

  const handleTestLLM = async () => {
    setIsTestingLLM(true);
    try {
      const startTime = Date.now();
      const res = await localLlmFallbackExtract("Rs 1 debited from HeartbeatTest");
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      Alert.alert('LLM Heartbeat OK', `Responded in ${elapsed}s:\n\n${JSON.stringify(res, null, 2)}`);
    } catch (err) {
      Alert.alert('LLM Heartbeat Failed', err.message);
    } finally {
      setIsTestingLLM(false);
    }
  };

  const handleClear = async () => {
    Alert.alert(
      'Reset All Data',
      'Are you sure you want to clear all local transaction records and native SMS queues?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            await db.clearAllData();
            DeviceEventEmitter.emit('TRANSACTION_ADDED');
            Alert.alert('Reset Complete', 'All local transaction records cleared.');
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
          <Heading level={1}>Settings</Heading>
        </View>

        <Animated.View entering={FadeInUp.delay(0).duration(350)}>
        <Section style={{ marginBottom: spacing.xl }}>
          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
            <Caption style={{ letterSpacing: 1.5, color: colors.textSecondary }}>SECURITY & PRIVACY</Caption>
          </View>
          <View style={styles.listBlock}>
            <View style={styles.rowItem}>
              <BodyText style={{ fontSize: 17 }}>Air-Gapped Processing</BodyText>
              <Caption color={colors.income} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>Enabled</Caption>
            </View>
            <ThinDivider margin={0} style={{ marginHorizontal: spacing.xl, width: 'auto' }} />
            <View style={styles.rowItem}>
              <BodyText style={{ fontSize: 17 }}>On-Device AI Engine</BodyText>
              <Caption color={colors.income} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>llama.rn (Offline)</Caption>
            </View>
            <ThinDivider margin={0} style={{ marginHorizontal: spacing.xl, width: 'auto' }} />
            <View style={styles.rowItem}>
              <BodyText style={{ fontSize: 17 }}>Cloud Data Sync</BodyText>
              <Caption color={colors.textSecondary} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>Disabled (Zero Data Sent)</Caption>
            </View>
            <ThinDivider margin={0} style={{ marginHorizontal: spacing.xl, width: 'auto' }} />
            <View style={{ padding: spacing.lg }}>
              <Button title={isTestingLLM ? "Testing LLM..." : "Test LLM Heartbeat"} variant="secondary" onPress={handleTestLLM} disabled={isTestingLLM} />
            </View>
          </View>
        </Section>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(60).duration(350)}>
        <Section style={{ marginBottom: spacing.xl }}>
          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
            <Caption style={{ letterSpacing: 1.5, color: colors.textSecondary }}>DATA STORAGE</Caption>
          </View>
          <View style={styles.listBlock}>
            <View style={styles.rowItem}>
              <BodyText style={{ fontSize: 17 }}>Flat-JSON Store</BodyText>
              <Caption color={colors.primary} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>db.json</Caption>
            </View>
            <ThinDivider margin={0} style={{ marginHorizontal: spacing.xl, width: 'auto' }} />
            <View style={{ padding: spacing.lg }}>
              <Button title="Delete Local Transaction Data" variant="danger" onPress={handleClear} />
            </View>
          </View>
        </Section>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).duration(350)}>
        <Section>
          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
            <Caption style={{ letterSpacing: 1.5, color: colors.textSecondary }}>ABOUT</Caption>
          </View>
          <View style={styles.listBlock}>
            <View style={styles.rowItem}>
              <BodyText style={{ fontSize: 17 }}>App Version</BodyText>
              <Caption color={colors.textSecondary} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>1.1.0 (Expo SDK 50)</Caption>
            </View>
            <ThinDivider margin={0} style={{ marginHorizontal: spacing.xl, width: 'auto' }} />
            <View style={styles.rowItem}>
              <BodyText style={{ fontSize: 17 }}>Architecture</BodyText>
              <Caption color={colors.textSecondary} style={{ textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>Offline-First React Native</Caption>
            </View>
          </View>
        </Section>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listBlock: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowItem: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
