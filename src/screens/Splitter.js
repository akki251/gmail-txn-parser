import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import db from '../store/db';
import { colors, radius, spacing } from '../design';
import { ScreenContainer, Stack, Row, Section } from '../components/primitives/Layout';
import { DisplayText, Heading, BodyText, Caption } from '../components/primitives/Text';
import { Card, Surface, ThinDivider } from '../components/primitives/Surfaces';
import { Button, Input } from '../components/primitives/Controls';

export default function Splitter() {
  const [friends, setFriends] = useState([]);
  const [newFriendName, setNewFriendName] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [selectedFriends, setSelectedFriends] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await db.loadDb();
    setFriends(db.getFriends());
    setTransactions(db.getTransactions().filter((t) => t.type === 'debit'));
  };

  const handleAddFriend = async () => {
    if (!newFriendName.trim()) return;
    await db.addFriend(newFriendName.trim());
    setNewFriendName('');
    await loadData();
  };

  const toggleFriendSelection = (friendId) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter((id) => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const handleCreateSplit = async () => {
    if (!selectedTxn) {
      Alert.alert('Select Transaction', 'Please choose a transaction to split.');
      return;
    }
    if (selectedFriends.length === 0) {
      Alert.alert('Select Friends', 'Choose at least one friend to split with.');
      return;
    }

    const perPersonShare = selectedTxn.amount / (selectedFriends.length + 1);
    await db.createSplit(selectedTxn.id, {
      amount: selectedTxn.amount,
      perPersonShare,
      participants: selectedFriends,
    });

    Alert.alert('Split Created', `Each person owes ₹${perPersonShare.toFixed(2)}.`);
    setSelectedTxn(null);
    setSelectedFriends([]);
    await loadData();
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <DisplayText style={styles.title}>Splitwise</DisplayText>
        <BodyText color={colors.textSecondary}>Split expenses with friends.</BodyText>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <Stack space={spacing.xl} style={styles.content}>
            
            {/* Friends Section */}
            <Section>
              <Heading level={3} style={styles.sectionTitle}>Friends</Heading>
              <Row space={spacing.sm}>
                <Input
                  placeholder="Add friend..."
                  value={newFriendName}
                  onChangeText={setNewFriendName}
                  style={{ flex: 1 }}
                />
                <Button title="Add" onPress={handleAddFriend} />
              </Row>
              
              <View style={styles.friendsWrap}>
                {friends.map((friend) => {
                  const isSelected = selectedFriends.includes(friend.id);
                  return (
                    <TouchableOpacity
                      key={friend.id}
                      style={[styles.friendPill, isSelected && styles.selectedFriendPill]}
                      onPress={() => toggleFriendSelection(friend.id)}
                    >
                      <BodyText
                        small
                        bold
                        color={isSelected ? '#ffffff' : colors.textSecondary}
                      >
                        {friend.name}
                      </BodyText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {/* Select Transaction */}
            <Section>
              <Heading level={3} style={styles.sectionTitle}>1. Select Expense</Heading>
              <FlatList
                horizontal
                data={transactions.slice(0, 15)}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.sm }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.txnChip,
                      selectedTxn?.id === item.id && styles.selectedTxnChip,
                    ]}
                    onPress={() => setSelectedTxn(item)}
                  >
                    <Caption color={selectedTxn?.id === item.id ? colors.primaryStrong : colors.textMuted}>
                      {item.merchant || item.bank || 'Spend'}
                    </Caption>
                    <Heading level={3} color={selectedTxn?.id === item.id ? '#ffffff' : colors.textPrimary}>
                      ₹{item.amount}
                    </Heading>
                  </TouchableOpacity>
                )}
              />
            </Section>

          </Stack>
        }
      />

      {/* Action Button */}
      {selectedTxn && selectedFriends.length > 0 && (
        <View style={styles.bottomBar}>
          <Button
            title={`Split ₹${selectedTxn.amount} Equally`}
            onPress={handleCreateSplit}
            size="large"
            style={styles.splitActionBtn}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  friendsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  friendPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedFriendPill: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  txnChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
    padding: spacing.lg,
    width: 140,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedTxnChip: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  bottomBar: {
    padding: spacing.xl,
    paddingBottom: 100,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  splitActionBtn: {
    width: '100%',
    paddingVertical: spacing.lg,
  },
});
