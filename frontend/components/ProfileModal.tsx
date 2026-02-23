/**
 * 👤 PROFILE MODAL
 * =================
 * 
 * Modal for viewing/editing user profile, goals, and logging out.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { getToken } from '../services/auth';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

interface UserGoals {
  start_weight_lbs: number | null;
  goal_weight_lbs: number | null;
  yearly_km_goal: number;
  monthly_km_goal: number;
}

export function ProfileModal({ visible, onClose }: ProfileModalProps) {
  const { user, logout, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Handle state
  const [handle, setHandle] = useState('');
  const [existingHandle, setExistingHandle] = useState<string | null>(null);
  const [handleError, setHandleError] = useState('');
  const [isSavingHandle, setIsSavingHandle] = useState(false);
  
  // Goals state
  const [startWeight, setStartWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [yearlyGoal, setYearlyGoal] = useState('1000');
  const [monthlyGoal, setMonthlyGoal] = useState('100');

  // Fetch current goals and handle when modal opens
  useEffect(() => {
    if (visible) {
      fetchGoals();
      fetchHandle();
    }
  }, [visible]);

  async function fetchGoals() {
    setIsLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/user/goals`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const goals: UserGoals = await response.json();
        setStartWeight(goals.start_weight_lbs?.toString() || '');
        setGoalWeight(goals.goal_weight_lbs?.toString() || '');
        setYearlyGoal(goals.yearly_km_goal?.toString() || '1000');
        setMonthlyGoal(goals.monthly_km_goal?.toString() || '100');
      }
    } catch (error) {
      console.log('Failed to fetch goals:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchHandle() {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/user/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        if (userData.handle) {
          setExistingHandle(userData.handle);
          setHandle(userData.handle);
        } else {
          setExistingHandle(null);
          setHandle('');
        }
      } else if (response.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => { logout(); onClose(); } },
        ]);
      }
    } catch (error) {
      console.log('Failed to fetch handle:', error);
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
    } catch (error) {
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
        yearly_km_goal: parseFloat(yearlyGoal) || 1000,
        monthly_km_goal: parseFloat(monthlyGoal) || 100,
      };
      
      console.log('Saving goals:', payload);
      
      const response = await fetch(`${API_BASE_URL}/user/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        Alert.alert('Success', 'Goals updated!');
        onClose();
      } else {
        const errorText = await response.text();
        console.error('Save goals error:', response.status, errorText);
        // Try to parse JSON error detail
        let errorDetail = `Status: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorText;
        } catch {
          errorDetail = errorText || `HTTP ${response.status}`;
        }
        Alert.alert('Error', `Failed to save goals: ${errorDetail}`);
        return;
      }
    } catch (error: any) {
      console.error('Save goals exception:', error);
      Alert.alert('Error', `Network error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          style: 'destructive', 
          onPress: () => {
            logout();
            onClose();
          }
        },
      ]
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile & Goals</Text>
          <View style={styles.placeholder} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* User Info */}
            <View style={[styles.section, shadows.small]}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user?.name || 'Runner'}</Text>
                  <Text style={styles.userEmail}>{user?.email}</Text>
                  {existingHandle && (
                    <Text style={styles.userHandle}>@{existingHandle}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Handle Section - Only show if not set */}
            {!existingHandle && (
              <View style={[styles.section, shadows.small]}>
                <Text style={styles.sectionTitle}>🏷️ Set Your Handle</Text>
                <Text style={styles.handleWarning}>
                  ⚠️ Choose carefully - this cannot be changed later!
                </Text>
                <View style={styles.handleInputRow}>
                  <Text style={styles.handlePrefix}>@</Text>
                  <TextInput
                    style={styles.handleInput}
                    value={handle}
                    onChangeText={(text) => {
                      setHandle(text.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                      setHandleError('');
                    }}
                    placeholder="yourhandle"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                </View>
                {handleError ? (
                  <Text style={styles.handleError}>{handleError}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.handleSaveButton, isSavingHandle && styles.buttonDisabled]}
                  onPress={saveHandle}
                  disabled={isSavingHandle}
                >
                  {isSavingHandle ? (
                    <ActivityIndicator color={colors.surface} size="small" />
                  ) : (
                    <Text style={styles.handleSaveButtonText}>Set Handle</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Weight Goals */}
            <View style={[styles.section, shadows.small]}>
              <Text style={styles.sectionTitle}>⚖️ Weight Goals</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Start Weight (lbs)</Text>
                  <TextInput
                    style={styles.input}
                    value={startWeight}
                    onChangeText={setStartWeight}
                    keyboardType="numeric"
                    placeholder="e.g., 200"
                    placeholderTextColor={colors.textLight}
                  />
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.label}>Goal Weight (lbs)</Text>
                  <TextInput
                    style={styles.input}
                    value={goalWeight}
                    onChangeText={setGoalWeight}
                    keyboardType="numeric"
                    placeholder="e.g., 180"
                    placeholderTextColor={colors.textLight}
                  />
                </View>
              </View>
            </View>

            {/* Running Goals */}
            <View style={[styles.section, shadows.small]}>
              <Text style={styles.sectionTitle}>🏃 Running Goals</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Yearly Goal (km)</Text>
                <TextInput
                  style={styles.input}
                  value={yearlyGoal}
                  onChangeText={setYearlyGoal}
                  keyboardType="numeric"
                  placeholder="1000"
                  placeholderTextColor={colors.textLight}
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Monthly Goal (km)</Text>
                <TextInput
                  style={styles.input}
                  value={monthlyGoal}
                  onChangeText={setMonthlyGoal}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={colors.textLight}
                />
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={saveGoals}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>

            {/* Version */}
            <Text style={styles.version}>RunTracker v1.0.0</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  placeholder: {
    width: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
  handleSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  handleSaveButtonText: {
    color: colors.surface,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputHalf: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.surface,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  logoutButtonText: {
    color: colors.error,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginLeft: spacing.sm,
  },
  version: {
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginBottom: spacing.xl,
  },
});

