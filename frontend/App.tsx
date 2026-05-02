/**
 * 🏃 ZENRUN APP
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';

// 📱 Screens
import { HomeScreen } from './screens/HomeScreen';
import { RunScreen } from './screens/RunScreen';
import { RunsTabScreen } from './screens/RunsTabScreen';
import { AddRunScreen } from './screens/AddRunScreen';
import { ActiveRunScreen } from './screens/ActiveRunScreen';
import { RunSummaryScreen } from './screens/RunSummaryScreen';
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
import { WatchDiagnosticsScreen } from './screens/WatchDiagnosticsScreen';
import { PhotoRecoveryScreen } from './screens/PhotoRecoveryScreen';
import { GymTabScreen } from './screens/GymTabScreen';
import { StepsTabScreen } from './screens/StepsTabScreen';
import { WeightTabScreen } from './screens/WeightTabScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { GoButton } from './components/GoButton';

// Registers background-location TaskManager task at app start
import './services/walkBackgroundTask';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { colors } from './theme/colors';
import { registerWatchWorkoutSync, drainPendingWatchPayloads } from './services/watchBridge';
import { drainPendingPhoneActivities } from './services/pendingPhoneActivities';

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
// Root = RunsTabScreen (history + stats). Go button routes to ActiveRun or RunScreen.
function RunsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RunHistory"
        component={RunsTabScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RunScreen"
        component={RunScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ActiveRun"
        component={ActiveRunScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="RunSummary"
        component={RunSummaryScreen}
        options={{ headerShown: false, gestureEnabled: false }}
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
// Hub + Circles + Gym (with stats) + Steps (with stats)
function LabsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="BetaHome" component={BetaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CirclesList" component={CirclesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CircleSpace" component={CircleSpaceScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GymTab" component={GymTabScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StepsTab" component={StepsTabScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WeightTab" component={WeightTabScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WatchDiagnostics" component={WatchDiagnosticsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PhotoRecovery" component={PhotoRecoveryScreen} options={{ headerShown: false }} />
      {/* Keep legacy history routes for any deep-links still using them */}
      <Stack.Screen name="GymHistory" component={HistoryScreen} initialParams={{ mode: 'gym' }} options={{ headerShown: false }} />
      <Stack.Screen name="StepsHistory" component={HistoryScreen} initialParams={{ mode: 'steps' }} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// ─── Go placeholder ───────────────────────────────────────────────────────────
// The Tab.Screen for the centre slot needs a component; GoButton renders the
// actual UI as a tabBarButton overlay so this is never displayed.
function GoPlaceholder() { return null; }

// ─── Main Tabs ────────────────────────────────────────────────────────────────
// Layout: Home | Runs | [GO] | Walks | Labs
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
            case 'Home':  icon = focused ? 'home'    : 'home-outline';    break;
            case 'Runs':  icon = focused ? 'fitness' : 'fitness-outline'; break;
            case 'Walks': icon = focused ? 'walk'    : 'walk-outline';    break;
            case 'Labs':  icon = focused ? 'flask'   : 'flask-outline';   break;
          }
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"  component={HomeStack}    options={{ tabBarLabel: 'Home'  }} />
      <Tab.Screen name="Runs"  component={RunsStack}    options={{ tabBarLabel: 'Runs'  }} />
      <Tab.Screen
        name="Go"
        component={GoPlaceholder}
        options={{
          tabBarLabel: '',
          tabBarButton: () => <GoButton />,
        }}
      />
      <Tab.Screen
        name="Walks"
        component={WalkStack}
        options={{ tabBarLabel: 'Walks' }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Walks', { screen: 'WalkHome' });
          },
        })}
      />
      <Tab.Screen name="Labs"  component={LabsStack}    options={{ tabBarLabel: 'Labs'  }} />
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

function WatchWorkoutBridgeHost() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const sub = registerWatchWorkoutSync();
    return () => sub.remove();
  }, []);

  // Drain any payloads queued while signed-out as soon as auth is ready.
  // Both the watch queue (workouts that failed to upload at receive-time) and
  // the phone-side draft queue (in-app recordings whose save call failed)
  // retry here. Phone drafts run after the watch drain to keep the alert
  // ordering predictable.
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      await drainPendingWatchPayloads();
      const result = await drainPendingPhoneActivities();
      if (result.succeeded > 0) {
        const noun = result.succeeded === 1 ? 'recording' : 'recordings';
        Alert.alert(
          'Recordings restored',
          `${result.succeeded} pending ${noun} from earlier ${result.succeeded === 1 ? 'has' : 'have'} now been saved.`,
        );
      }
    })();
  }, [isAuthenticated]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        {/* Mounted at root so the native event listener is attached before
            auth resolves; otherwise iOS can deliver queued WCSession user
            infos during cold launch and the events get dropped. */}
        <WatchWorkoutBridgeHost />
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
