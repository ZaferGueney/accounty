const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  // Invoice Identification
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  series: {
    type: String,
    default: 'A',
    trim: true
  },
  
  // AADE Specific Fields
  aadeInfo: {
    mark: {
      type: String,
      unique: true,
      sparse: true // Allows multiple null values
    },
    uid: {
      type: String,
      unique: true,
      sparse: true
    },
    authenticationCode: {
      type: String,
      sparse: true
    },
    transmissionFailure: {
      type: String,
      enum: ['network', 'validation', 'server_error', 'authentication'],
      default: null
    },
    qrUrl: {
      type: String
    },
    cancelledByMark: {
      type: String,
      default: null
    }
  },

  // Dates
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  dispatchDate: {
    type: Date
  },
  dispatchTime: {
    type: String // Format: "HH:mm:ss"
  },

  // Invoice Type (AADE Classification)
  invoiceType: {
    type: String,
    enum: [
      '1.1', // Τιμολόγιο Πώλησης
      '1.2', // Τιμολόγιο Πώλησης / Ενδοκοινοτικές Παραδόσεις
      '1.3', // Τιμολόγιο Πώλησης / Παραδόσεις Τρίτων Χωρών
      '1.4', // Τιμολόγιο Πώλησης / Πώληση για Λογαριασμό Τρίτων
      '1.5', // Τιμολόγιο Πώλησης / Εκκαθάριση Πωλήσεων Τρίτων - Αμοιβή από Πωλήσεις Τρίτων
      '1.6', // Τιμολόγιο Πώλησης / Συμπληρωματικό Παραστατικό
      '2.1', // Τιμολόγιο Παροχής
      '2.2', // Τιμολόγιο Παροχής / Ενδοκοινοτική Παροχή Υπηρεσιών
      '2.3', // Τιμολόγιο Παροχής / Παροχή Υπηρεσιών σε λήπτη Τρίτης Χώρας
      '2.4', // Τιμολόγιο Παροχής / Συμπληρωματικό Παραστατικό
      '5.1', // Πιστωτικό Τιμολόγιο / Συσχετιζόμενο
      '5.2', // Πιστωτικό Τιμολόγιο / Μη Συσχετιζόμενο
      '11.1', // Απόδειξη Λιανικής Πώλησης (Retail Sales Receipt)
      '11.2'  // Απόδειξη Παροχής Υπηρεσιών (Retail Service Receipt)
    ],
    required: true,
    default: '2.1' // Service invoice (most common for accounting services)
  },

  // Source of the invoice (for tracking external integrations)
  source: {
    type: String,
    enum: ['manual', 'guestcode', 'api'],
    default: 'manual'
  },

  // External reference IDs (for integrations like GuestCode)
  externalId: {
    type: String,  // e.g., Stripe session ID
    sparse: true
  },
  externalOrderId: {
    type: String,  // e.g., GuestCode order _id
    sparse: true
  },

  // Parties
  issuer: {
    vatNumber: {
      type: String,
      required: true
    },
    country: {
      type: String,
      enum: ['GR', 'CY', 'Other'],
      default: 'GR'
    },
    branch: {
      type: Number,
      default: 0
    },
    name: {
      type: String,
      required: true
    },
    legalForm: {
      type: String,
      enum: ['individual', 'oe', 'ee', 'epe', 'ae', 'ike', 'other']
    },
    address: {
      street: String,
      number: String,
      postalCode: String,
      city: String,
      prefecture: String,
      country: {
        type: String,
        default: 'GR'
      }
    },
    taxInfo: {
      afm: {
        type: String,
        required: true
      },
      doy: {
        code: String,
        name: String
      },
      gemi: String
    }
  },

  counterpart: {
    vatNumber: String,
    country: {
      type: String,
      default: 'GR'
    },
    branch: {
      type: Number,
      default: 0
    },
    name: {
      type: String,
      required: false // Allow empty names for drafts
    },
    address: {
      street: String,
      number: String,
      postalCode: String,
      city: String,
      prefecture: String,
      country: {
        type: String,
        default: 'GR'
      }
    },
    taxInfo: {
      afm: String,
      doy: {
        code: String,
        name: String
      }
    }
  },

  // Invoice Lines
  invoiceDetails: [{
    lineNumber: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      required: false, // Allow empty descriptions for drafts
      trim: true
    },
    itemDescription: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1
    },
    unit: {
      type: String,
      enum: ['pcs', 'hrs', 'days', 'kg', 'm', 'm2', 'liters', 'months'],
      default: 'pcs'
    },
    unitPrice: {
      type: Number,
      required: false, // Allow 0 prices for drafts
      min: 0,
      default: 0
    },
    netValue: {
      type: Number,
      required: false, // Allow 0 values for drafts
      min: 0,
      default: 0
    },
    vatCategory: {
      type: String,
      enum: ['1', '2', '3', '4', '5', '6', '7', '8'],
      required: true,
      default: '1' // 24% VAT (standard rate in Greece)
    },
    vatAmount: {
      type: Number,
      required: false, // Allow 0 VAT for drafts
      min: 0,
      default: 0
    },
    withholdingTaxCategory: {
      type: String,
      enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
      default: null
    },
    withheldAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    feesAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    feesPercentCategory: {
      type: String,
      enum: ['1', '2', '3'],
      default: null
    },
    otherTaxesPercentCategory: {
      type: String,
      enum: ['1', '2', '3', '4', '5', '6', '7'],
      default: null
    },
    otherTaxesAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    deductionsAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    lineComments: {
      type: String,
      trim: true
    },
    incomeClassification: [{
      classificationType: {
        type: String,
        enum: [
          'E3_561_001', 'E3_561_002', 'E3_561_003', 'E3_561_004', 'E3_561_005',
          'E3_561_006', 'E3_561_007', 'E3_562_001', 'E3_562_002', 'E3_562_003',
          'E3_563_001', 'E3_563_002', 'E3_564_001', 'E3_564_002', 'E3_565_001',
          'E3_565_002', 'E3_566_001', 'E3_566_002', 'E3_567_001', 'E3_568_001',
          'E3_570_001', 'E3_595_001', 'E3_596_001', 'E3_597_001', 'E3_880_001',
          'E3_880_002', 'E3_880_003', 'E3_880_004', 'E3_881_001', 'E3_881_002',
          'E3_881_003', 'E3_881_004', 'E3_598_001', 'E3_598_002', 'E3_598_003'
        ],
        required: true
      },
      categoryId: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  }],

  // Totals Summary
  totals: {
    totalNetValue: {
      type: Number,
      required: true,
      min: 0
    },
    totalVatAmount: {
      type: Number,
      required: true,
      min: 0
    },
    totalWithheldAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalFeesAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalOtherTaxesAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalDeductionsAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalGrossValue: {
      type: Number,
      required: true,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    }
  },

  // VAT Analysis
  taxesTotals: [{
    taxType: {
      type: String,
      enum: ['1', '2', '3', '4', '5', '6', '7', '8'], // VAT categories
      required: true
    },
    taxCategory: {
      type: String,
      required: true
    },
    underlyingValue: {
      type: Number,
      required: true,
      min: 0
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0
    }
  }],

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
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
    index: true
  },

  // Status and Processing
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  aadeStatus: {
    type: String,
    enum: ['pending', 'transmitted', 'failed', 'cancelled'],
    default: 'pending'
  },
  transmissionDate: {
    type: Date
  },

  // Payment Information
  payment: {
    method: {
      type: String,
      enum: ['1', '2', '3', '4', '5', '6', '7'], // AADE payment method codes
      default: '3' // Bank transfer
    },
    amount: {
      type: Number,
      min: 0
    },
    paidDate: {
      type: Date
    },
    info: {
      type: String,
      trim: true
    }
  },

  // Additional Information
  notes: {
    type: String,
    trim: true
  },
  footerText: {
    type: String,
    trim: true,
    default: 'Vielen Dank für Ihren Auftrag!\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen'
  },
  hideBankDetails: {
    type: Boolean,
    default: false
  },
  currency: {
    type: String,
    enum: ['EUR', 'USD', 'GBP'],
    default: 'EUR'
  },
  exchangeRate: {
    type: Number,
    default: 1,
    min: 0
  },
  vatRegulation: {
    type: String,
    enum: [
      'standard',           // Standard VAT (Umsatzsteuerpflichtige Umsätze)
      'taxFree',           // Tax-free §4 UStG (Steuerfreie Umsätze)
      'reverseChargeDE',   // Reverse Charge §13b UStG
      'reverseChargeEU',   // EU Reverse Charge §18b UStG
      'intraCommunity',    // Intra-Community Deliveries
      'oss',               // One-Stop-Shop
      'export',            // Exports (outside EU)
      'nonTaxableAbroad'   // Non-taxable service abroad
    ],
    default: 'standard'
  },

  // Event Details (for receipts from ticket sales)
  eventDetails: {
    name: { type: String },
    date: { type: Date },
    time: { type: String },
    endTime: { type: String },
    location: { type: String },
    brandLogo: { type: String }
  },

  // Related Documents
  relatedInvoices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  }],

  // Audit Trail
  modifications: [{
    date: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['created', 'modified', 'sent', 'paid', 'cancelled', 'transmitted_aade']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    description: String
  }]

}, {
  timestamps: true
});

