import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// Async thunk for fetching settings
export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/settings');
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to fetch settings:', error);
      if (error.response?.status === 404) {
        console.log('ℹ️ No settings found - new user');
        // No settings found - this is normal for new users
        return null;
      }
      const message = error.response?.data?.message || error.message || 'Failed to fetch settings';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for creating settings
export const createSettings = createAsyncThunk(
  'settings/createSettings',
  async (settingsData, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/settings', settingsData);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to create settings';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for updating settings
export const updateSettings = createAsyncThunk(
  'settings/updateSettings',
  async (settingsData, { rejectWithValue }) => {
    try {
      const response = await api.put('/api/settings', settingsData);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update settings';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for updating specific section
export const updateSection = createAsyncThunk(
  'settings/updateSection',
  async ({ section, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/api/settings/section/${section}`, data);
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update section';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for fetching completion status
export const fetchCompletionStatus = createAsyncThunk(
  'settings/fetchCompletionStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/settings/completion');
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to fetch completion status:', error);
      const message = error.response?.data?.message || error.message || 'Failed to fetch completion status';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for validating AFM
export const validateAFM = createAsyncThunk(
  'settings/validateAFM',
  async (afm, { rejectWithValue }) => {
    try {
      const response = await api.get(`/api/settings/validate/afm/${afm}`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'AFM validation failed';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for fetching tax offices
export const fetchTaxOffices = createAsyncThunk(
  'settings/fetchTaxOffices',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/settings/tax-offices');
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch tax offices';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for fetching activity codes
export const fetchActivityCodes = createAsyncThunk(
  'settings/fetchActivityCodes',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/api/settings/activity-codes');
      return response.data.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch activity codes';
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  settings: null,
  completionStatus: {
    isComplete: false,
    canCreateInvoices: false,
    completedSteps: {
      business: false,
      tax: false,
      address: false,
      contact: false,
      banking: false,
      invoicing: false
    },
    nextStep: 'business'
  },
  taxOffices: [],
  activityCodes: [],
  isLoading: false,
  isSaving: false,
  error: null,
  validationErrors: {},
  afmValidation: {
    isValid: null,
    isLoading: false,
    error: null
  }
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearValidationErrors: (state) => {
      state.validationErrors = {};
    },
    clearAFMValidation: (state) => {
      state.afmValidation = {
        isValid: null,
        isLoading: false,
        error: null
      };
    },
    clearSettings: (state) => {
      return initialState;
    },
    setValidationError: (state, action) => {
      const { field, message } = action.payload;
      state.validationErrors[field] = message;
    },
    removeValidationError: (state, action) => {
      const field = action.payload;
      delete state.validationErrors[field];
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch settings cases
      .addCase(fetchSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.settings = action.payload;
        state.error = null;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Create settings cases
      .addCase(createSettings.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(createSettings.fulfilled, (state, action) => {
        state.isSaving = false;
        state.settings = action.payload;
        state.error = null;
      })
      .addCase(createSettings.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })
      
      // Update settings cases
      .addCase(updateSettings.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.isSaving = false;
        state.settings = action.payload;
        state.error = null;
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })
      
      // Update section cases
      .addCase(updateSection.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateSection.fulfilled, (state, action) => {
        state.isSaving = false;
        state.settings = action.payload;
        state.error = null;
      })
      .addCase(updateSection.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })
      
      // Fetch completion status cases
      .addCase(fetchCompletionStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCompletionStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.completionStatus = action.payload;
        state.error = null;
      })
      .addCase(fetchCompletionStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Validate AFM cases
      .addCase(validateAFM.pending, (state) => {
        state.afmValidation.isLoading = true;
        state.afmValidation.error = null;
      })
      .addCase(validateAFM.fulfilled, (state) => {
        state.afmValidation.isLoading = false;
        state.afmValidation.isValid = true;
        state.afmValidation.error = null;
      })
      .addCase(validateAFM.rejected, (state, action) => {
        state.afmValidation.isLoading = false;
        state.afmValidation.isValid = false;
        state.afmValidation.error = action.payload;
      })
      
      // Fetch tax offices cases
      .addCase(fetchTaxOffices.fulfilled, (state, action) => {
        state.taxOffices = action.payload;
      })
      
      // Fetch activity codes cases
      .addCase(fetchActivityCodes.fulfilled, (state, action) => {
        state.activityCodes = action.payload;
      });
  }
});

export const {
  clearError,
  clearValidationErrors,
  clearAFMValidation,
  clearSettings,
  setValidationError,
  removeValidationError
} = settingsSlice.actions;

// Selectors
export const selectSettings = (state) => state.settings.settings;
export const selectCompletionStatus = (state) => state.settings.completionStatus;
export const selectTaxOffices = (state) => state.settings.taxOffices;
export const selectActivityCodes = (state) => state.settings.activityCodes;
export const selectSettingsLoading = (state) => state.settings.isLoading;
export const selectSettingsSaving = (state) => state.settings.isSaving;
export const selectSettingsError = (state) => state.settings.error;
export const selectValidationErrors = (state) => state.settings.validationErrors;
export const selectAFMValidation = (state) => state.settings.afmValidation;

export default settingsSlice.reducer;