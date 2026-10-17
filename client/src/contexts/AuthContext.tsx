'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authAPI } from '@/utils/api';

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  company?: string;
  isAccountant?: boolean;
  subscription: {
    plan: 'free' | 'basic' | 'premium';
    status: 'active' | 'inactive' | 'canceled' | 'expired';
    endDate?: string;
  };
  preferences: {
    language: 'en' | 'el' | 'de';
    theme: 'light' | 'dark';
    currency: string;
  };
  isEmailVerified: boolean;
  lastLogin?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type HttpError = { message?: string; response?: { status?: number } };
const httpStatus = (error: unknown) => (error as HttpError)?.response?.status;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Refs, not state: the interval callback must see the current values. (With
  // state it captured user === null from the first render, so it stopped
  // itself after 10 minutes and the proactive refresh never ran.)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Initialize auth state - check if user is authenticated
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get current user info using cookies
        const response = await authAPI.me();

        if (response.data.success && response.data.user) {
          userRef.current = response.data.user;
          setUser(response.data.user);
          setToken(response.data.token || 'cookie-auth'); // Set placeholder token

          // Start token refresh if user is actually authenticated
          startTokenRefresh();
        }
      } catch (error) {
        // Only a definite "not logged in" clears the stored session. A server
        // that is still starting or unreachable must not log the user out.
        const status = httpStatus(error);
        if (status === 401 || status === 403) {
          localStorage.removeItem('accounty_token');
          localStorage.removeItem('accounty_user');
        } else {
          console.warn('Could not verify the session:', (error as HttpError)?.message);
        }
        stopTokenRefresh();
      } finally {
        // Always set loading to false, regardless of success or failure
        setIsLoading(false);
      }
    };

    initAuth();
    return () => stopTokenRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proactive token refresh - every 10 minutes
  const startTokenRefresh = () => {
    stopTokenRefresh();

    refreshIntervalRef.current = setInterval(async () => {
      // Only refresh if we still have a user (prevents unnecessary calls)
      if (!userRef.current) {
        stopTokenRefresh();
        return;
      }

      try {
        await authAPI.refresh();
      } catch (error) {
        const status = httpStatus(error);
        // Network blips are retried on the next tick; only a rejected
        // refresh token ends the session.
        if ((status === 401 || status === 403) && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          userRef.current = null;
          setUser(null);
          setToken(null);
          localStorage.removeItem('accounty_token');
          localStorage.removeItem('accounty_user');
          stopTokenRefresh();
          window.location.href = '/login';
        } else {
          console.warn('Proactive token refresh failed:', (error as HttpError)?.message);
        }
      }
    }, 10 * 60 * 1000); // 10 minutes
  };

  const stopTokenRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const response = await authAPI.login({ email, password });
      
      if (response.data.success) {
        const { accessToken, user: newUser } = response.data;
        
        setToken(accessToken || 'cookie-auth');
        userRef.current = newUser;
        setUser(newUser);
        
        // Store token as fallback for API compatibility
        if (accessToken) {
          localStorage.setItem('accounty_token', accessToken);
        }
        
        // Start proactive token refresh after successful login
        startTokenRefresh();
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: any) => {
    try {
      setIsLoading(true);
      const response = await authAPI.register(userData);
      
      if (response.data.success) {
        const { accessToken, user: newUser } = response.data;
        
        setToken(accessToken || 'cookie-auth');
        userRef.current = newUser;
        setUser(newUser);
        
        // Store token as fallback for API compatibility
        if (accessToken) {
          localStorage.setItem('accounty_token', accessToken);
        }
        
        // Start proactive token refresh after successful registration
        startTokenRefresh();
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call server logout to clear cookies
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless of server response
      userRef.current = null;
      setUser(null);
      setToken(null);
      localStorage.removeItem('accounty_token');
      localStorage.removeItem('accounty_user');
      // Stop token refresh
      stopTokenRefresh();
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      const response = await authAPI.updateProfile(userData);
      
      if (response.data.success) {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        localStorage.setItem('accounty_user', JSON.stringify(updatedUser));
      }
    } catch (error: any) {
      console.error('Update user error:', error);
      throw new Error(error.response?.data?.message || 'Update failed');
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.me();
      if (response.data.success) {
        setUser(response.data.user);
        // No longer store in localStorage
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      // If refreshing user fails, user might need to login again
      if (error.response?.status === 401) {
        setUser(null);
        setToken(null);
      }
    }
  };

  const isAuthenticated = !!user && !!token;

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};