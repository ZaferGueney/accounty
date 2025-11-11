const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  // Basic Information
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
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

  // Greek Tax Information (required for business clients)
  taxInfo: {
    afm: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      validate: {
        validator: function(v) {
          return /^\d{9}$/.test(v);
        },
        message: 'AFM must be exactly 9 digits'
      }
    },
    doy: {
      code: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true
      }
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
    businessActivity: [{
      code: {
        type: String,
        validate: {
          validator: function(v) {
            // Allow various KAD formats: XX.XX, XX.XXX, XX.XX.XX, XX.XX.XXX, XX.XX.XX.XX
            return /^\d{2}\.\d{2,4}$/.test(v) || /^\d{2}\.\d{2}\.\d{2,3}$/.test(v) || /^\d{2}\.\d{2}\.\d{2}\.\d{2}$/.test(v);
          },
          message: 'Invalid KAD format'
        }
      },
      name: String
    }]
  },

  // Account Information
  accountant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Client Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Contract and Agreement Details
  contractInfo: {
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    serviceType: {
      type: String,
      enum: ['bookkeeping', 'tax_filing', 'payroll', 'full_service', 'consulting'],
      default: 'bookkeeping'
    },
    monthlyFee: {
      type: Number,
      min: 0
    },
    paymentTerms: {
      type: Number,
      default: 30, // days
      min: 0
    },
    notes: {
      type: String,
      trim: true
    }
  },

  // Banking Information (for client payments)
  bankingInfo: {
    iban: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          // Greek IBAN validation: GR + 2 check digits + 25 digits
          return /^GR\d{27}$/.test(v.replace(/\s/g, ''));
        },
        message: 'Invalid Greek IBAN format'
      }
    },
    bankName: {
      type: String,
      trim: true
    }
  },

  // Statistics (calculated fields)
  stats: {
    totalCustomers: {
      type: Number,
      default: 0
    },
    totalInvoices: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    lastInvoiceDate: {
      type: Date
    },
    lastPaymentDate: {
      type: Date
    }
  },

  // Additional Information
  notes: {
    type: String,
    trim: true
  }

}, {
  timestamps: true
});

// Indexes for efficient querying
clientSchema.index({ accountant: 1, companyName: 1 });
clientSchema.index({ accountant: 1, isActive: 1 });
clientSchema.index({ 'taxInfo.afm': 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ 'contractInfo.serviceType': 1 });

// Virtual for full address
clientSchema.virtual('fullAddress').get(function() {
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

// Virtual for display name
clientSchema.virtual('displayName').get(function() {
  return this.companyName;
});

// Virtual for contract status
clientSchema.virtual('contractStatus').get(function() {
  const now = new Date();
  if (this.contractInfo.endDate && this.contractInfo.endDate < now) {
    return 'expired';
  }
  if (!this.isActive) {
    return 'inactive';
  }
  return 'active';
});

// Pre-save middleware to format AFM and update related fields
clientSchema.pre('save', function(next) {
  // Ensure AFM is clean (remove spaces and special characters)
  if (this.taxInfo.afm) {
    this.taxInfo.afm = this.taxInfo.afm.replace(/\s/g, '');
  }
  
  // Generate VAT number from AFM if not provided
  if (this.taxInfo.afm && !this.taxInfo.vatNumber) {
    this.taxInfo.vatNumber = `EL${this.taxInfo.afm}`;
  }
  
  next();
});

// Static method to find clients by accountant
clientSchema.statics.findByAccountant = function(accountantId) {
  return this.find({ accountant: accountantId, isActive: true })
    .populate('accountant', 'firstName lastName email')
    .sort({ companyName: 1 });
};

// Static method to search clients
clientSchema.statics.search = function(accountantId, query) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    accountant: accountantId,
    isActive: true,
    $or: [
      { companyName: searchRegex },
      { contactPerson: searchRegex },
      { email: searchRegex },
      { 'taxInfo.afm': searchRegex },
      { 'contractInfo.serviceType': searchRegex }
    ]
  }).sort({ companyName: 1 });
};

// Static method to get clients by service type
clientSchema.statics.findByServiceType = function(accountantId, serviceType) {
  return this.find({
    accountant: accountantId,
    'contractInfo.serviceType': serviceType,
    isActive: true
  }).sort({ companyName: 1 });
};

// Static method to get clients with expiring contracts
clientSchema.statics.getExpiringContracts = function(accountantId, daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    accountant: accountantId,
    'contractInfo.endDate': { $lte: futureDate, $gte: new Date() },
    isActive: true
  }).sort({ 'contractInfo.endDate': 1 });
};

// Instance method to update statistics
clientSchema.methods.updateStats = async function() {
  const Customer = mongoose.model('Customer');
  const Invoice = mongoose.model('Invoice');
  
  // Count customers for this client
  const customerCount = await Customer.countDocuments({
    clientId: this._id,
    isActive: true
  });
  
  // Get invoice statistics
  const invoiceStats = await Invoice.aggregate([
    {
      $match: {
        clientId: this._id,
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: '$totals.totalAmount' },
        lastInvoiceDate: { $max: '$issueDate' }
      }
    }
  ]);
  
  // Get last payment date
  const lastPayment = await Invoice.findOne({
    clientId: this._id,
    status: 'paid'
  }).sort({ 'payment.paidDate': -1 }).select('payment.paidDate');
  
  this.stats = {
    totalCustomers: customerCount,
    totalInvoices: invoiceStats.length > 0 ? invoiceStats[0].totalInvoices : 0,
    totalRevenue: invoiceStats.length > 0 ? invoiceStats[0].totalRevenue : 0,
    lastInvoiceDate: invoiceStats.length > 0 ? invoiceStats[0].lastInvoiceDate : null,
    lastPaymentDate: lastPayment ? lastPayment.payment.paidDate : null
  };
  
  await this.save();
};

// Instance method to add customer
clientSchema.methods.addCustomer = async function(customerData) {
  const Customer = mongoose.model('Customer');
  
  const customer = new Customer({
    ...customerData,
    userId: this.accountant,
    clientId: this._id
  });
  
  await customer.save();
  await this.updateStats();
  
  return customer;
};

// Instance method to check contract status
clientSchema.methods.getContractStatus = function() {
  const now = new Date();
  
  if (!this.isActive) {
    return {
      status: 'inactive',
      message: 'Client account is inactive'
    };
  }
  
  if (this.contractInfo.endDate && this.contractInfo.endDate < now) {
    return {
      status: 'expired',
      message: 'Contract has expired',
      expiredDate: this.contractInfo.endDate
    };
  }
  
  if (this.contractInfo.endDate) {
    const daysRemaining = Math.ceil((this.contractInfo.endDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysRemaining <= 30) {
      return {
        status: 'expiring',
        message: `Contract expires in ${daysRemaining} days`,
        daysRemaining,
        expiryDate: this.contractInfo.endDate
      };
    }
  }
  
  return {
    status: 'active',
    message: 'Contract is active'
  };
};

// Ensure virtual fields are serialized
clientSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Client', clientSchema);