// Indexes for efficient querying
invoiceSchema.index({ userId: 1, invoiceNumber: 1 });
invoiceSchema.index({ userId: 1, clientId: 1 });
invoiceSchema.index({ userId: 1, customerId: 1 });
invoiceSchema.index({ userId: 1, status: 1 });
invoiceSchema.index({ userId: 1, aadeStatus: 1 });
invoiceSchema.index({ 'aadeInfo.mark': 1 });
invoiceSchema.index({ 'aadeInfo.uid': 1 });
invoiceSchema.index({ issueDate: 1 });
invoiceSchema.index({ dueDate: 1 });

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'overdue' && this.status !== 'sent') return 0;
  if (this.status === 'paid') return 0;
  
  const now = new Date();
  const diffTime = Math.abs(now - this.dueDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return this.dueDate < now ? diffDays : 0;
});

// Virtual for amount due
invoiceSchema.virtual('amountDue').get(function() {
  if (this.status === 'paid') return 0;
  return this.totals.totalAmount - (this.payment.amount || 0);
});

// Pre-save middleware to calculate totals and validate data
invoiceSchema.pre('save', function(next) {
  // Calculate totals from invoice details
  let totalNetValue = 0;
  let totalVatAmount = 0;
  let totalWithheldAmount = 0;
  let totalFeesAmount = 0;
  let totalOtherTaxesAmount = 0;
  let totalDeductionsAmount = 0;

  this.invoiceDetails.forEach(line => {
    totalNetValue += line.netValue;
    totalVatAmount += line.vatAmount;
    totalWithheldAmount += line.withheldAmount || 0;
    totalFeesAmount += line.feesAmount || 0;
    totalOtherTaxesAmount += line.otherTaxesAmount || 0;
    totalDeductionsAmount += line.deductionsAmount || 0;
  });

  // Update totals
  this.totals.totalNetValue = totalNetValue;
  this.totals.totalVatAmount = totalVatAmount;
  this.totals.totalWithheldAmount = totalWithheldAmount;
  this.totals.totalFeesAmount = totalFeesAmount;
  this.totals.totalOtherTaxesAmount = totalOtherTaxesAmount;
  this.totals.totalDeductionsAmount = totalDeductionsAmount;
  this.totals.totalGrossValue = totalNetValue + totalVatAmount;
  this.totals.totalAmount = this.totals.totalGrossValue - totalWithheldAmount + totalFeesAmount + totalOtherTaxesAmount - totalDeductionsAmount;

  // Update status based on payment and due date
  if (this.payment.amount && this.payment.amount >= this.totals.totalAmount) {
    this.status = 'paid';
  } else if (this.status === 'sent' && this.dueDate < new Date()) {
    this.status = 'overdue';
  }

  next();
});

