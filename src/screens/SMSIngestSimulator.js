import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { parseTransactionSms } from '../parsers/smsParsers';
import { localLlmFallbackExtract } from '../engine/localLLM';
import db from '../store/db';

export default function SMSIngestSimulator() {
  const [sender, setSender] = useState('JM-ICICIB');
  const [smsText, setSmsText] = useState(
    'ICICI Bank Acct XX299 debited for Rs 250.00 on 15-Aug-26; ZOMATO credited. UPI:999888777.'
  );
  const [parseOutput, setParseOutput] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const PRESETS = [
    {
      name: 'ICICI UPI Debit',
      sender: 'JM-ICICIB',
      text: 'ICICI Bank Acct XX299 debited for Rs 149.00 on 15-Aug-26; SWIGGY credited. UPI:12345678.',
    },
    {
      name: 'HDFC Transfer',
      sender: 'HDFCBK',
      text: 'Money Transfer: Rs 1200.00 debited from A/C **4321 to UBER on 14-AUG-26',
    },
    {
      name: 'SBI Credit Card',
      sender: 'SBICRD',
      text: 'Rs. 799.00 spent on your SBI Credit Card ending 5678 at NETFLIX on 10-Aug-26.',
    },
    {
      name: 'Unstructured Alert (AI Fallback)',
      sender: 'CUSTOM_BANK',
      text: 'Alert: Your card was charged INR 1450.50 at AMAZON INDIA today.',
    },
    {
      name: 'OTP Notification (Filter)',
      sender: 'JM-ICICIB',
      text: 'OTP for your ICICI Bank transaction of Rs 500 is 882910. Do not share.',
    },
  ];

  const handleSimulate = async () => {
    if (!smsText.trim()) return;

    setIsProcessing(true);
    let result = parseTransactionSms({ sender, text: smsText });

    if (result?.needsLLMFallback) {
      const aiResult = await localLlmFallbackExtract(smsText);
      result = { ...result, ...aiResult };
    }

    setParseOutput(result);
    setIsProcessing(false);

    if (result && !result.notATransaction) {
      await db.addTransaction({
        ...result,
        rawText: smsText,
        sender,
        date: new Date().toISOString(),
      });
      Alert.alert('Ingested & Saved', 'Transaction parsed and stored in flat-JSON database.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SMS Ingest Lab</Text>
          <Text style={styles.headerSubtitle}>
            Simulate & test raw bank SMS processing
          </Text>
        </View>

        {/* Preset Selectors */}
        <Text style={styles.sectionTitle}>Quick Test Presets:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsRow}>
          {PRESETS.map((preset, index) => (
            <TouchableOpacity
              key={index}
              style={styles.presetChip}
              onPress={() => {
                setSender(preset.sender);
                setSmsText(preset.text);
              }}
            >
              <Text style={styles.presetChipText}>{preset.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input Fields */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Sender Header ID:</Text>
          <TextInput
            style={styles.input}
            value={sender}
            onChangeText={setSender}
            placeholder="e.g. JM-ICICIB"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.inputLabel}>Raw SMS Body:</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={smsText}
            onChangeText={setSmsText}
            multiline={true}
            numberOfLines={4}
            placeholder="Paste raw SMS here"
            placeholderTextColor="#64748b"
          />

          <TouchableOpacity style={styles.simulateBtn} onPress={handleSimulate} disabled={isProcessing}>
            <Text style={styles.simulateBtnText}>
              {isProcessing ? 'Parsing...' : '🚀 Test Ingestion Pipeline'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Parsed Result Box */}
        {parseOutput && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Parsing Output & Decision:</Text>
            <Text style={styles.resultJson}>
              {JSON.stringify(parseOutput, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
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
  sectionTitle: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '700',
    marginBottom: 10,
  },
  presetsRow: {
    marginBottom: 20,
  },
  presetChip: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetChipText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
  },
  inputCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  multilineInput: {
    height: 90,
    textAlignVertical: 'top',
  },
  simulateBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  simulateBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  resultCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  resultTitle: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '700',
    marginBottom: 10,
  },
  resultJson: {
    color: '#cbd5e1',
    fontFamily: 'Gilroy_Medium',
    fontSize: 12,
  },
});
