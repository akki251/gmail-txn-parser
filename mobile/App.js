import React, { useState, Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AppProvider, useApp } from './src/context/AppContext';
import { COLORS, SHADOWS } from './src/theme/colors';

import { Header } from './src/components/Header';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { SplitterScreen } from './src/screens/SplitterScreen';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';

import { TransactionDetailModal } from './src/components/TransactionDetailModal';
import { SplitModal } from './src/components/SplitModal';
import { SettleModal } from './src/components/SettleModal';
import { FriendHistoryModal } from './src/components/FriendHistoryModal';
import { CategoryPickerModal } from './src/components/CategoryPickerModal';
import { SettingsModal } from './src/components/SettingsModal';
import { AddTransactionModal } from './src/components/AddTransactionModal';

class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[App Crash Caught]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Application Error</Text>
          <Text style={styles.errorMessage}>{String(this.state.error?.message || this.state.error)}</Text>
          <TouchableOpacity
            style={styles.errorRetryBtn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.errorRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const TABS = [
  { id: 'dashboard', label: 'Finances', icon: 'pie-chart' },
  { id: 'transactions', label: 'Txns', icon: 'list' },
  { id: 'splitter', label: 'Split', icon: 'users', hasBadge: true },
  { id: 'ledger', label: 'Ledger', icon: 'credit-card' },
  { id: 'insights', label: 'Insights', icon: 'bar-chart-2' },
];

function MainApp() {
  const insets = useSafeAreaInsets();
  const { metrics, isLoading } = useApp();

  const [activeTab, setActiveTab] = useState('dashboard');

  // Modals state
  const [detailTxn, setDetailTxn] = useState(null);
  const [splitTxn, setSplitTxn] = useState(null);
  const [categoryTxn, setCategoryTxn] = useState(null);
  const [settleFriend, setSettleFriend] = useState(null);
  const [historyFriend, setHistoryFriend] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const onTabPress = (tabId) => {
    Haptics.selectionAsync();
    setActiveTab(tabId);
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onOpenTxnDetail={(tx) => setDetailTxn(tx)}
            onOpenSplit={(tx) => setSplitTxn(tx)}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        );
      case 'transactions':
        return (
          <TransactionsScreen
            onOpenTxnDetail={(tx) => setDetailTxn(tx)}
            onOpenSplit={(tx) => setSplitTxn(tx)}
          />
        );
      case 'splitter':
        return (
          <SplitterScreen
            onOpenSplit={(tx) => setSplitTxn(tx)}
            onOpenTxnDetail={(tx) => setDetailTxn(tx)}
          />
        );
      case 'ledger':
        return (
          <LedgerScreen
            onOpenSettle={(friend) => setSettleFriend(friend)}
            onOpenHistory={(friend) => setHistoryFriend(friend)}
          />
        );
      case 'insights':
        return <InsightsScreen />;
      default:
        return null;
    }
  };

  const unsplitCount = metrics?.unsplitCount || 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top || 20 }]}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdd={() => setIsAddOpen(true)}
      />

      {/* Main Screen Content */}
      <View style={styles.screenContainer}>{renderActiveScreen()}</View>

      {/* Custom Bottom Tab Bar */}
      <View style={[styles.tabBar, SHADOWS.lg, { paddingBottom: Math.max(insets.bottom || 0, 14) }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const showBadge = tab.hasBadge && unsplitCount > 0;

          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabBtn}
              onPress={() => onTabPress(tab.id)}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <Feather
                  name={tab.icon}
                  size={20}
                  color={isActive ? COLORS.primary : COLORS.textMuted}
                />
                {showBadge && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {unsplitCount > 99 ? '99+' : unsplitCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Modals */}
      <TransactionDetailModal
        visible={!!detailTxn}
        transaction={detailTxn}
        onClose={() => setDetailTxn(null)}
        onOpenSplit={(tx) => setSplitTxn(tx)}
        onOpenCategoryPicker={(tx) => setCategoryTxn(tx)}
      />

      <SplitModal
        visible={!!splitTxn}
        transaction={splitTxn}
        onClose={() => setSplitTxn(null)}
      />

      <SettleModal
        visible={!!settleFriend}
        friend={settleFriend}
        onClose={() => setSettleFriend(null)}
      />

      <FriendHistoryModal
        visible={!!historyFriend}
        friend={historyFriend}
        onClose={() => setHistoryFriend(null)}
        onOpenSettle={(f) => setSettleFriend(f)}
        onOpenTxnDetail={(tx) => setDetailTxn(tx)}
      />

      <CategoryPickerModal
        visible={!!categoryTxn}
        transaction={categoryTxn}
        onClose={() => setCategoryTxn(null)}
      />

      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <AddTransactionModal
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ErrorBoundary>
        <AppProvider>
          <MainApp />
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgElevated,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconWrap: {
    position: 'relative',
    padding: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 3,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: COLORS.warning,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: COLORS.expense,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorRetryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorRetryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
