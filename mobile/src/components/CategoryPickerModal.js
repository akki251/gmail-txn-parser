import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getCategoryColor } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { BottomSheetModal } from './BottomSheetModal';
import * as Haptics from 'expo-haptics';

export const CategoryPickerModal = ({ visible, transaction, onClose }) => {
  const { categories, handleSetCategory } = useApp();

  if (!transaction) return null;

  const currentCategory = transaction.category || 'General';

  const onSelect = async (cat) => {
    Haptics.selectionAsync();
    try {
      await handleSetCategory(transaction.id, cat);
      onClose();
    } catch (err) {
      console.warn('[Category Error]:', err);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Change Category</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = item === currentCategory;
          const color = getCategoryColor(item);
          return (
            <TouchableOpacity
              style={[styles.itemRow, isSelected && styles.itemRowSelected]}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <View style={styles.left}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                  {item}
                </Text>
              </View>
              {isSelected && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          );
        }}
      />
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
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  itemRowSelected: {
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: -12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  itemTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
