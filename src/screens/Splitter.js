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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mini-Splitwise</Text>
        <Text style={styles.headerSubtitle}>Split bank SMS expenses offline</Text>
      </View>

      {/* Friends Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Friends</Text>
        <View style={styles.addFriendRow}>
          <TextInput
            style={styles.input}
            placeholder="Friend's Name"
            placeholderTextColor="#64748b"
            value={newFriendName}
            onChangeText={setNewFriendName}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddFriend}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Select Transaction to Split */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Select Expense to Split</Text>
        <FlatList
          horizontal
          data={transactions.slice(0, 10)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.txnChip,
                selectedTxn?.id === item.id && styles.selectedTxnChip,
              ]}
              onPress={() => setSelectedTxn(item)}
            >
              <Text style={styles.txnChipMerchant} numberOfLines={1}>
                {item.merchant || item.bank || 'Spend'}
              </Text>
              <Text style={styles.txnChipAmount}>₹{item.amount}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Select Friends */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Select Friends</Text>
        <View style={styles.friendsWrap}>
          {friends.map((friend) => {
            const isSelected = selectedFriends.includes(friend.id);
            return (
              <TouchableOpacity
                key={friend.id}
                style={[
                  styles.friendPill,
                  isSelected && styles.selectedFriendPill,
                ]}
                onPress={() => toggleFriendSelection(friend.id)}
              >
                <Text
                  style={[
                    styles.friendPillText,
                    isSelected && styles.selectedFriendPillText,
                  ]}
                >
                  {friend.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Action Button */}
      {selectedTxn && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.splitActionBtn} onPress={handleCreateSplit}>
            <Text style={styles.splitActionText}>
              Split ₹{selectedTxn.amount} Equally
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  section: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 10,
  },
  addFriendRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  addBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 12,
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  txnChip: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginRight: 10,
    width: 140,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedTxnChip: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  txnChipMerchant: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  txnChipAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f43f5e',
    marginTop: 6,
  },
  friendsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedFriendPill: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  friendPillText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  selectedFriendPillText: {
    color: '#ffffff',
  },
  bottomBar: {
    padding: 20,
    marginTop: 'auto',
  },
  splitActionBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  splitActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
