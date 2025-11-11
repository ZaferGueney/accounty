import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { invoiceAPI } from '../../utils/api';

// Async thunk for fetching invoices
export const fetchInvoices = createAsyncThunk(
  'invoices/fetchInvoices',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await invoiceAPI.getInvoices(params);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch invoices';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for fetching a single invoice
export const fetchInvoice = createAsyncThunk(
  'invoices/fetchInvoice',
  async (id, { rejectWithValue }) => {
    try {
      const response = await invoiceAPI.getInvoice(id);
      return response.data.invoice;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch invoice';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for creating invoice
export const createInvoice = createAsyncThunk(
  'invoices/createInvoice',
  async (invoiceData, { rejectWithValue }) => {
    try {
      const response = await invoiceAPI.createInvoice(invoiceData);
      return response.data.invoice;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to create invoice';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for updating invoice
export const updateInvoice = createAsyncThunk(
  'invoices/updateInvoice',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await invoiceAPI.updateInvoice(id, data);
      return response.data.invoice;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to update invoice';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for deleting invoice
export const deleteInvoice = createAsyncThunk(
  'invoices/deleteInvoice',
  async (id, { rejectWithValue }) => {
    try {
      await invoiceAPI.deleteInvoice(id);
      return id;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to delete invoice';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for marking invoice as paid
export const markInvoicePaid = createAsyncThunk(
  'invoices/markInvoicePaid',
  async ({ id, paymentData }, { rejectWithValue }) => {
    try {
      const response = await invoiceAPI.markInvoicePaid(id, paymentData);
      return response.data.invoice;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to mark invoice as paid';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for fetching invoice stats
export const fetchInvoiceStats = createAsyncThunk(
  'invoices/fetchInvoiceStats',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await invoiceAPI.getInvoiceStats(params);
      return response.data.stats;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to fetch invoice stats';
      return rejectWithValue(message);
    }
  }
);

// Async thunk for getting next invoice number
export const getNextInvoiceNumber = createAsyncThunk(
  'invoices/getNextInvoiceNumber',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await invoiceAPI.getNextInvoiceNumber(params);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to get next invoice number';
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  invoices: [],
  selectedInvoice: null,
  stats: null,
  nextInvoiceNumber: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  },
  filters: {
    status: '',
    aadeStatus: '',
    customerId: '',
    clientId: '',
    startDate: '',
    endDate: ''
  },
  isLoading: false,
  isSaving: false,
  isLoadingStats: false,
  error: null,
  statsError: null
};

const invoiceSlice = createSlice({
  name: 'invoices',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.statsError = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearSelectedInvoice: (state) => {
      state.selectedInvoice = null;
    },
    resetInvoices: (state) => {
      return initialState;
    },
    clearStats: (state) => {
      state.stats = null;
      state.statsError = null;
    },
    updateInvoiceStatus: (state, action) => {
      const { id, status } = action.payload;
      const invoice = state.invoices.find(inv => inv._id === id);
      if (invoice) {
        invoice.status = status;
      }
      if (state.selectedInvoice?._id === id) {
        state.selectedInvoice.status = status;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch invoices cases
      .addCase(fetchInvoices.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.isLoading = false;
        state.invoices = action.payload.invoices;
        state.pagination = action.payload.pagination;
        state.error = null;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Fetch single invoice cases
      .addCase(fetchInvoice.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInvoice.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedInvoice = action.payload;
        state.error = null;
      })
      .addCase(fetchInvoice.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // Create invoice cases
      .addCase(createInvoice.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(createInvoice.fulfilled, (state, action) => {
        state.isSaving = false;
        state.invoices.unshift(action.payload);
        state.error = null;
      })
      .addCase(createInvoice.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })

      // Update invoice cases
      .addCase(updateInvoice.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateInvoice.fulfilled, (state, action) => {
        state.isSaving = false;
        const index = state.invoices.findIndex(inv => inv._id === action.payload._id);
        if (index !== -1) {
          state.invoices[index] = action.payload;
        }
        if (state.selectedInvoice?._id === action.payload._id) {
          state.selectedInvoice = action.payload;
        }
        state.error = null;
      })
      .addCase(updateInvoice.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })

      // Delete invoice cases
      .addCase(deleteInvoice.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(deleteInvoice.fulfilled, (state, action) => {
        state.isSaving = false;
        state.invoices = state.invoices.filter(inv => inv._id !== action.payload);
        if (state.selectedInvoice?._id === action.payload) {
          state.selectedInvoice = null;
        }
        state.error = null;
      })
      .addCase(deleteInvoice.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })

      // Mark invoice paid cases
      .addCase(markInvoicePaid.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(markInvoicePaid.fulfilled, (state, action) => {
        state.isSaving = false;
        const index = state.invoices.findIndex(inv => inv._id === action.payload._id);
        if (index !== -1) {
          state.invoices[index] = action.payload;
        }
        if (state.selectedInvoice?._id === action.payload._id) {
          state.selectedInvoice = action.payload;
        }
        state.error = null;
      })
      .addCase(markInvoicePaid.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })

      // Fetch invoice stats cases
      .addCase(fetchInvoiceStats.pending, (state) => {
        state.isLoadingStats = true;
        state.statsError = null;
      })
      .addCase(fetchInvoiceStats.fulfilled, (state, action) => {
        state.isLoadingStats = false;
        state.stats = action.payload;
        state.statsError = null;
      })
      .addCase(fetchInvoiceStats.rejected, (state, action) => {
        state.isLoadingStats = false;
        state.statsError = action.payload;
      })

      // Get next invoice number cases
      .addCase(getNextInvoiceNumber.fulfilled, (state, action) => {
        state.nextInvoiceNumber = action.payload;
      });
  }
});

export const {
  clearError,
  setFilters,
  setPagination,
  clearSelectedInvoice,
  resetInvoices,
  clearStats,
  updateInvoiceStatus
} = invoiceSlice.actions;

// Selectors
export const selectInvoices = (state) => state.invoices.invoices;
export const selectSelectedInvoice = (state) => state.invoices.selectedInvoice;
export const selectInvoiceStats = (state) => state.invoices.stats;
export const selectNextInvoiceNumber = (state) => state.invoices.nextInvoiceNumber;
export const selectInvoicesPagination = (state) => state.invoices.pagination;
export const selectInvoicesFilters = (state) => state.invoices.filters;
export const selectInvoicesLoading = (state) => state.invoices.isLoading;
export const selectInvoicesSaving = (state) => state.invoices.isSaving;
export const selectInvoicesStatsLoading = (state) => state.invoices.isLoadingStats;
export const selectInvoicesError = (state) => state.invoices.error;
export const selectInvoicesStatsError = (state) => state.invoices.statsError;

export default invoiceSlice.reducer;