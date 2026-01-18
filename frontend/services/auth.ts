/**
 * 🔐 AUTH SERVICE
 * ================
 * 
 * Handles user authentication - signup, login, logout, token storage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// API URL - same as main api.ts
const API_BASE_URL = 'https://run-production-83ca.up.railway.app';

// Storage keys
const TOKEN_KEY = '@runtracker_token';
const USER_KEY = '@runtracker_user';

// Types
export interface User {
  id: number;
  email: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ==========================================
// 🔑 TOKEN MANAGEMENT
// ==========================================

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoredUser(): Promise<User | null> {
  try {
    const userJson = await AsyncStorage.getItem(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
}

export async function setStoredUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function removeStoredUser(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
}

// ==========================================
// 🔐 AUTH API CALLS
// ==========================================

export async function signup(email: string, password: string, name?: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Signup failed');
  }

  const data: AuthResponse = await response.json();
  
  // Store token and user
  await setToken(data.access_token);
  await setStoredUser(data.user);
  
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }

  const data: AuthResponse = await response.json();
  
  // Store token and user
  await setToken(data.access_token);
  await setStoredUser(data.user);
  
  return data;
}

export async function logout(): Promise<void> {
  await removeToken();
  await removeStoredUser();
}

export async function getCurrentUser(): Promise<User | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token invalid, clear it
      await logout();
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

// ==========================================
// 🔧 AUTHENTICATED FETCH
// ==========================================

export async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
}
