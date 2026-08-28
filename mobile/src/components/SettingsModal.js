import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import { BottomSheetModal } from './BottomSheetModal';
import * as Haptics from 'expo-haptics';

export const SettingsModal = ({ visible, onClose }) => {
  const {
    serverUrl,
    updateServerConfig,
    isConnected,
    isStandalone,
    lastSyncTime,
    handleResetData,
  } = useApp();

  const [urlInput, setUrlInput] = useState(serverUrl);
  const [passwordInput, setPasswordInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setUrlInput(serverUrl);
    setTestResult(null);
  }, [serverUrl, visible]);

  const onTestConnection = async () => {
    Haptics.selectionAsync();
    setIsTesting(true);
    setTestResult(null);
    const start = Date.now();
    try {
      const res = await api.getHealth();
      const latency = Date.now() - start;
      setTestResult({
        ok: true,
        message: `Connected successfully (${latency}ms)`,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err.message || 'Could not reach server',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const onSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!urlInput.trim()) {
      Alert.alert('Invalid URL', 'Server URL cannot be empty');
      return;
    }
    try {
      await updateServerConfig(urlInput.trim(), passwordInput);
      Alert.alert('Saved', 'Server settings updated and synchronized.');
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save settings');
    }
  };

  const onReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Reset Data',
      'This will reload all preloaded transaction records and reset your local database. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await handleResetData();
            Alert.alert('Success', 'Local data reloaded.');
            onClose();
          },
        },
      ]
    );
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Storage & Settings</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Mode Banner */}
        <View style={styles.modeBanner}>
          <Feather name="hard-drive" size={18} color={COLORS.income} />
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitle}>Standalone Offline Storage</Text>
            <Text style={styles.modeDesc}>
              Transactions, splits, and balances are stored permanently on this device.
            </Text>
          </View>
        </View>

        {/* Reload Data Button */}
        <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
          <Feather name="rotate-ccw" size={16} color={COLORS.warning} />
          <Text style={styles.resetBtnText}>Reload Preloaded Workspace Data</Text>
        </TouchableOpacity>

        {/* Optional Server Sync Section */}
        <View style={styles.divider} />
        <Text style={styles.sectionHeader}>SERVER CONNECTION (GCP / LOCAL)</Text>

        {/* Server URL Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>SERVER BACKEND URL</Text>
          <TextInput
            style={styles.input}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="http://35.253.57.89:4173"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            Configured default: Live GCP VM (http://35.253.57.89:4173)
          </Text>
        </View>

        {/* Password Auth */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>APP PASSWORD (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder="Leave blank if not set"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {/* Test Connection Button */}
        <TouchableOpacity
          style={styles.testBtn}
          onPress={onTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <Feather name="activity" size={16} color={COLORS.primary} />
              <Text style={styles.testBtnText}>Test Server Connection</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Test Result Message */}
        {testResult && (
          <View
            style={[
              styles.testResultBox,
              {
                backgroundColor: testResult.ok ? COLORS.incomeBg : COLORS.expenseBg,
                borderColor: testResult.ok ? COLORS.income : COLORS.expense,
              },
            ]}
          >
            <Feather
              name={testResult.ok ? 'check-circle' : 'alert-circle'}
              size={16}
              color={testResult.ok ? COLORS.income : COLORS.expense}
            />
            <Text
              style={[
                styles.testResultText,
                { color: testResult.ok ? COLORS.income : COLORS.expense },
              ]}
            >
              {testResult.message}
            </Text>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  modeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modeDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.3)',
  },
  resetBtnText: {
    color: COLORS.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginVertical: 4,
  },
  sectionHeader: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 46,
    color: COLORS.text,
    fontSize: 14,
  },
  helperText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bgSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  testBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
