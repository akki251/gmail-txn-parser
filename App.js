import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Dashboard from './src/screens/Dashboard';
import Splitter from './src/screens/Splitter';
import ReviewQueue from './src/screens/ReviewQueue';
import SMSIngestSimulator from './src/screens/SMSIngestSimulator';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0f172a',
            borderTopColor: '#334155',
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#818cf8',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={Dashboard}
          options={{
            tabBarLabel: 'Ledger',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📊</Text>,
          }}
        />
        <Tab.Screen
          name="Splitter"
          component={Splitter}
          options={{
            tabBarLabel: 'Splitwise',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👥</Text>,
          }}
        />
        <Tab.Screen
          name="ReviewQueue"
          component={ReviewQueue}
          options={{
            tabBarLabel: 'Review',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⚠️</Text>,
          }}
        />
        <Tab.Screen
          name="SMSIngestSimulator"
          component={SMSIngestSimulator}
          options={{
            tabBarLabel: 'SMS Lab',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📲</Text>,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
