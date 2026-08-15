import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, DeviceEventEmitter } from 'react-native';
import db from '../store/db';
import { ScreenContainer, Stack, Row, Section } from '../components/primitives/Layout';
import { Heading, BodyText, Caption } from '../components/primitives/Text';
import { Card, ThinDivider } from '../components/primitives/Surfaces';
import { Button } from '../components/primitives/Controls';
import { Colors, Radius, Spacing } from '../theme/tokens';

export default function SettingsScreen() {
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
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}>
        <Heading level={1}>Settings</Heading>
        <Caption style={{ marginTop: 2, marginBottom: Spacing.xl }}>Preferences & Air-Gapped Security</Caption>

        <Section>
          <Caption style={{ marginBottom: Spacing.sm }}>Security & Privacy</Caption>
          <Card>
            <Stack space={Spacing.md}>
              <Row>
                <BodyText bold>Air-Gapped Processing</BodyText>
                <Caption color={Colors.positive}>Enabled</Caption>
              </Row>
              <ThinDivider margin={0} />
              <Row>
                <BodyText bold>On-Device AI Engine</BodyText>
                <Caption color={Colors.positive}>llama.rn (Offline)</Caption>
              </Row>
              <ThinDivider margin={0} />
              <Row>
                <BodyText bold>Cloud Data Sync</BodyText>
                <Caption color={Colors.textMuted}>Disabled (Zero Data Sent)</Caption>
              </Row>
            </Stack>
          </Card>
        </Section>

        <Section>
          <Caption style={{ marginBottom: Spacing.sm }}>Data Storage</Caption>
          <Card elevated>
            <Stack space={Spacing.md}>
              <Row>
                <BodyText bold>Flat-JSON Store</BodyText>
                <Caption color={Colors.accentLight}>db.json</Caption>
              </Row>
              <ThinDivider margin={0} />
              <Button title="🗑️ Clear All Local Transaction Data" variant="danger" onPress={handleClear} />
            </Stack>
          </Card>
        </Section>

        <Section>
          <Caption style={{ marginBottom: Spacing.sm }}>About</Caption>
          <Card>
            <Stack space={Spacing.sm}>
              <Row>
                <BodyText small color={Colors.textMuted}>App Version</BodyText>
                <BodyText small bold>1.0.0 (Expo SDK 50)</BodyText>
              </Row>
              <Row>
                <BodyText small color={Colors.textMuted}>Architecture</BodyText>
                <BodyText small bold>Offline-First React Native Android</BodyText>
              </Row>
            </Stack>
          </Card>
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}
