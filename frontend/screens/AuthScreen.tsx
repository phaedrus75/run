/**
 * 🔐 AUTH SCREEN
 * ===============
 * 
 * Landing page for ZenRun.
 * Communicates the brand: "Less tracking. More running."
 * Includes login, signup, and forgot password flows.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { forgotPassword, resetPassword } from '../services/auth';

const { width } = Dimensions.get('window');

type AuthMode = 'landing' | 'login' | 'signup' | 'forgot' | 'reset';

export default function AuthScreen() {
  const { login, signup } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
      Animated.timing(taglineFade, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleSubmit() {
    if (mode === 'login' || mode === 'signup') {
      if (!email || !password) {
        Alert.alert('Missing Fields', 'Please enter your email and password.');
        return;
      }
      if (mode === 'signup' && password.length < 6) {
        Alert.alert('Password Too Short', 'Use at least 6 characters.');
        return;
      }

      setIsLoading(true);
      try {
        if (mode === 'login') {
          await login(email, password);
        } else {
          await signup(email, password, name || undefined);
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    } else if (mode === 'forgot') {
      if (!email) {
        Alert.alert('Error', 'Please enter your email');
        return;
      }
      setIsLoading(true);
      try {
        await forgotPassword(email);
        Alert.alert(
          'Code Sent',
          'If an account exists with this email, a reset code has been generated.',
          [{ text: 'Enter Code', onPress: () => setMode('reset') }]
        );
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    } else if (mode === 'reset') {
      if (!email || !resetCode || !password) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
      setIsLoading(true);
      try {
        await resetPassword(email, resetCode, password);
        Alert.alert(
          'Password Reset',
          'You can now log in with your new password.',
          [{ text: 'OK', onPress: () => { setMode('login'); clearFields(); } }]
        );
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Invalid or expired code');
      } finally {
        setIsLoading(false);
      }
    }
  }

  function clearFields() {
    setPassword('');
    setConfirmPassword('');
    setResetCode('');
    setName('');
  }

  // Landing page — first impression
  if (mode === 'landing') {
    return (
      <View style={styles.landingContainer}>
        <View style={styles.landingContent}>
          <Animated.View style={[styles.brandBlock, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.brandName}>ZenRun</Text>
            <View style={styles.brandLine} />
          </Animated.View>

          <Animated.View style={{ opacity: taglineFade }}>
            <Text style={styles.tagline}>Less tracking.{'\n'}More running.</Text>
            <Text style={styles.philosophy}>
              No GPS. No heart rate zones.{'\n'}Just log your run and get back to life.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.landingActions, { opacity: taglineFade }]}>
          <TouchableOpacity
            style={styles.landingPrimaryButton}
            onPress={() => setMode('signup')}
          >
            <Text style={styles.landingPrimaryText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.landingSecondaryButton}
            onPress={() => setMode('login')}
          >
            <Text style={styles.landingSecondaryText}>I already have an account</Text>
          </TouchableOpacity>

          <View style={styles.landingPillars}>
            <Text style={styles.pillarItem}>10-second logging</Text>
            <Text style={styles.pillarDot}>  ·  </Text>
            <Text style={styles.pillarItem}>Streaks</Text>
            <Text style={styles.pillarDot}>  ·  </Text>
            <Text style={styles.pillarItem}>Progress</Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome back';
      case 'signup': return 'Start your journey';
      case 'forgot': return 'Reset password';
      case 'reset': return 'Enter reset code';
      default: return '';
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case 'login': return 'Log In';
      case 'signup': return 'Create Account';
      case 'forgot': return 'Send Reset Code';
      case 'reset': return 'Reset Password';
      default: return '';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerBrand}>ZenRun</Text>
          <Text style={styles.headerTitle}>{getTitle()}</Text>
        </View>

        {/* Form */}
        <View style={[styles.form, shadows.small]}>
          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional"
                placeholderTextColor={colors.textLight}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textLight}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {mode === 'reset' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Reset Code</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={colors.textLight}
                value={resetCode}
                onChangeText={setResetCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{mode === 'reset' ? 'New Password' : 'Password'}</Text>
              <TextInput
                style={styles.input}
                placeholder={mode === 'login' ? 'Your password' : 'At least 6 characters'}
                placeholderTextColor={colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </View>
          )}

          {mode === 'reset' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor={colors.textLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>
          )}

          {mode === 'login' && (
            <TouchableOpacity onPress={() => setMode('forgot')} style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.buttonText}>{getButtonText()}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Navigation links */}
        {(mode === 'login' || mode === 'signup') && (
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); clearFields(); }}
          >
            <Text style={styles.toggleText}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleLink}>
                {mode === 'login' ? 'Sign Up' : 'Log In'}
              </Text>
            </Text>
          </TouchableOpacity>
        )}

        {(mode === 'forgot' || mode === 'reset') && (
          <TouchableOpacity style={styles.toggle} onPress={() => { setMode('login'); clearFields(); }}>
            <Text style={styles.toggleText}>
              <Text style={styles.toggleLink}>Back to login</Text>
            </Text>
          </TouchableOpacity>
        )}

        {mode === 'forgot' && (
          <TouchableOpacity style={styles.toggle} onPress={() => setMode('reset')}>
            <Text style={styles.toggleText}>
              Already have a code? <Text style={styles.toggleLink}>Enter Code</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // ---- Landing Page ----
  landingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 60,
    paddingHorizontal: spacing.xl,
  },
  landingContent: {
    alignItems: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandName: {
    fontSize: 52,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -1,
  },
  brandLine: {
    width: 40,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginTop: spacing.md,
  },
  tagline: {
    fontSize: 28,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: spacing.lg,
  },
  philosophy: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  landingActions: {
    alignItems: 'center',
  },
  landingPrimaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    ...shadows.medium,
  },
  landingPrimaryText: {
    color: colors.textOnPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  landingSecondaryButton: {
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  landingSecondaryText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
  },
  landingPillars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  pillarItem: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
  },
  pillarDot: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
  },

  // ---- Auth Form ----
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerBrand: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    color: colors.textSecondary,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.background,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.surface,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
  },
  forgotLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  toggle: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  toggleText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  toggleLink: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});
