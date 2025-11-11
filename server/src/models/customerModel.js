const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Email is optional
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Phone is optional
        return /^(\+30|0030|30)?\s?[2-9]\d{8,9}$/.test(v.replace(/\s/g, ''));
      },
      message: 'Invalid Greek phone number'
    }
  },

  // Address Information
  address: {
    street: {
      type: String,
      trim: true
    },
    number: {
      type: String,
      trim: true
    },
    area: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    postalCode: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^\d{5}$/.test(v); // Greek postal codes are 5 digits
        },
        message: 'Invalid Greek postal code (must be 5 digits)'
      }
    },
    prefecture: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true,
      default: 'Greece'
    }
  },

  // Greek Tax Information (for business customers)
  taxInfo: {
    afm: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // AFM is optional for individuals
          return /^\d{9}$/.test(v);
        },
        message: 'AFM must be exactly 9 digits'
      }
    },
    doy: {
      code: String,
      name: String
    },
    vatNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^EL\d{9}$/.test(v);
        },
        message: 'VAT number must be in format EL + 9 digits'
      }
    },
    businessName: {
      type: String,
      trim: true
    }
  },

  // Customer Type
  customerType: {
    type: String,
    enum: ['individual', 'business'],
    default: 'individual'
  },

  // Relationships
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    default: null,
    index: true
  },

  // Status and Settings
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Additional Information
  notes: {
    type: String,
    trim: true
  },
  
  // Payment Terms (default for invoices)
  defaultPaymentTerms: {
    type: Number,
    default: 30, // days
    min: 0
  },
  
  // Statistics (calculated fields)
  stats: {
    totalInvoices: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    lastInvoiceDate: {
      type: Date
    }
  }

}, {
  timestamps: true
});

// Indexes for efficient querying
customerSchema.index({ userId: 1, name: 1 });
customerSchema.index({ userId: 1, clientId: 1 });
customerSchema.index({ userId: 1, isActive: 1 });
customerSchema.index({ 'taxInfo.afm': 1 });
customerSchema.index({ email: 1 });

// Virtual for full address
customerSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  if (!addr.street && !addr.city) return '';
  
  const parts = [];
  if (addr.street) parts.push(addr.street);
  if (addr.number) parts.push(addr.number);
  if (addr.area) parts.push(addr.area);
  if (addr.city) parts.push(addr.city);
  if (addr.postalCode) parts.push(addr.postalCode);
  if (addr.prefecture && addr.prefecture !== addr.city) parts.push(addr.prefecture);
  
  return parts.join(', ');
});

// Virtual for display name (business name or personal name)
customerSchema.virtual('displayName').get(function() {
  if (this.customerType === 'business' && this.taxInfo.businessName) {
    return this.taxInfo.businessName;
  }
  return this.name;
});

// Pre-save middleware to update customer type based on tax info
customerSchema.pre('save', function(next) {
  if (this.taxInfo.afm || this.taxInfo.vatNumber || this.taxInfo.businessName) {
    this.customerType = 'business';
  } else {
    this.customerType = 'individual';
  }
  next();
});

// Static method to find customers by user
customerSchema.statics.findByUser = function(userId) {
  return this.find({ userId, isActive: true }).sort({ name: 1 });
};

// Static method to find customers by client
customerSchema.statics.findByClient = function(clientId) {
  return this.find({ clientId, isActive: true }).sort({ name: 1 });
};

// Static method to search customers
customerSchema.statics.search = function(userId, query, clientId = null) {
  const searchRegex = new RegExp(query, 'i');
  const filter = {
    userId,
    isActive: true,
    $or: [
      { name: searchRegex },
      { email: searchRegex },
      { 'taxInfo.businessName': searchRegex },
      { 'taxInfo.afm': searchRegex }
    ]
  };
  
  if (clientId) {
    filter.clientId = clientId;
  }
  
  return this.find(filter).sort({ name: 1 });
};

// Instance method to update statistics
customerSchema.methods.updateStats = async function() {
  const Invoice = mongoose.model('Invoice');
  
  const stats = await Invoice.aggregate([
    {
      $match: {
        customerId: this._id,
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalAmount: { $sum: '$totals.totalAmount' },
        lastInvoiceDate: { $max: '$issueDate' }
      }
    }
  ]);
  
  if (stats.length > 0) {
    this.stats = stats[0];
  } else {
    this.stats = {
      totalInvoices: 0,
      totalAmount: 0,
      lastInvoiceDate: null
    };
  }
  
  await this.save();
};

// Ensure virtual fields are serialized
customerSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Customer', customerSchema);