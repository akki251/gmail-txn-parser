import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { BottomSheetModal } from './BottomSheetModal';

export const SettleModal = ({ visible, friend, onClose }) => {
  const { handleSettle } = useApp();
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (friend) {
      setAmount(String(friend.amount || ''));
    }
  }, [friend]);

  if (!friend) return null;

  const isOwed = friend.amount > 0;

  const onConfirm = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to settle.');
      return;
    }

    setIsSubmitting(true);
    try {
      await handleSettle(friend.friendName, num);
      onClose();
    } catch (err) {
      Alert.alert('Settlement Error', err.message || 'Failed to record settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.sheetContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settle Balance</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Friend info */}
        <View style={styles.infoBox}>
          <Text style={styles.friendName}>{friend.friendName}</Text>
          <Text style={styles.balanceStatus}>
            {isOwed ? `Owes you ₹${friend.amount.toLocaleString('en-IN')}` : `You owe ₹${friend.amount.toLocaleString('en-IN')}`}
          </Text>
        </View>

        {/* Settle Amount input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>AMOUNT TO SETTLE</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.currencyPrefix}>₹</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        </View>

        {/* Settle Button */}
        <TouchableOpacity
          style={styles.settleBtn}
          onPress={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.settleBtnText}>Record Settlement</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
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
  infoBox: {
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  friendName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  balanceStatus: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    color: COLORS.textSecondary,
    fontSize: 20,
    fontWeight: '700',
    marginRight: 6,
  },
  input: {
    flex: 1,
    height: 50,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  settleBtn: {
    backgroundColor: COLORS.income,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
