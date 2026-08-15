import React, { useEffect } from 'react';
import { StyleSheet, View, Text, PermissionsAndroid, Platform, AppState, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts, InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import Dashboard from './src/screens/Dashboard';
import TransactionsScreen from './src/screens/TransactionsScreen';
import AccountsScreen from './src/screens/AccountsScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import ReviewQueue from './src/screens/ReviewQueue';
import SettingsScreen from './src/screens/SettingsScreen';
import { initSmsListener, checkPendingBackgroundSms } from './src/engine/smsReceiver';
import { Colors } from './src/theme/tokens';

const Tab = createBottomTabNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    async function requestSmsPermissions() {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
            PermissionsAndroid.PERMISSIONS.READ_SMS,
          ]);
        } catch (err) {
          console.warn('[Permissions] SMS permission error:', err);
        }
      }
    }
    requestSmsPermissions();
    const cleanup = initSmsListener();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPendingBackgroundSms();
      }
    });

    return () => {
      cleanup && cleanup();
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accentLight} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.background,
            borderTopColor: Colors.border,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: Colors.accentLight,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarLabelStyle: {
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
          },
          tabBarIcon: ({ color, size }) => {
            let iconName = '✦';
            if (route.name === 'Home') iconName = '🏛️';
            else if (route.name === 'Txns') iconName = '💳';
            else if (route.name === 'Accounts') iconName = '🏦';
            else if (route.name === 'Insights') iconName = '📊';
            else if (route.name === 'Review') iconName = '⚡';
            else if (route.name === 'Settings') iconName = '⚙️';
            return <Text style={{ fontSize: 16 }}>{iconName}</Text>;
          },
        })}
      >
        <Tab.Screen name="Home" component={Dashboard} />
        <Tab.Screen name="Txns" component={TransactionsScreen} options={{ title: 'Transactions' }} />
        <Tab.Screen name="Accounts" component={AccountsScreen} />
        <Tab.Screen name="Insights" component={InsightsScreen} />
        <Tab.Screen name="Review" component={ReviewQueue} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
