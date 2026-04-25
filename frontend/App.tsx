/**
 * 🏃 ZENRUN APP
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// 📱 Screens
import { HomeScreen } from './screens/HomeScreen';
import { RunScreen } from './screens/RunScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { AddRunScreen } from './screens/AddRunScreen';
import { StatsScreen } from './screens/StatsScreen';
import { CirclesScreen } from './screens/CirclesScreen';
import { CircleSpaceScreen } from './screens/CircleSpaceScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import AuthScreen from './screens/AuthScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { WalkScreen } from './screens/WalkScreen';
import { ActiveWalkScreen } from './screens/ActiveWalkScreen';
import { WalkSummaryScreen } from './screens/WalkSummaryScreen';
import { WalkDetailScreen } from './screens/WalkDetailScreen';
import { DiscoverWalksScreen } from './screens/DiscoverWalksScreen';
import { PublicWalkDetailScreen } from './screens/PublicWalkDetailScreen';
import { BetaScreen } from './screens/BetaScreen';

// Registers background-location TaskManager task at app start
import './services/walkBackgroundTask';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { colors } from './theme/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Home stack ───────────────────────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// ─── Runs stack ───────────────────────────────────────────────────────────────
// Root = run history (runs only). "Log Run" header button → RunScreen.
function RunsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RunHistory"
        component={HistoryScreen}
        initialParams={{ mode: 'runs' }}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RunScreen"
        component={RunScreen}
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

// ─── Walk stack ───────────────────────────────────────────────────────────────
function WalkStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="WalkHome" component={WalkScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ActiveWalk" component={ActiveWalkScreen} options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="WalkSummary" component={WalkSummaryScreen} options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="WalkDetail" component={WalkDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PublicWalkDetail"
        component={PublicWalkDetailScreen}
        options={{ headerShown: true, title: 'Walk preview', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.primary }}
      />
      <Stack.Screen
        name="DiscoverWalks"
        component={DiscoverWalksScreen}
        options={{ headerShown: true, title: 'Discover walks', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.primary }}
      />
    </Stack.Navigator>
  );
}

// ─── Labs stack ───────────────────────────────────────────────────────────────
// Hub + Circles + Gym history + Steps history
function LabsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="BetaHome" component={BetaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CirclesList" component={CirclesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CircleSpace" component={CircleSpaceScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="GymHistory"
        component={HistoryScreen}
        initialParams={{ mode: 'gym' }}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StepsHistory"
        component={HistoryScreen}
        initialParams={{ mode: 'steps' }}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────
// Layout: Home | Runs | Walks | Stats | Labs
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          let icon: keyof typeof Ionicons.glyphMap = 'home';
          switch (route.name) {
            case 'Home':  icon = focused ? 'home'      : 'home-outline';      break;
            case 'Runs':  icon = focused ? 'fitness'   : 'fitness-outline';   break;
            case 'Walks': icon = focused ? 'walk'      : 'walk-outline';      break;
            case 'Stats': icon = focused ? 'bar-chart' : 'bar-chart-outline'; break;
            case 'Labs':  icon = focused ? 'flask'     : 'flask-outline';     break;
          }
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"  component={HomeStack}   options={{ tabBarLabel: 'Home'  }} />
      <Tab.Screen name="Runs"  component={RunsStack}   options={{ tabBarLabel: 'Runs'  }} />
      <Tab.Screen name="Walks" component={WalkStack}   options={{ tabBarLabel: 'Walks' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: 'Stats' }} />
      <Tab.Screen name="Labs"  component={LabsStack}   options={{ tabBarLabel: 'Labs'  }} />
    </Tab.Navigator>
  );
}

// ─── App Navigator ────────────────────────────────────────────────────────────
function AppNavigator() {
  const { isLoading, isAuthenticated, needsOnboarding } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <NavigationContainer>
        <AuthScreen />
      </NavigationContainer>
    );
  }

  if (needsOnboarding) {
    return <OnboardingScreen navigation={null} />;
  }

  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
