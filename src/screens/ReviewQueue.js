import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, DeviceEventEmitter } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import db from '../store/db';
import { localLlmFallbackExtract } from '../engine/localLLM';
import { colors, radius, spacing } from '../design';
import { ScreenContainer, Stack, Row } from '../components/primitives/Layout';
import { Heading, BodyText, Caption } from '../components/primitives/Text';
import { ThinDivider } from '../components/primitives/Surfaces';
import { Button, Input } from '../components/primitives/Controls';
import { ScrollView } from 'react-native';

export default function ReviewQueue() {
  const [queue, setQueue] = useState([]);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [isProcessingModel, setIsProcessingModel] = useState(false);

  useEffect(() => {
    loadQueue();
    const subscription = DeviceEventEmitter.addListener('TRANSACTION_ADDED', () => {
      loadQueue();
    });
    return () => subscription.remove();
  }, []);

  const loadQueue = async () => {
    await db.loadDb();
    setQueue(db.getNeedsReviewQueue());
  };

  const handleRetryLocalLlm = async (item) => {
    setIsProcessingModel(true);
    try {
      const result = await localLlmFallbackExtract(item.rawText || item.text);
      if (result && !result.needsReview) {
        await db.updateTransaction(item.id, result);
        Alert.alert('AI Extraction Succeeded', `Extracted ₹${result.amount} for ${result.merchant || 'Merchant'}.`);
        await loadQueue();
      } else {
        Alert.alert('AI Fallback', 'Local LLM could not parse with high confidence. Please resolve manually.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsProcessingModel(false);
    }
  };

  const handleSaveManual = async (item) => {
    if (!editAmount) {
      Alert.alert('Invalid Amount', 'Please enter a valid transaction amount.');
      return;
    }

    await db.updateTransaction(item.id, {
      amount: parseFloat(editAmount),
      merchant: editMerchant || 'Manual Entry',
      type: 'debit',
      needsReview: false,
    });

    Alert.alert('Resolved', 'Transaction marked as reviewed and saved.');
    setEditingTxn(null);
    setEditAmount('');
    setEditMerchant('');
    await loadQueue();
  };

  const renderQueueItem = (item, index) => (
    <Animated.View key={item.id} entering={FadeInUp.delay(index * 40).duration(350)}>
      <View style={styles.card}>
        <Stack space={spacing.xs}>
          <Heading level={3} style={{ letterSpacing: 0, fontSize: 20 }}>{item.merchant || 'Unknown Merchant'}</Heading>
          <BodyText style={{ fontSize: 18, color: colors.textPrimary }}>
            {item.type === 'credit' ? '+' : '−'}₹{item.amount || '0'}
          </BodyText>
          <Caption style={{ marginTop: 2, textTransform: 'none', letterSpacing: 0, color: colors.textSecondary }}>
            Detected as {item.category || item.bank || 'Transaction'}
          </Caption>
        </Stack>

        {editingTxn?.id === item.id ? (
          <View style={styles.editContainer}>
            <Stack space={spacing.md}>
              <Input
                placeholder="Amount (e.g. 499)"
                keyboardType="numeric"
                value={editAmount}
                onChangeText={setEditAmount}
              />
              <Input
                placeholder="Merchant Name"
                value={editMerchant}
                onChangeText={setEditMerchant}
              />
              <Row>
                <Button title="Cancel" variant="ghost" onPress={() => setEditingTxn(null)} style={{ flex: 1 }} />
                <Button title="Save" variant="primary" onPress={() => handleSaveManual(item)} style={{ flex: 1 }} />
              </Row>
            </Stack>
          </View>
        ) : (
          <Row style={styles.actionRow} space={spacing.sm}>
            <Button 
              title="Confirm" 
              variant="primary" 
              onPress={() => handleSaveManual({ ...item, amount: item.amount || 0, merchant: item.merchant || 'Confirmed' })} 
              style={{ flex: 1 }} 
            />
            <Button 
              title="Edit" 
              variant="ghost" 
              onPress={() => {
                setEditingTxn(item);
                setEditAmount(item.amount ? String(item.amount) : '');
                setEditMerchant(item.merchant || '');
              }} 
              style={{ flex: 1 }} 
            />
          </Row>
        )}
      </View>
      <ThinDivider margin={0} style={{ marginHorizontal: spacing.xl, width: 'auto' }} />
    </Animated.View>
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <Heading level={1} style={{ marginBottom: spacing.sm }}>Needs your attention</Heading>
          <BodyText style={{ fontSize: 17 }}>
            {queue.length} {queue.length === 1 ? 'transaction' : 'transactions'}
          </BodyText>
          <BodyText color={colors.textSecondary} style={styles.subtitle}>
            These transactions need confirmation before being added to your finances.
          </BodyText>
        </View>

        <View style={styles.listContainer}>
          {queue.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Heading level={2} style={styles.emptyText}>Nothing here yet</Heading>
              <BodyText color={colors.textSecondary} style={styles.emptySubtext}>
                All incoming bank SMS were parsed with high confidence.
              </BodyText>
            </View>
          ) : (
            queue.map((item, index) => renderQueueItem(item, index))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  subtitle: {
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  listContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  card: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  actionRow: {
    marginTop: spacing.lg,
  },
  editContainer: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.small,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.huge * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
