/**
 * 🏃 RUNTRACKER APP
 * ==================
 * 
 * Welcome to the main entry point of our React Native app!
 * 
 * 🎓 LEARNING NOTES:
 * - This file sets up navigation (moving between screens)
 * - We use React Navigation for tab-based navigation
 * - SafeAreaProvider ensures content doesn't go under notches
 * - AuthProvider manages user authentication state
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// 📱 Import our screens
import { HomeScreen } from './screens/HomeScreen';
import { RunScreen } from './screens/RunScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { AddRunScreen } from './screens/AddRunScreen';
import { StatsScreen } from './screens/StatsScreen';
import AuthScreen from './screens/AuthScreen';

// 🔐 Import auth context
import { AuthProvider, useAuth } from './contexts/AuthContext';

// 🎨 Import our theme
import { colors } from './theme/colors';

// 🧭 Create navigators
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/**
 * 📜 History Stack - History tab with Add Run screen
 */
function HistoryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="HistoryMain" 
        component={HistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="AddRun" 
        component={AddRunScreen}
        options={{ 
          headerShown: true,
          title: 'Add Past Run',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
        }}
      />
    </Stack.Navigator>
  );
}

/**
 * 🏠 Main Tabs - Shown when user is authenticated
 */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // 🎨 Hide the default header (we have custom headers)
        headerShown: false,
        
        // 🎨 Tab bar styling
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        
        // 🎨 Active/inactive colors
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        
        // 🎨 Label styling
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        
        // 🎨 Icon configuration
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          
          // 📍 Set icon based on route name
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Run':
              iconName = focused ? 'play-circle' : 'play-circle-outline';
              break;
            case 'Stats':
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
              break;
            case 'History':
              iconName = focused ? 'list' : 'list-outline';
              break;
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* 🏠 Home Tab */}
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      
      {/* 🏃 Run Tab */}
      <Tab.Screen 
        name="Run" 
        component={RunScreen}
        options={{ tabBarLabel: 'Run' }}
      />
      
      {/* 📊 Stats Tab */}
      <Tab.Screen 
        name="Stats" 
        component={StatsScreen}
        options={{ tabBarLabel: 'Stats' }}
      />
      
      {/* 📜 History Tab */}
      <Tab.Screen 
        name="History" 
        component={HistoryStack}
        options={{ tabBarLabel: 'History' }}
      />
    </Tab.Navigator>
  );
}

/**
 * 🔄 App Navigator - Chooses between Auth and Main based on login state
 */
function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabs /> : <AuthScreen />}
    </NavigationContainer>
  );
}

/**
 * 🏠 Main App Component
 * 
 * This wraps everything in necessary providers and sets up navigation.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      {/* 📱 Status bar configuration */}
      <StatusBar style="dark" />
      
      {/* 🔐 Auth provider - manages authentication state */}
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
