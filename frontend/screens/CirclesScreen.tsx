/**
 * 👥 CIRCLES SCREEN
 * ==================
 * 
 * Social feature - compete with friends in circles.
 * Create circles, join via invite code, see leaderboards.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { getToken } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

interface Circle {
  id: number;
  name: string;
  invite_code: string;
  member_count: number;
  is_creator: boolean;
  joined_at: string;
}

interface CircleMember {
  user_id: number;
  name: string;
  handle: string | null;
  total_runs: number;
  total_km: number;
  monthly_km: number;
  monthly_runs: number;
  rank: number;
  is_you: boolean;
}

interface CircleDetails {
  id: number;
  name: string;
  invite_code: string;
  member_count: number;
  members: CircleMember[];
  created_by: number;
}

export function CirclesScreen() {
  const { logout } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<CircleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCircleModal, setShowCircleModal] = useState(false);
  
  // Form state
  const [newCircleName, setNewCircleName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCircles = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/circles`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCircles(data);
      } else if (response.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => logout() },
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch circles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useFocusEffect(
    useCallback(() => {
      fetchCircles();
    }, [fetchCircles])
  );

  const fetchCircleDetails = async (circleId: number) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/circles/${circleId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCircle(data);
        setShowCircleModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch circle details:', error);
    }
  };

  const handleCreateCircle = async () => {
    if (!newCircleName.trim()) {
      Alert.alert('Error', 'Please enter a circle name');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/circles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCircleName.trim() }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setShowCreateModal(false);
        setNewCircleName('');
        fetchCircles();
        Alert.alert(
          '🎉 Circle Created!',
          `Share this code with friends:\n\n${data.invite_code}`,
          [
            { text: 'Copy Code', onPress: () => shareInviteCode(data.invite_code, data.name) },
            { text: 'Done' },
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to create circle');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create circle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinCircle = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/circles/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ invite_code: inviteCode.trim() }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setShowJoinModal(false);
        setInviteCode('');
        fetchCircles();
        Alert.alert('🎉 Welcome!', data.message);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to join circle');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to join circle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveCircle = async (circleId: number, circleName: string) => {
    Alert.alert(
      'Leave Circle',
      `Are you sure you want to leave "${circleName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              await fetch(`${API_BASE_URL}/circles/${circleId}/leave`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              setShowCircleModal(false);
              fetchCircles();
            } catch (error) {
              Alert.alert('Error', 'Failed to leave circle');
            }
          },
        },
      ]
    );
  };

  const shareInviteCode = async (code: string, name: string) => {
    try {
      await Share.share({
        message: `Join my running circle "${name}" on RunZen!\n\nUse invite code: ${code}`,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCircles();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>👥 Circles</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowJoinModal(true)}
          >
            <Ionicons name="enter-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, styles.createButton]}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color={colors.surface} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
        ) : circles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>No Circles Yet</Text>
            <Text style={styles.emptyText}>
              Create a circle to compete with friends, or join one with an invite code.
            </Text>
            <View style={styles.emptyButtons}>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.emptyButtonText}>Create Circle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyButton, styles.emptyButtonSecondary]}
                onPress={() => setShowJoinModal(true)}
              >
                <Text style={[styles.emptyButtonText, styles.emptyButtonTextSecondary]}>
                  Join Circle
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          circles.map((circle) => (
            <TouchableOpacity
              key={circle.id}
              style={[styles.circleCard, shadows.small]}
              onPress={() => fetchCircleDetails(circle.id)}
            >
              <View style={styles.circleInfo}>
                <Text style={styles.circleName}>{circle.name}</Text>
                <Text style={styles.circleMeta}>
                  {circle.member_count} member{circle.member_count !== 1 ? 's' : ''}
                  {circle.is_creator && ' • Creator'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create Circle Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Circle</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>👥</Text>
            <Text style={styles.modalSubtitle}>
              Create a circle to compete with friends. Share the invite code to let them join.
            </Text>

            <TextInput
              style={styles.textInput}
              value={newCircleName}
              onChangeText={setNewCircleName}
              placeholder="Circle name (e.g., Office Runners)"
              placeholderTextColor={colors.textLight}
              maxLength={30}
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleCreateCircle}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.submitButtonText}>Create Circle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join Circle Modal */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowJoinModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Join Circle</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>🤝</Text>
            <Text style={styles.modalSubtitle}>
              Enter the invite code shared by a friend to join their circle.
            </Text>

            <TextInput
              style={[styles.textInput, styles.codeInput]}
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              placeholder="INVITE CODE"
              placeholderTextColor={colors.textLight}
              autoCapitalize="characters"
              maxLength={10}
            />

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleJoinCircle}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.submitButtonText}>Join Circle</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Circle Details Modal */}
      <Modal
        visible={showCircleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCircleModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCircleModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedCircle?.name}</Text>
            <TouchableOpacity
              onPress={() => shareInviteCode(
                selectedCircle?.invite_code || '',
                selectedCircle?.name || ''
              )}
            >
              <Ionicons name="share-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {selectedCircle && (
            <ScrollView style={styles.modalContent}>
              {/* Invite Code */}
              <View style={styles.inviteCodeCard}>
                <Text style={styles.inviteCodeLabel}>Invite Code</Text>
                <Text style={styles.inviteCodeValue}>{selectedCircle.invite_code}</Text>
              </View>

              {/* Leaderboard */}
              <Text style={styles.leaderboardTitle}>🏆 This Month's Leaderboard</Text>
              
              {selectedCircle.members.map((member) => (
                <View
                  key={member.user_id}
                  style={[
                    styles.memberCard,
                    member.is_you && styles.memberCardYou,
                  ]}
                >
                  <Text style={styles.memberRank}>{getRankEmoji(member.rank)}</Text>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.name}
                      {member.is_you && ' (You)'}
                    </Text>
                    {member.handle && (
                      <Text style={styles.memberHandle}>@{member.handle}</Text>
                    )}
                  </View>
                  <View style={styles.memberStats}>
                    <Text style={styles.memberKm}>{member.monthly_km} km</Text>
                    <Text style={styles.memberRuns}>{member.monthly_runs} runs</Text>
                  </View>
                </View>
              ))}

              {/* Leave Button */}
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={() => handleLeaveCircle(selectedCircle.id, selectedCircle.name)}
              >
                <Text style={styles.leaveButtonText}>Leave Circle</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emptyButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  emptyButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  emptyButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
  emptyButtonTextSecondary: {
    color: colors.primary,
  },
  circleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  circleInfo: {
    flex: 1,
  },
  circleName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  circleMeta: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  modalEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    fontSize: typography.sizes.md,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: 4,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.surface,
  },
  inviteCodeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  inviteCodeLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inviteCodeValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    letterSpacing: 2,
  },
  leaderboardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  memberCardYou: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  memberRank: {
    fontSize: 24,
    width: 40,
    textAlign: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  memberName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  memberHandle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  memberStats: {
    alignItems: 'flex-end',
  },
  memberKm: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  memberRuns: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
  leaveButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: typography.sizes.md,
    color: colors.error || '#FF6B6B',
  },
});
