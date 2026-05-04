import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { getToken } from '../services/auth';
import { levelApi, zenApi, ZenStatus } from '../services/api';

import { API_BASE_URL } from '../services/config';

const LEVEL_META: Record<string, { name: string; emoji: string; color: string; tagline: string }> = {
  breath: { name: 'Breath', emoji: '🌱', color: '#4ECDC4', tagline: 'Every journey begins with a single breath' },
  stride: { name: 'Stride', emoji: '🏃', color: '#FF6B6B', tagline: "You've found your stride" },
  flow: { name: 'Flow', emoji: '🌊', color: '#6C5CE7', tagline: 'Running in flow' },
  zen: { name: 'Zen', emoji: '🧘', color: '#1A1A1A', tagline: 'Pure running, pure zen' },
};

const LEVEL_GOAL_DEFAULTS: Record<string, { yearly: string; monthly: string }> = {
  breath: { yearly: '250', monthly: '20' },
  stride: { yearly: '500', monthly: '40' },
  flow:   { yearly: '1000', monthly: '80' },
  zen:    { yearly: '1000', monthly: '80' },
};

interface UserGoals {
  start_weight_lbs: number | null;
  goal_weight_lbs: number | null;
  yearly_km_goal: number;
  monthly_km_goal: number;
}

