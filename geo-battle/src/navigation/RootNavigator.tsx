import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';

import { useUserStore } from '../stores/userStore';
import WelcomeScreen from '../screens/WelcomeScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { FACTIONS } from '../constants/factions';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const darkTheme = {
  dark: true,
  colors: {
    primary: '#1E8FD9',
    background: '#0A0A0F',
    card: '#0E0E18',
    text: '#E8E8F0',
    border: '#1A1A2A',
    notification: '#FF4444',
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
};

function MainTabs() {
  const { faction } = useUserStore();
  const factionColor = faction ? FACTIONS[faction].color : '#1E8FD9';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          const icons: Record<string, string> = { Karte: '🗺️', Profil: '👤' };
          return (
            <Text style={{ fontSize: focused ? 22 : 18 }}>
              {icons[route.name] ?? '●'}
            </Text>
          );
        },
        tabBarActiveTintColor: factionColor,
        tabBarInactiveTintColor: '#555',
        tabBarStyle: {
          backgroundColor: '#0E0E18',
          borderTopColor: '#1A1A2A',
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 65,
        },
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      <Tab.Screen name="Karte" component={MapScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { isOnboarded } = useUserStore();

  return (
    <NavigationContainer theme={darkTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isOnboarded ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
