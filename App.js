import React, { useEffect } from 'react';
import { StyleSheet, View, Text, PermissionsAndroid, Platform, AppState, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts } from 'expo-font';

import Dashboard from './src/screens/Dashboard';
import TransactionsScreen from './src/screens/TransactionsScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import ReviewQueue from './src/screens/ReviewQueue';
import SettingsScreen from './src/screens/SettingsScreen';
import { initSmsListener, checkPendingBackgroundSms } from './src/engine/smsReceiver';
import { TabBar } from './src/components/nav/TabBar';
import { colors } from './src/design';

const Tab = createBottomTabNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Gilroy_Regular: require('./assets/fonts/Gilroy-Regular.ttf'),
    Gilroy_Medium: require('./assets/fonts/Gilroy-Medium.ttf'),
    Gilroy_SemiBold: require('./assets/fonts/Gilroy-SemiBold.ttf'),
    Gilroy_Bold: require('./assets/fonts/Gilroy-Bold.ttf'),
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
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tab.Screen name="Home" component={Dashboard} />
        <Tab.Screen name="Txns" component={TransactionsScreen} options={{ title: 'Transactions' }} />
        <Tab.Screen name="Insights" component={InsightsScreen} />
        <Tab.Screen name="Review" component={ReviewQueue} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