export function ProfileScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { user, logout, deleteAccount, refreshUser } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const goalsLayoutY = useRef(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [handle, setHandle] = useState('');
  const [existingHandle, setExistingHandle] = useState<string | null>(null);
  const [handleError, setHandleError] = useState('');
  const [isSavingHandle, setIsSavingHandle] = useState(false);

  const [startWeight, setStartWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [yearlyGoal, setYearlyGoal] = useState('250');
  const [monthlyGoal, setMonthlyGoal] = useState('20');

  const [currentLevel, setCurrentLevel] = useState('breath');
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  const [profilePrivacy, setProfilePrivacy] = useState<'private' | 'circles' | 'public'>('private');

  const [zen, setZen] = useState<ZenStatus | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [, , levelData, zenData] = await Promise.all([
        fetchGoals(),
        fetchHandle(),
        levelApi.get().catch(() => null),
        zenApi.status().catch(() => null),
      ]);
      if (levelData?.level) setCurrentLevel(levelData.level);
      if (zenData) {
        setZen(zenData);
        if (zenData.level) setCurrentLevel(zenData.level);
        // Server-side just-unlocked: celebrate once, then mark as seen.
        if (zenData.unlocked && !zenData.celebrated) {
          Alert.alert(
            'Zen unlocked 🧘',
            "You've crossed 1000 km this year. Welcome to Zen — pure running, pure zen.\n\nMaintain 1000 km on a rolling year to keep it.",
            [
              {
                text: 'Nice',
                onPress: async () => {
                  try {
                    await zenApi.markCelebrated();
                    setZen(z => (z ? { ...z, celebrated: true } : z));
                  } catch {}
                },
              },
            ],
          );
        }
      }
    } catch {} finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  useFocusEffect(
    useCallback(() => {
      if (route?.params?.scrollTo === 'goals') {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, goalsLayoutY.current - 12),
            animated: true,
          });
        });
        try {
          navigation.setParams({ scrollTo: undefined });
        } catch {}
      }
    }, [route?.params?.scrollTo, navigation]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  async function fetchGoals() {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/user/goals`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const goals: UserGoals = await response.json();
        setStartWeight(goals.start_weight_lbs?.toString() || '');
        setGoalWeight(goals.goal_weight_lbs?.toString() || '');
        setYearlyGoal(goals.yearly_km_goal?.toString() || '250');
        setMonthlyGoal(goals.monthly_km_goal?.toString() || '20');
      }
    } catch {}
  }

  async function fetchHandle() {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/user/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        if (userData.profile_privacy) {
          setProfilePrivacy(userData.profile_privacy);
        }
        if (userData.handle) {
          setExistingHandle(userData.handle);
          setHandle(userData.handle);
        } else {
          setExistingHandle(null);
          setHandle('');
        }
      }
    } catch {}
  }

  async function changePrivacy(newPrivacy: 'private' | 'circles' | 'public') {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/user/privacy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ privacy: newPrivacy }),
      });
      if (response.ok) {
        setProfilePrivacy(newPrivacy);
      } else {
        Alert.alert('Error', 'Failed to update privacy');
      }
    } catch {
      Alert.alert('Error', 'Failed to update privacy');
    }
  }

  async function copyProfileLink() {
    if (existingHandle) {
      await Clipboard.setStringAsync(`https://zenrun.co/runner/${existingHandle}`);
      Alert.alert('Copied', 'Profile link copied to clipboard');
    }
  }

  async function changeLevel(newLevel: string) {
    try {
      await levelApi.set(newLevel);
      setCurrentLevel(newLevel);
      setShowLevelPicker(false);
      const defaults = LEVEL_GOAL_DEFAULTS[newLevel];
      if (defaults) {
        setYearlyGoal(defaults.yearly);
        setMonthlyGoal(defaults.monthly);
      }
      Alert.alert('Level Updated', `You're now a ${LEVEL_META[newLevel]?.name || newLevel} runner. Goals updated to match.`);
    } catch {
      Alert.alert('Error', 'Failed to update level');
    }
  }

  async function saveHandle() {
    const cleanHandle = handle.trim().toLowerCase();
    if (!cleanHandle || cleanHandle.length < 3) {
      setHandleError('Handle must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(cleanHandle)) {
      setHandleError('Only letters, numbers, and underscores allowed');
      return;
    }
    setIsSavingHandle(true);
    setHandleError('');
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/user/handle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ handle: cleanHandle }),
      });
      if (response.ok) {
        setExistingHandle(cleanHandle);
        Alert.alert('Success', 'Handle set! This cannot be changed.');
        await refreshUser();
      } else {
        const error = await response.json();
        setHandleError(error.detail || 'Handle not available');
      }
    } catch {
      setHandleError('Failed to save handle');
    } finally {
      setIsSavingHandle(false);
    }
  }

  async function saveGoals() {
    setIsSaving(true);
    try {
      const token = await getToken();
      const payload = {
        start_weight_lbs: startWeight ? parseFloat(startWeight) : null,
        goal_weight_lbs: goalWeight ? parseFloat(goalWeight) : null,
        yearly_km_goal: parseFloat(yearlyGoal) || 250,
        monthly_km_goal: parseFloat(monthlyGoal) || 20,
      };
      const response = await fetch(`${API_BASE_URL}/user/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        Alert.alert('Saved', 'Goals updated!');
      } else {
        const errorText = await response.text();
        let detail = `Status: ${response.status}`;
        try { detail = JSON.parse(errorText).detail || errorText; } catch { detail = errorText || `HTTP ${response.status}`; }
        Alert.alert('Error', `Failed to save goals: ${detail}`);
      }
    } catch (error: any) {
      Alert.alert('Error', `Network error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data including runs, goals, and circle memberships. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'All your running history and data will be lost forever.',
              [
                { text: 'Keep Account', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeleting(true);
                    try {
                      await deleteAccount();
                    } catch (error: any) {
                      Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
                      setIsDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* User Info */}
        <View style={[styles.section, shadows.small]}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Runner'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              {existingHandle && <Text style={styles.userHandle}>@{existingHandle}</Text>}
            </View>
          </View>
        </View>

        {/* Profile Visibility */}
        <View style={[styles.section, shadows.small]}>
          <Text style={styles.sectionTitle}>Profile Visibility</Text>
          <View style={styles.privacyOptions}>
            {([
              { key: 'private' as const, icon: 'lock-closed-outline' as const, label: 'Private', desc: 'Only you can see your profile' },
              { key: 'circles' as const, icon: 'people-outline' as const, label: 'Circles', desc: 'Visible to circle members on zenrun.co' },
              { key: 'public' as const, icon: 'globe-outline' as const, label: 'Public', desc: 'Anyone can see your journey' },
            ]).map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.privacyOption, profilePrivacy === opt.key && styles.privacyOptionActive]}
                onPress={() => changePrivacy(opt.key)}
              >
                <Ionicons name={opt.icon} size={20} color={profilePrivacy === opt.key ? colors.primary : colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.privacyLabel, profilePrivacy === opt.key && { color: colors.primary }]}>{opt.label}</Text>
                  <Text style={styles.privacyDesc}>{opt.desc}</Text>
                </View>
                {profilePrivacy === opt.key && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
          {profilePrivacy !== 'private' && existingHandle && (
            <TouchableOpacity style={styles.shareLink} onPress={copyProfileLink}>
              <Ionicons name="link-outline" size={18} color={colors.primary} />
              <Text style={styles.shareLinkText}>zenrun.co/runner/{existingHandle}</Text>
              <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.linkRow, shadows.small]}
          onPress={() =>
            navigation
              .getParent()
              ?.navigate('Community', {
                screen: 'Neighbourhood',
                params: { openSettings: true },
              })
          }
          activeOpacity={0.7}
        >
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <Text style={styles.linkRowText}>Neighbourhood settings</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Runner Level */}
        <View style={[styles.section, shadows.small]}>
          <Text style={styles.sectionTitle}>Runner Level</Text>
          <TouchableOpacity
            style={styles.levelDisplay}
            onPress={() => setShowLevelPicker(!showLevelPicker)}
            activeOpacity={0.7}
          >
            <Text style={styles.levelEmoji}>{LEVEL_META[currentLevel]?.emoji || '🏃'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelName}>{LEVEL_META[currentLevel]?.name || currentLevel}</Text>
              <Text style={styles.levelTagline}>{LEVEL_META[currentLevel]?.tagline || ''}</Text>
            </View>
            <Ionicons name={showLevelPicker ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {showLevelPicker && (
            <View style={styles.levelOptions}>
              {(['breath', 'stride', 'flow'] as const).map(key => {
                const meta = LEVEL_META[key];
                const isActive = currentLevel === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.levelOption, isActive && { backgroundColor: meta.color + '15', borderColor: meta.color }]}
                    onPress={() => changeLevel(key)}
                  >
                    <Text style={styles.levelOptionEmoji}>{meta.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.levelOptionName, isActive && { color: meta.color }]}>{meta.name}</Text>
                      <Text style={styles.levelOptionTagline}>{meta.tagline}</Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={20} color={meta.color} />}
                  </TouchableOpacity>
                );
              })}

              {/* Zen — auto-unlocked at 1000km/yr, maintained on rolling 365d. */}
              {(() => {
                const meta = LEVEL_META.zen;
                const unlocked = !!zen?.unlocked;
                const isActive = currentLevel === 'zen';
                const yearKm = zen?.year_km ?? 0;
                const yearTarget = zen?.year_threshold_km ?? 1000;
                const rollingKm = zen?.rolling_km ?? 0;
                const grace = zen?.status === 'grace';
                const graceDays = zen?.grace_days_remaining ?? 0;
                const subline = !unlocked
                  ? `${yearKm.toFixed(0)} / ${yearTarget.toFixed(0)} km this year`
                  : grace
                    ? `Maintaining: ${rollingKm.toFixed(0)} / ${yearTarget.toFixed(0)} km · ${graceDays}d grace`
                    : meta.tagline;
                return (
                  <TouchableOpacity
                    key="zen"
                    style={[
                      styles.levelOption,
                      isActive && { backgroundColor: meta.color + '15', borderColor: meta.color },
                      !unlocked && { opacity: 0.55 },
                    ]}
                    onPress={() => unlocked && changeLevel('zen')}
                    disabled={!unlocked}
                    activeOpacity={unlocked ? 0.7 : 1}
                  >
                    <Text style={styles.levelOptionEmoji}>{meta.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.levelOptionName, isActive && { color: meta.color }]}>{meta.name}</Text>
                        {!unlocked && (
                          <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                        )}
                      </View>
                      <Text style={styles.levelOptionTagline} numberOfLines={1}>{subline}</Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={20} color={meta.color} />}
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}
        </View>

        {/* Handle */}
        {!existingHandle && (
          <View style={[styles.section, shadows.small]}>
            <Text style={styles.sectionTitle}>Set Your Handle</Text>
            <Text style={styles.handleWarning}>Choose carefully — this cannot be changed later</Text>
            <View style={styles.handleInputRow}>
              <Text style={styles.handlePrefix}>@</Text>
              <TextInput
                style={styles.handleInput}
                value={handle}
                onChangeText={(t) => { setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, '')); setHandleError(''); }}
                placeholder="yourhandle"
                placeholderTextColor={colors.textLight}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
            </View>
            {handleError ? <Text style={styles.handleError}>{handleError}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryButton, isSavingHandle && styles.buttonDisabled]}
              onPress={saveHandle}
              disabled={isSavingHandle}
            >
              {isSavingHandle ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Set Handle</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View
          onLayout={(e) => {
            goalsLayoutY.current = e.nativeEvent.layout.y;
          }}
        >
        <View style={[styles.section, shadows.small]}>
          <Text style={styles.sectionTitle}>Goals</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Yearly (km)</Text>
              <TextInput
                style={styles.input}
                value={yearlyGoal}
                onChangeText={setYearlyGoal}
                keyboardType="numeric"
                placeholder="1000"
                placeholderTextColor={colors.textLight}
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>Monthly (km)</Text>
              <TextInput
                style={styles.input}
                value={monthlyGoal}
                onChangeText={setMonthlyGoal}
                keyboardType="numeric"
                placeholder="80"
                placeholderTextColor={colors.textLight}
              />
            </View>
          </View>
        </View>

        {/* Save Goals */}
        <TouchableOpacity
          style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
          onPress={saveGoals}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>Save Goals</Text>
          )}
        </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.textLight} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color={colors.textLight} />
              <Text style={styles.deleteAccountText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>ZenRun v1.6.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  placeholder: { width: 32 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  linkRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  linkRowText: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
  userInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  userName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  userEmail: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  userHandle: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  levelDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  levelEmoji: { fontSize: 28 },
  levelName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  levelTagline: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  levelOptions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  levelOptionEmoji: { fontSize: 22 },
  levelOptionName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  levelOptionTagline: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  handleWarning: {
    fontSize: typography.sizes.sm,
    color: colors.warning || '#F39C12',
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  handleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  handlePrefix: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  handleInput: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  handleError: {
    fontSize: typography.sizes.sm,
    color: colors.error || '#FF6B6B',
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputHalf: { flex: 1 },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  logoutText: {
    color: colors.error,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginLeft: spacing.sm,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  deleteAccountText: {
    color: colors.textLight,
    fontSize: typography.sizes.sm,
    marginLeft: spacing.xs,
  },
  version: {
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginBottom: spacing.xxl,
  },
  privacyOptions: {
    gap: spacing.sm,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  privacyOptionActive: {
    backgroundColor: colors.primary + '08',
    borderColor: colors.primary + '30',
  },
  privacyLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  privacyDesc: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  shareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  shareLinkText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
});
