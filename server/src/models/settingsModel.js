const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Company/Business Information
  business: {
    legalName: {
      type: String,
      required: true,
      trim: true
    },
    tradingName: {
      type: String,
      trim: true
    },
    legalForm: {
      type: String,
      required: true,
      enum: [
        'individual', // Ατομική Επιχείρηση
        'oe', // Ο.Ε. - Ομόρρυθμη Εταιρία (General Partnership)
        'ee', // Ε.Ε. - Ετερόρρυθμη Εταιρία (Limited Partnership)
        'epe', // Ε.Π.Ε. - Εταιρία Περιορισμένης Ευθύνης (Limited Liability Company)
        'ae', // Α.Ε. - Ανώνυμη Εταιρία (Corporation)
        'ike', // Ι.Κ.Ε. - Ιδιωτική Κεφαλαιουχική Εταιρία (Private Company)
        'other'
      ]
    },
    establishmentDate: {
      type: Date
    },
    description: {
      type: String,
      trim: true
    }
  },

  // Greek Tax Information (Required for legal compliance)
  tax: {
    afm: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^\d{9}$/.test(v); // AFM is 9 digits
        },
        message: 'AFM must be exactly 9 digits'
      }
    },
    gemi: {
      type: String,
      required: false, // GEMI might not be required for all business types
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty/null
          return /^\d+$/.test(v); // GEMI is numeric
        },
        message: 'GEMI (Γ.Ε.ΜΗ.) must contain only digits'
      }
    },
    doy: {
      code: {
        type: String,
        required: true,
        trim: true
      },
      name: {
        type: String,
        required: true,
        trim: true
      }
    },
    activityCodes: [{
      _id: String,
      code: {
        type: String,
        required: true,
        trim: true,
        validate: {
          validator: function(v) {
            // Allow various KAD formats: XX.XX, XX.XXX, XX.XX.XX, XX.XX.XXX, XX.XX.XX.XX
            return /^\d{2}\.\d{2,4}$/.test(v) || /^\d{2}\.\d{2}\.\d{2,3}$/.test(v) || /^\d{2}\.\d{2}\.\d{2}\.\d{2}$/.test(v);
          },
          message: 'KAD code must be in valid format (XX.XX, XX.XXX, XX.XX.XX, XX.XX.XXX, or XX.XX.XX.XX)'
        }
      },
      originalCode: String,
      description: {
        type: String,
        required: true,
        trim: true
      },
      descriptionEN: String,
      category: String,
      section: String,
      isPopular: Boolean,
      vatRate: Number
    }],
    vatRegistered: {
      type: Boolean,
      required: true,
      default: false
    },
    vatNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          // Skip validation if empty or if not VAT registered
          if (!v || !this.vatRegistered) return true;
          // Don't validate placeholder values
          if (v === 'ELXXXXXX' || v === 'ELXXXXXXXXX') return false;
          return /^EL\d{9}$/.test(v); // Greek VAT format: EL + 9 digits
        },
        message: 'VAT number must be in format EL + 9 digits'
      }
    },
    vatExemptionReason: {
      type: String,
      trim: true
    }
  },

  // Business Address (Required)
  address: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    number: {
      type: String,
      required: true,
      trim: true
    },
    area: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^\d{5}$/.test(v); // Greek postal codes are 5 digits
        },
        message: 'Postal code must be exactly 5 digits'
      }
    },
    prefecture: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      default: 'Greece'
    }
  },

  // Contact Information
  contact: {
    phone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^(\+30|0030|30)?\s?2\d{9}$|^(\+30|0030|30)?\s?69\d{8}$/.test(v.replace(/\s/g, ''));
        },
        message: 'Invalid Greek phone number'
      }
    },
    mobile: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^(\+30|0030|30)?\s?69\d{8}$/.test(v.replace(/\s/g, ''));
        },
        message: 'Invalid Greek mobile number'
      }
    },
    fax: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format'
      }
    },
    website: {
      type: String,
      trim: true
    }
  },

  // Banking Information - Removed (now in Banking model)
  // Use Banking.getDefaultBank(userId) to retrieve banking info

  // Invoice Settings
  invoicing: {
    series: {
      type: String,
      default: 'INV',
      trim: true
    },
    nextNumber: {
      type: Number,
      default: 1,
      min: 1
    },
    prefix: {
      type: String,
      trim: true
    },
    suffix: {
      type: String,
      trim: true
    },
    paymentTerms: {
      type: Number,
      default: 30,
      min: 0
    },
    defaultCurrency: {
      type: String,
      default: 'EUR',
      enum: ['EUR', 'USD', 'GBP']
    },
    language: {
      type: String,
      default: 'el',
      enum: ['el', 'en']
    }
  },

  // Logo and Branding
  branding: {
    logo: {
      type: String // URL or base64
    },
    primaryColor: {
      type: String,
      default: '#3B82F6'
    },
    secondaryColor: {
      type: String,
      default: '#64748B'
    }
  },

  // AADE myDATA Credentials
  aadeCredentials: {
    username: {
      type: String,
      trim: true
    },
    subscriptionKey: {
      type: String // Encrypted before saving
    },
    environment: {
      type: String,
      enum: ['development', 'production'],
      default: 'development'
    },
    isConfigured: {
      type: Boolean,
      default: false
    },
    lastTested: {
      type: Date
    }
  },

  // Completion Status
  isComplete: {
    type: Boolean,
    default: false
  },
  completedSteps: {
    business: { type: Boolean, default: false },
    tax: { type: Boolean, default: false },
    address: { type: Boolean, default: false },
    contact: { type: Boolean, default: false },
    invoicing: { type: Boolean, default: false }
  },
  
  // Verification Status
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationNotes: {
    type: String
  }

}, {
  timestamps: true
});

// Indexes are already created via unique: true constraints above

// Check if settings are complete for invoice creation
// Note: Banking is now checked separately via Banking model
settingsSchema.methods.canCreateInvoices = function() {
  return this.isComplete &&
         this.completedSteps.business &&
         this.completedSteps.tax &&
         this.completedSteps.address &&
         this.completedSteps.contact;
};

// Update completion status
settingsSchema.methods.updateCompletionStatus = function() {
  const steps = this.completedSteps;
  
  // Check business completion
  steps.business = !!(this.business.legalName && this.business.legalForm);
  
  // Check tax completion
  steps.tax = !!(this.tax.afm && this.tax.doy.code && this.tax.doy.name && 
                this.tax.activityCodes && this.tax.activityCodes.length > 0);
  
  // Check address completion
  steps.address = !!(this.address.street && this.address.number && 
                    this.address.city && this.address.postalCode && this.address.prefecture);
  
  // Check contact completion
  steps.contact = !!(this.contact.phone && this.contact.email);

  // Check invoicing completion (optional but included)
  steps.invoicing = true; // Default values are sufficient
  
  // Update overall completion
  this.isComplete = Object.values(steps).every(step => step === true);
  
  return this.isComplete;
};

// Pre-save middleware to update completion status
settingsSchema.pre('save', function(next) {
  this.updateCompletionStatus();
  next();
});

module.exports = mongoose.model('Settings', settingsSchema);