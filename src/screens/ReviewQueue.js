import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import db from '../store/db';
import { localLlmFallbackExtract } from '../engine/localLLM';

import { DeviceEventEmitter } from 'react-native';

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

  const renderQueueItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.rawTextHeader}>Raw Unparsed Payload:</Text>
      <Text style={styles.rawText}>{item.rawText || item.text || 'Unknown payload'}</Text>
      <Text style={styles.parserBadge}>Parser: {item.sourceParser || 'None'}</Text>

      {editingTxn?.id === item.id ? (
        <View style={styles.editContainer}>
          <TextInput
            style={styles.input}
            placeholder="Amount (e.g. 499)"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
            value={editAmount}
            onChangeText={setEditAmount}
          />
          <TextInput
            style={styles.input}
            placeholder="Merchant Name"
            placeholderTextColor="#64748b"
            value={editMerchant}
            onChangeText={setEditMerchant}
          />
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveManual(item)}>
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingTxn(null)}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.aiRetryBtn}
            onPress={() => handleRetryLocalLlm(item)}
            disabled={isProcessingModel}
          >
            <Text style={styles.btnText}>
              {isProcessingModel ? 'Running LLM...' : '⚡ Retry Local AI'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => {
              setEditingTxn(item);
              setEditAmount(item.amount ? String(item.amount) : '');
              setEditMerchant(item.merchant || '');
            }}
          >
            <Text style={styles.btnText}>Edit Manually</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review Queue</Text>
        <Text style={styles.headerSubtitle}>
          Zero silent drops — resolve unparsed SMS
        </Text>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        renderItem={renderQueueItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Queue is empty 🎉</Text>
            <Text style={styles.emptySubtext}>
              All incoming bank SMS were parsed with high confidence.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rawTextHeader: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  rawText: {
    fontSize: 13,
    color: '#f8fafc',
    marginTop: 6,
    fontFamily: 'monospace',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
  },
  parserBadge: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  aiRetryBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  manualBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f43f5e',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  editContainer: {
    marginTop: 12,
    gap: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    color: '#f8fafc',
    fontWeight: '700',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
});
