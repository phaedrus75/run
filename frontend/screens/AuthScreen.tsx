/**
 * 🔐 AUTH SCREEN
 * ===============
 * 
 * Login and Signup screen with a clean, modern design.
 * Includes forgot password flow.
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { forgotPassword, resetPassword } from '../services/auth';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

export default function AuthScreen() {
  const { login, signup } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    if (mode === 'login' || mode === 'signup') {
      if (!email || !password) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      if (mode === 'signup' && password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
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
          'Check Your Email',
          'If an account exists with this email, a reset code has been generated. Check the server logs or your email.',
          [{ text: 'OK', onPress: () => setMode('reset') }]
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
          'Success',
          'Your password has been reset. You can now log in.',
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

  function toggleMode() {
    if (mode === 'login') {
      setMode('signup');
    } else {
      setMode('login');
    }
    clearFields();
  }

  function goToForgotPassword() {
    setMode('forgot');
    clearFields();
  }

  function goBackToLogin() {
    setMode('login');
    clearFields();
  }

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome back!';
      case 'signup': return 'Create your account';
      case 'forgot': return 'Forgot Password';
      case 'reset': return 'Reset Password';
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case 'login': return 'Log In';
      case 'signup': return 'Sign Up';
      case 'forgot': return 'Send Reset Code';
      case 'reset': return 'Reset Password';
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
        {/* Logo/Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🏃</Text>
          <Text style={styles.title}>RunTracker</Text>
          <Text style={styles.subtitle}>{getTitle()}</Text>
        </View>

        {/* Form */}
        <View style={[styles.form, shadows.medium]}>
          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Name (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
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
            <TouchableOpacity onPress={goToForgotPassword} style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>Forgot Password?</Text>
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

        {/* Toggle / Back */}
        {(mode === 'login' || mode === 'signup') && (
          <TouchableOpacity style={styles.toggle} onPress={toggleMode}>
            <Text style={styles.toggleText}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleLink}>
                {mode === 'login' ? 'Sign Up' : 'Log In'}
              </Text>
            </Text>
          </TouchableOpacity>
        )}

        {(mode === 'forgot' || mode === 'reset') && (
          <TouchableOpacity style={styles.toggle} onPress={goBackToLogin}>
            <Text style={styles.toggleText}>
              <Text style={styles.toggleLink}>← Back to Login</Text>
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

        {/* Features - only show on login/signup */}
        {(mode === 'login' || mode === 'signup') && (
          <View style={styles.features}>
            <Text style={styles.featuresTitle}>Track your running journey:</Text>
            <View style={styles.featureRow}>
              <Text style={styles.featureItem}>🏃 Log runs</Text>
              <Text style={styles.featureItem}>📊 View stats</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureItem}>🏆 Achievements</Text>
              <Text style={styles.featureItem}>⚖️ Weight tracking</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  emoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.hero,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
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
    marginBottom: spacing.xl,
  },
  toggleText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  toggleLink: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  features: {
    alignItems: 'center',
  },
  featuresTitle: {
    fontSize: typography.sizes.sm,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xs,
  },
  featureItem: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
});

