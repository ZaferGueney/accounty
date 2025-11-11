import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { customerAPI } from '../../utils/api';

// Async thunk for fetching customers
export const fetchCustomers = createAsyncThunk(
  'customers/fetchCustomers',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await customerAPI.getCustomers(params);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch customers';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for fetching a single customer
export const fetchCustomer = createAsyncThunk(
  'customers/fetchCustomer',
  async (id, { rejectWithValue }) => {
    try {
      const response = await customerAPI.getCustomer(id);
      return response.data.customer;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch customer';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for creating customer
export const createCustomer = createAsyncThunk(
  'customers/createCustomer',
  async (customerData, { rejectWithValue }) => {
    try {
      const response = await customerAPI.createCustomer(customerData);
      return response.data.customer;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to create customer';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for updating customer
export const updateCustomer = createAsyncThunk(
  'customers/updateCustomer',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await customerAPI.updateCustomer(id, data);
      return response.data.customer;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update customer';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for deleting customer
export const deleteCustomer = createAsyncThunk(
  'customers/deleteCustomer',
  async (id, { rejectWithValue }) => {
    try {
      await customerAPI.deleteCustomer(id);
      return id;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to delete customer';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for searching customers
export const searchCustomers = createAsyncThunk(
  'customers/searchCustomers',
  async (params, { rejectWithValue }) => {
    try {
      const response = await customerAPI.searchCustomers(params);
      return response.data.customers;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to search customers';
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  customers: [],
  selectedCustomer: null,
  searchResults: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  },
  filters: {
    search: '',
    type: '',
    clientId: ''
  },
  isLoading: false,
  isSaving: false,
  isSearching: false,
  error: null,
  searchError: null
};

const customerSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.searchError = null;
    },
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.isSearching = false;
      state.searchError = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearSelectedCustomer: (state) => {
      state.selectedCustomer = null;
    },
    resetCustomers: (state) => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch customers cases
      .addCase(fetchCustomers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.customers = action.payload.customers;
        state.pagination = action.payload.pagination;
        state.error = null;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch single customer cases
      .addCase(fetchCustomer.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCustomer.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedCustomer = action.payload;
        state.error = null;
      })
      .addCase(fetchCustomer.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Create customer cases
      .addCase(createCustomer.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(createCustomer.fulfilled, (state, action) => {
        state.isSaving = false;
        state.customers.unshift(action.payload);
        state.error = null;
      })
      .addCase(createCustomer.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })

      // Update customer cases
      .addCase(updateCustomer.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        state.isSaving = false;
        const index = state.customers.findIndex(c => c._id === action.payload._id);
        if (index !== -1) {
          state.customers[index] = action.payload;
        }
        if (state.selectedCustomer?._id === action.payload._id) {
          state.selectedCustomer = action.payload;
        }
        state.error = null;
      })
      .addCase(updateCustomer.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })

      // Delete customer cases
      .addCase(deleteCustomer.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        state.isSaving = false;
        state.customers = state.customers.filter(c => c._id !== action.payload);
        if (state.selectedCustomer?._id === action.payload) {
          state.selectedCustomer = null;
        }
        state.error = null;
      })
      .addCase(deleteCustomer.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })

      // Search customers cases
      .addCase(searchCustomers.pending, (state) => {
        state.isSearching = true;
        state.searchError = null;
      })
      .addCase(searchCustomers.fulfilled, (state, action) => {
        state.isSearching = false;
        state.searchResults = action.payload;
        state.searchError = null;
      })
      .addCase(searchCustomers.rejected, (state, action) => {
        state.isSearching = false;
        state.searchError = action.payload;
      });
  }
});

export const {
  clearError,
  clearSearchResults,
  setFilters,
  setPagination,
  clearSelectedCustomer,
  resetCustomers
} = customerSlice.actions;

// Selectors
export const selectCustomers = (state) => state.customers.customers;
export const selectSelectedCustomer = (state) => state.customers.selectedCustomer;
export const selectSearchResults = (state) => state.customers.searchResults;
export const selectCustomersPagination = (state) => state.customers.pagination;
export const selectCustomersFilters = (state) => state.customers.filters;
export const selectCustomersLoading = (state) => state.customers.isLoading;
export const selectCustomersSaving = (state) => state.customers.isSaving;
export const selectCustomersSearching = (state) => state.customers.isSearching;
export const selectCustomersError = (state) => state.customers.error;
export const selectCustomersSearchError = (state) => state.customers.searchError;

export default customerSlice.reducer;