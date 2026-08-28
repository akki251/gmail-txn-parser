import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { BottomSheetModal } from './BottomSheetModal';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SplitModal = ({ visible, transaction, onClose }) => {
  const { friends, handleSplit } = useApp();
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [newFriendName, setNewFriendName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customShares, setCustomShares] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default friend pills (Abhishek, Anirudh, Akshay) + any others from store
  const defaultFriends = ['Abhishek', 'Anirudh', 'Akshay'];
  const storedFriends = Object.keys(friends || {});

  const allAvailableFriends = useMemo(() => {
    const list = [...defaultFriends];
    storedFriends.forEach((sf) => {
      const formatted = sf.charAt(0).toUpperCase() + sf.slice(1);
      if (!list.some((existing) => existing.toLowerCase() === sf.toLowerCase())) {
        list.push(formatted);
      }
    });
    return list;
  }, [friends]);

  // Filtered friends based on search
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return allAvailableFriends;
    return allAvailableFriends.filter((f) =>
      f.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [allAvailableFriends, searchQuery]);

  useEffect(() => {
    if (transaction) {
      if (transaction.shares && Object.keys(transaction.shares).length > 0) {
        // If already split, populate existing selections
        setSelectedFriends(Object.keys(transaction.shares));
        setCustomShares(transaction.shares);
      } else {
        // Initially ALL unselected
        setSelectedFriends([]);
        setCustomShares({});
      }
      setIsCustomMode(false);
      setNewFriendName('');
      setSearchQuery('');
    }
  }, [transaction]);

  if (!transaction) return null;

  const totalAmount = Number(transaction.amount) || 0;
  const totalParticipants = selectedFriends.length + 1; // +1 for user
  const equalSharePerPerson =
    totalParticipants > 0 ? +(totalAmount / totalParticipants).toFixed(2) : 0;

  // Custom shares calculation
  const totalAllocated = Object.values(customShares).reduce((a, b) => a + (Number(b) || 0), 0);
  const userPayerShare = Math.max(0, +(totalAmount - totalAllocated).toFixed(2));
  const isCustomBalanced = Math.abs(totalAllocated + userPayerShare - totalAmount) < 0.05;

  const toggleFriend = (name) => {
    Haptics.selectionAsync();
    if (selectedFriends.some((f) => f.toLowerCase() === name.toLowerCase())) {
      const next = selectedFriends.filter((f) => f.toLowerCase() !== name.toLowerCase());
      setSelectedFriends(next);
      const nextShares = { ...customShares };
      delete nextShares[name];
      setCustomShares(nextShares);
    } else {
      const next = [...selectedFriends, name];
      setSelectedFriends(next);
      const newParticipants = next.length + 1;
      const newShare = +(totalAmount / newParticipants).toFixed(2);
      setCustomShares({ ...customShares, [name]: newShare });
    }
  };

  const onAddFriend = () => {
    const trimmed = (newFriendName || searchQuery).trim();
    if (!trimmed) return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    if (allAvailableFriends.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      if (!selectedFriends.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
        toggleFriend(formatted);
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const next = [...selectedFriends, formatted];
      setSelectedFriends(next);
      const newParticipants = next.length + 1;
      const newShare = +(totalAmount / newParticipants).toFixed(2);
      setCustomShares({ ...customShares, [formatted]: newShare });
    }
    setNewFriendName('');
    setSearchQuery('');
  };

  const handleShareChange = (friend, text) => {
    const val = parseFloat(text) || 0;
    setCustomShares({ ...customShares, [friend]: val });
  };

  const onConfirm = async () => {
    if (selectedFriends.length === 0) {
      Alert.alert('Select Friends', 'Please select at least one friend to split with.');
      return;
    }

    let finalShares = {};
    if (isCustomMode) {
      finalShares = { ...customShares };
    } else {
      selectedFriends.forEach((f) => {
        finalShares[f] = equalSharePerPerson;
      });
    }

    setIsSubmitting(true);
    try {
      await handleSplit(transaction.id, selectedFriends, finalShares);
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save split');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight={SCREEN_HEIGHT * 0.85}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Split Expense</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {transaction.merchant || 'Expense'} • ₹{totalAmount.toLocaleString('en-IN')}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Live Calculation Summary Banner */}
        <View style={[styles.summaryBanner, SHADOWS.sm]}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryLabel}>
              {selectedFriends.length === 0
                ? 'SELECT FRIENDS BELOW'
                : isCustomMode
                ? 'CUSTOM DIVISION'
                : `SPLITTING BETWEEN ${totalParticipants} PEOPLE`}
            </Text>
            <Text style={styles.summaryAmount}>
              {selectedFriends.length === 0
                ? '₹0 / person'
                : isCustomMode
                ? `You pay ₹${userPayerShare.toLocaleString('en-IN')}`
                : `₹${equalSharePerPerson.toLocaleString('en-IN')} each`}
            </Text>
          </View>

          {/* Mode Toggle Switch */}
          <View style={styles.modeTogglePill}>
            <TouchableOpacity
              style={[styles.modeToggleBtn, !isCustomMode && styles.modeToggleBtnActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setIsCustomMode(false);
              }}
            >
              <Text
                style={[
                  styles.modeToggleText,
                  !isCustomMode && styles.modeToggleTextActive,
                ]}
              >
                Equal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggleBtn, isCustomMode && styles.modeToggleBtnActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setIsCustomMode(true);
              }}
            >
              <Text
                style={[
                  styles.modeToggleText,
                  isCustomMode && styles.modeToggleTextActive,
                ]}
              >
                Custom
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scalable Friends Carousel & Search */}
        <View style={styles.friendsSection}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>
              FRIENDS ({selectedFriends.length}/{allAvailableFriends.length} selected)
            </Text>
            {selectedFriends.length > 0 && (
              <TouchableOpacity onPress={() => setSelectedFriends([])}>
                <Text style={styles.clearLink}>Clear all</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Horizontal Scrollable Carousel (Scales gracefully to 50+ friends without modal jumping) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {filteredFriends.map((name) => {
              const isSelected = selectedFriends.some(
                (f) => f.toLowerCase() === name.toLowerCase()
              );
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.friendCard, isSelected && styles.friendCardSelected]}
                  onPress={() => toggleFriend(name)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: isSelected ? COLORS.primary : COLORS.bgSubtle },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarLetter,
                        { color: isSelected ? '#fff' : COLORS.text },
                      ]}
                    >
                      {name.charAt(0).toUpperCase()}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Feather name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[styles.friendName, isSelected && styles.friendNameSelected]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Search or Quick Add Friend Input */}
          <View style={styles.searchBar}>
            <Feather name="search" size={15} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search or add friend (e.g. Rahul)..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={onAddFriend}
              returnKeyType="done"
            />
            {searchQuery.trim().length > 0 && (
              <TouchableOpacity style={styles.addInlineBtn} onPress={onAddFriend}>
                <Text style={styles.addInlineBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Breakdown List (Scrolls cleanly in bounded space) */}
        {selectedFriends.length > 0 && (
          <View style={styles.breakdownCard}>
            <Text style={styles.sectionLabel}>SPLIT BREAKDOWN</Text>

            {/* You (Payer) */}
            <View style={styles.breakdownRow}>
              <View style={styles.payerRowLeft}>
                <View style={[styles.avatarMini, { backgroundColor: COLORS.primaryGlow }]}>
                  <Text style={[styles.avatarMiniText, { color: COLORS.primary }]}>You</Text>
                </View>
                <Text style={styles.rowLabel}>You (Payer)</Text>
              </View>
              <Text style={[styles.rowShareAmt, { color: COLORS.primary }]}>
                ₹{isCustomMode
                  ? userPayerShare.toLocaleString('en-IN')
                  : equalSharePerPerson.toLocaleString('en-IN')}
              </Text>
            </View>

            {/* Selected Friends */}
            {selectedFriends.map((friend) => (
              <View key={friend} style={styles.breakdownRow}>
                <View style={styles.payerRowLeft}>
                  <View style={styles.avatarMini}>
                    <Text style={styles.avatarMiniText}>
                      {friend.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.rowLabel}>{friend}</Text>
                </View>

                {isCustomMode ? (
                  <View style={styles.customInputBox}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.customShareInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.textMuted}
                      value={
                        customShares[friend] !== undefined
                          ? String(customShares[friend])
                          : ''
                      }
                      onChangeText={(txt) => handleShareChange(friend, txt)}
                    />
                  </View>
                ) : (
                  <Text style={[styles.rowShareAmt, { color: COLORS.income }]}>
                    ₹{equalSharePerPerson.toLocaleString('en-IN')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Confirm Split Action CTA */}
        <TouchableOpacity
          style={[styles.confirmBtn, selectedFriends.length === 0 && styles.confirmBtnDisabled]}
          onPress={onConfirm}
          disabled={isSubmitting || selectedFriends.length === 0}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmBtnText}>
              {selectedFriends.length === 0
                ? 'Tap a Friend Above to Split'
                : isCustomMode
                ? `Confirm Split (${selectedFriends.length} friends)`
                : `Confirm Split (₹${equalSharePerPerson.toLocaleString('en-IN')} each)`}
            </Text>
          )}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 1,
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
    padding: 16,
    gap: 14,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLeft: {
    flex: 1,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  modeTogglePill: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeToggleBtnActive: {
    backgroundColor: COLORS.primary,
  },
  modeToggleText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  modeToggleTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  friendsSection: {
    gap: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  clearLink: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  carouselContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  friendCard: {
    alignItems: 'center',
    width: 62,
    gap: 6,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.income,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  friendName: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  friendNameSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
  },
  addInlineBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addInlineBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  breakdownCard: {
    backgroundColor: COLORS.bgSubtle,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  rowLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  rowShareAmt: {
    fontSize: 13,
    fontWeight: '700',
  },
  customInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    width: 90,
    height: 32,
  },
  currencyPrefix: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 2,
  },
  customShareInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
