import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getCategoryColor } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { BottomSheetModal } from './BottomSheetModal';

export const AddTransactionModal = ({ visible, onClose }) => {
  const { handleAddTransaction, categories } = useApp();
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('debit'); // 'debit' or 'credit'
  const [bank, setBank] = useState('HDFC Bank');
  const [category, setCategory] = useState('Food & Dining');

  const onSave = async () => {
    const num = parseFloat(amount);
    if (!merchant.trim()) {
      Alert.alert('Required', 'Please enter a merchant name.');
      return;
    }
    if (!num || num <= 0) {
      Alert.alert('Required', 'Please enter a valid amount.');
      return;
    }

    try {
      await handleAddTransaction({
        merchant: merchant.trim(),
        amount: num,
        type,
        bank,
        category,
        date: new Date().toISOString(),
      });
      setMerchant('');
      setAmount('');
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add transaction');
    }
  };

  const BANKS = ['HDFC Bank', 'ICICI Bank', 'SBI Card', 'Axis Bank', 'OneCard', 'Cash'];

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Add New Expense</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Amount input Hero */}
            <View style={styles.amountInputWrap}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>

            {/* Type Selector (Debit / Credit) */}
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'debit' && styles.typeBtnDebitActive]}
                onPress={() => setType('debit')}
              >
                <Text style={[styles.typeBtnText, type === 'debit' && styles.typeBtnTextActive]}>
                  Expense (Debit)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'credit' && styles.typeBtnCreditActive]}
                onPress={() => setType('credit')}
              >
                <Text style={[styles.typeBtnText, type === 'credit' && styles.typeBtnTextActive]}>
                  Income (Credit)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Merchant / Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>MERCHANT / DESCRIPTION</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Swiggy, Uber, Grocery store..."
                placeholderTextColor={COLORS.textMuted}
                value={merchant}
                onChangeText={setMerchant}
              />
            </View>

            {/* Payment Method / Bank */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ACCOUNT / BANK</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                <View style={styles.chipsRow}>
                  {BANKS.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.chip, bank === b && styles.chipActive]}
                      onPress={() => setBank(b)}
                    >
                      <Text style={[styles.chipText, bank === b && styles.chipTextActive]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Category Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                <View style={styles.chipsRow}>
                  {categories.map((c) => {
                    const color = getCategoryColor(c);
                    const isSelected = category === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[styles.chip, isSelected && { borderColor: color, backgroundColor: `${color}20` }]}
                        onPress={() => setCategory(c)}
                      >
                        <View style={[styles.dot, { backgroundColor: color }]} />
                        <Text style={[styles.chipText, isSelected && { color, fontWeight: '700' }]}>
                          {c}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
              <Text style={styles.saveBtnText}>Save Transaction</Text>
            </TouchableOpacity>
          </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  currencySymbol: {
    color: COLORS.textMuted,
    fontSize: 32,
    fontWeight: '700',
  },
  amountInput: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '800',
    minWidth: 100,
    textAlign: 'center',
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeBtnDebitActive: {
    backgroundColor: COLORS.expenseBg,
  },
  typeBtnCreditActive: {
    backgroundColor: COLORS.incomeBg,
  },
  typeBtnText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primaryGlow,
    borderColor: COLORS.primaryLight,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
