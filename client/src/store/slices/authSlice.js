import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authAPI } from '../../utils/api';

// Async thunk for login
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await authAPI.login({ email, password });
      
      if (response.data.success) {
        const { token, user } = response.data;
        
        // Store token in localStorage
        localStorage.setItem('accounty_token', token);
        
        return { token, user };
      } else {
        return rejectWithValue(response.data.message || 'Login failed');
      }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for logout
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { dispatch }) => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    }
    
    // Clear local storage
    localStorage.removeItem('accounty_token');
    
    // Clear settings from Redux store
    dispatch({ type: 'settings/clearSettings' });
    
    return null;
  }
);

// Async thunk for checking auth status
export const checkAuthStatus = createAsyncThunk(
  'auth/checkAuthStatus',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('accounty_token');
      
      if (!token) {
        return rejectWithValue('No token found');
      }
      
      const response = await authAPI.me();
      
      if (response.data.success) {
        return { token, user: response.data.user };
      } else {
        localStorage.removeItem('accounty_token');
        return rejectWithValue('Invalid token');
      }
    } catch (error) {
      localStorage.removeItem('token');
      return rejectWithValue('Authentication check failed');
    }
  }
);

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  initialized: false
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setInitialized: (state) => {
      state.initialized = true;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
        state.initialized = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload;
        state.initialized = true;
      })
      
      // Logout cases
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
        state.isLoading = false;
      })
      
      // Check auth status cases
      .addCase(checkAuthStatus.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
        state.initialized = true;
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
        state.initialized = true;
      });
  }
});

export const { clearError, setInitialized } = authSlice.actions;

// Selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectAuthError = (state) => state.auth.error;
export const selectIsInitialized = (state) => state.auth.initialized;
export const selectIsAccountant = (state) => state.auth.user?.isAccountant || false;

export default authSlice.reducer;