// Static method to generate next invoice number
invoiceSchema.statics.generateInvoiceNumber = async function(userId, series = 'A') {
  // Find the highest invoice number for this user and series (no year)
  const lastInvoice = await this.findOne({
    userId,
    series,
    invoiceNumber: new RegExp(`^${series}\\d+$`) // Match series + any digits (A0001, A000001, etc.)
  }).sort({ invoiceNumber: -1 });

  let nextNumber = 1;
  if (lastInvoice) {
    // Extract number after series (e.g., "A0001" -> "0001" -> 1)
    const lastNumber = parseInt(lastInvoice.invoiceNumber.replace(series, ''));
    nextNumber = lastNumber + 1;
  }

  // Return format: A000001, A000002, etc. (6 digits for receipts)
  return `${series}${nextNumber.toString().padStart(6, '0')}`;
};

// Static method to find invoices by user
invoiceSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.status) query.status = options.status;
  if (options.clientId) query.clientId = options.clientId;
  if (options.customerId) query.customerId = options.customerId;
  
  return this.find(query)
    .populate('clientId', 'companyName contactPerson')
    .populate('customerId', 'name displayName')
    .sort({ issueDate: -1 });
};

// Static method to get overdue invoices
invoiceSchema.statics.getOverdueInvoices = function(userId) {
  return this.find({
    userId,
    status: { $in: ['sent', 'overdue'] },
    dueDate: { $lt: new Date() }
  }).populate('clientId customerId').sort({ dueDate: 1 });
};

