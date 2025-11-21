'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Initialize auth state - check if user is authenticated
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to get current user info using cookies
        const response = await authAPI.me();
        
        if (response.data.success && response.data.user) {
          setUser(response.data.user);
          setToken(response.data.token || 'cookie-auth'); // Set placeholder token
          
          // Start token refresh if user is actually authenticated
          startTokenRefresh();
        }
      } catch (error) {
        // Auth check failed - user not authenticated
        // Clear any remaining localStorage data
        localStorage.removeItem('accounty_token');
        localStorage.removeItem('accounty_user');
        // Make sure no refresh interval is running
        stopTokenRefresh();
      } finally {
        // Always set loading to false, regardless of success or failure
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Proactive token refresh - refresh every 10 minutes (access tokens expire in 15 minutes)
  const startTokenRefresh = () => {
    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    console.log('Starting token refresh interval (will run every 10 minutes)');
    
    const interval = setInterval(async () => {
      // Only refresh if we still have a user (prevents unnecessary calls)
      if (!user) {
        console.log('No user found, stopping token refresh');
        stopTokenRefresh();
        return;
      }
      
      try {
        console.log('Attempting proactive token refresh...');
        await authAPI.refresh();
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Proactive token refresh failed:', error);
        // Only redirect if we're not already on the login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('accounty_token');
          localStorage.removeItem('accounty_user');
          stopTokenRefresh();
          window.location.href = '/login';
        }
      }
    }, 10 * 60 * 1000); // 10 minutes

    setRefreshInterval(interval);
  };

  const stopTokenRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  };

  // Clear interval on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const response = await authAPI.login({ email, password });
      
      if (response.data.success) {
        const { accessToken, user: newUser } = response.data;
        
        setToken(accessToken || 'cookie-auth');
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