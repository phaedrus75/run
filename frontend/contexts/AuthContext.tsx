/**
 * 🔐 AUTH CONTEXT
 * ================
 * 
 * Provides authentication state to the entire app.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
  getStoredUser,
  getToken,
  setStoredUser,
} from '../services/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  completeOnboarding: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app start
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await getToken();
      if (token) {
        const response = await fetch('https://run-production-83ca.up.railway.app/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setStoredUser(userData);
        } else {
          // Token expired or invalid — clear stored auth
          await apiLogout();
          setUser(null);
        }
      }
    } catch (error) {
      // Network error — fall back to stored user so app works offline
      console.log('Auth check network error, using stored user:', error);
      const storedUser = await getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await apiLogin(email, password);
    setUser(response.user);
  }

  async function signup(email: string, password: string, name?: string) {
    const response = await apiSignup(email, password, name);
    setUser(response.user);
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  function completeOnboarding() {
    if (user) {
      const updatedUser = { ...user, onboarding_complete: true };
      setUser(updatedUser);
      setStoredUser(updatedUser);
    }
  }

  async function refreshUser() {
    try {
      const token = await getToken();
      if (token) {
        // Fetch fresh user data from API
        const response = await fetch('https://run-production-83ca.up.railway.app/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setStoredUser(userData);
        }
      }
    } catch (error) {
      console.log('Failed to refresh user:', error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        needsOnboarding: !!user && !user.onboarding_complete,
        login,
        signup,
        logout,
        completeOnboarding,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