// Static method to get revenue statistics
invoiceSchema.statics.getRevenueStats = async function(userId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $ne: 'cancelled' },
        issueDate: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalRevenue: { $sum: '$totals.totalAmount' },
        paidInvoices: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
        },
        paidRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$totals.totalAmount', 0] }
        },
        overdueInvoices: {
          $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] }
        },
        overdueRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$totals.totalAmount', 0] }
        }
      }
    }
  ];

  const stats = await this.aggregate(pipeline);
  return stats.length > 0 ? stats[0] : {
    totalInvoices: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    paidRevenue: 0,
    overdueInvoices: 0,
    overdueRevenue: 0
  };
};

// Instance method to mark as transmitted to AADE
invoiceSchema.methods.markTransmitted = async function(aadeResponse) {
  this.aadeStatus = 'transmitted';
  this.transmissionDate = new Date();
  
  if (aadeResponse.mark) this.aadeInfo.mark = aadeResponse.mark;
  if (aadeResponse.uid) this.aadeInfo.uid = aadeResponse.uid;
  if (aadeResponse.authenticationCode) this.aadeInfo.authenticationCode = aadeResponse.authenticationCode;
  if (aadeResponse.qrUrl) this.aadeInfo.qrUrl = aadeResponse.qrUrl;

  this.modifications.push({
    action: 'transmitted_aade',
    userId: this.userId,
    description: `Transmitted to AADE with mark: ${aadeResponse.mark}`
  });

  await this.save();
};

// Instance method to mark payment
invoiceSchema.methods.markAsPaid = async function(paymentData, userId) {
  this.status = 'paid';
  this.payment.amount = paymentData.amount || this.totals.totalAmount;
  this.payment.paidDate = paymentData.paidDate || new Date();
  this.payment.method = paymentData.method || this.payment.method;
  if (paymentData.info) this.payment.info = paymentData.info;

  this.modifications.push({
    action: 'paid',
    userId,
    description: `Payment received: €${this.payment.amount}`
  });

  await this.save();
};

// Instance method to cancel invoice
invoiceSchema.methods.cancel = async function(userId, reason) {
  this.status = 'cancelled';
  
  this.modifications.push({
    action: 'cancelled',
    userId,
    description: reason || 'Invoice cancelled'
  });

  await this.save();
};

// Ensure virtual fields are serialized
invoiceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Invoice', invoiceSchema);