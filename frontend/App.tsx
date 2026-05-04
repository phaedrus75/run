/**
 * 🏃 ZENRUN APP
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';

import { navigationRef } from './navigationRef';
import { DrawerProvider } from './contexts/DrawerContext';

// 📱 Screens
import { HomeScreen } from './screens/HomeScreen';
import { RunScreen } from './screens/RunScreen';
import { AddRunScreen } from './screens/AddRunScreen';
import { ActiveRunScreen } from './screens/ActiveRunScreen';
import { RunSummaryScreen } from './screens/RunSummaryScreen';
import { CirclesScreen } from './screens/CirclesScreen';
import { CircleSpaceScreen } from './screens/CircleSpaceScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import AuthScreen from './screens/AuthScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ActiveWalkScreen } from './screens/ActiveWalkScreen';
import { WalkSummaryScreen } from './screens/WalkSummaryScreen';
import { WalkDetailScreen } from './screens/WalkDetailScreen';
import { DiscoverWalksScreen } from './screens/DiscoverWalksScreen';
import { PublicWalkDetailScreen } from './screens/PublicWalkDetailScreen';
import { WatchDiagnosticsScreen } from './screens/WatchDiagnosticsScreen';
import { PhotoRecoveryScreen } from './screens/PhotoRecoveryScreen';
import { PhotoReviewScreen } from './screens/PhotoReviewScreen';
import { AlbumScreen } from './screens/AlbumScreen';
import { AlbumPhotoDetailScreen } from './screens/AlbumPhotoDetailScreen';
import { CommunityHomeScreen } from './screens/CommunityHomeScreen';
import { NeighbourhoodScreen } from './screens/NeighbourhoodScreen';
import { GymTabScreen } from './screens/GymTabScreen';
import { StepsTabScreen } from './screens/StepsTabScreen';
import { WeightTabScreen } from './screens/WeightTabScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import { AboutScreen } from './screens/AboutScreen';
import { HonorsScreen } from './screens/HonorsScreen';
import { GoButton } from './components/GoButton';

import './services/walkBackgroundTask';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { colors } from './theme/colors';
import { registerWatchWorkoutSync, drainPendingWatchPayloads } from './services/watchBridge';
import { drainPendingPhoneActivities } from './services/pendingPhoneActivities';
import { drainPendingUploads } from './services/photoUploader';
import { drainPendingArchives } from './services/photoArchiver';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Home stack (drawer destinations: profile, tools, honors, about) ───────────
function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GymTab" component={GymTabScreen} options={{ headerShown: false }} />
      <Stack.Screen name="StepsTab" component={StepsTabScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WeightTab" component={WeightTabScreen} options={{ headerShown: false }} />
      <Stack.Screen name="WatchDiagnostics" component={WatchDiagnosticsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PhotoRecovery" component={PhotoRecoveryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Honors" component={HonorsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GymHistory" component={HistoryScreen} initialParams={{ mode: 'gym' }} options={{ headerShown: false }} />
      <Stack.Screen name="StepsHistory" component={HistoryScreen} initialParams={{ mode: 'steps' }} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// ─── Activity stack (runs + walks + all drill-downs) ─────────────────────────
function ActivityStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ActivityHome" component={ActivityScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RunScreen" component={RunScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ActiveRun" component={ActiveRunScreen} options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="RunSummary" component={RunSummaryScreen} options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="ActiveWalk" component={ActiveWalkScreen} options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="WalkSummary" component={WalkSummaryScreen} options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="PhotoReview" component={PhotoReviewScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="WalkDetail" component={WalkDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PublicWalkDetail"
        component={PublicWalkDetailScreen}
        options={{
          headerShown: true,
          title: 'Walk preview',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
        }}
      />
      <Stack.Screen
        name="DiscoverWalks"
        component={DiscoverWalksScreen}
        options={{
          headerShown: true,
          title: 'Discover walks',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
        }}
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

function AlbumStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AlbumGrid" component={AlbumScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AlbumPhoto" component={AlbumPhotoDetailScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function CommunityStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CommunityHome" component={CommunityHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Neighbourhood" component={NeighbourhoodScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CirclesList" component={CirclesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CircleSpace" component={CircleSpaceScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function GoPlaceholder() {
  return null;
}

// ─── Main Tabs: Home | Activity | GO | Album | Community (5 slots, GO centred)
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarIconStyle: { marginBottom: -2 },
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Activity') {
            return <MaterialCommunityIcons name="routes" size={size + 2} color={color} />;
          }
          let icon: keyof typeof Ionicons.glyphMap = 'home';
          switch (route.name) {
            case 'Home':
              icon = focused ? 'home' : 'home-outline';
              break;
            case 'Album':
              icon = focused ? 'images' : 'images-outline';
              break;
            case 'Community':
              icon = focused ? 'people' : 'people-outline';
              break;
          }
          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Activity" component={ActivityStack} options={{ tabBarLabel: 'Activity' }} />
      <Tab.Screen
        name="Go"
        component={GoPlaceholder}
        options={{
          tabBarLabel: '',
          tabBarButton: () => <GoButton />,
        }}
      />
      <Tab.Screen name="Album" component={AlbumStack} options={{ tabBarLabel: 'Album' }} />
      <Tab.Screen name="Community" component={CommunityStack} options={{ tabBarLabel: 'Community' }} />
    </Tab.Navigator>
  );
}

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
    <NavigationContainer ref={navigationRef}>
      <DrawerProvider>
        <MainTabs />
      </DrawerProvider>
    </NavigationContainer>
  );
}

function WatchWorkoutBridgeHost() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const sub = registerWatchWorkoutSync();
    return () => sub.remove();
  }, []);

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
      void drainPendingUploads();
      void drainPendingArchives();
    })();
  }, [isAuthenticated]);

  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <WatchWorkoutBridgeHost />
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
