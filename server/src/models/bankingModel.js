const mongoose = require('mongoose');

const bankingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  settingsId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Settings',
    index: true
  },

  // Bank Account Information
  accountName: {
    type: String,
    required: true,
    trim: true
  },

  bankName: {
    type: String,
    required: true,
    trim: true
  },

  iban: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        // Greek IBAN: GR + 2 check digits + 23 alphanumeric = 27 total
        return /^GR\d{25}$/.test(v.replace(/\s/g, ''));
      },
      message: 'Invalid Greek IBAN format (must be GR + 25 digits)'
    }
  },

  swift: {
    type: String,
    trim: true,
    uppercase: true
  },

  // Default bank for invoices
  isDefault: {
    type: Boolean,
    default: false
  },

  // Active status
  isActive: {
    type: Boolean,
    default: true
  },

  // Optional notes
  notes: {
    type: String,
    trim: true
  }

}, {
  timestamps: true
});

// Compound index to ensure only one default bank per user
bankingSchema.index({ userId: 1, isDefault: 1 });

// Pre-save middleware to ensure only one default bank per user
bankingSchema.pre('save', async function(next) {
  if (this.isDefault) {
    // Unset any other default banks for this user
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Static method to get default bank for user
bankingSchema.statics.getDefaultBank = async function(userId) {
  return await this.findOne({
    userId,
    isDefault: true,
    isActive: true
  });
};

// Static method to get all active banks for user
bankingSchema.statics.getUserBanks = async function(userId) {
  return await this.find({
    userId,
    isActive: true
  }).sort({ isDefault: -1, createdAt: -1 });
};

// Instance method to set as default
bankingSchema.methods.setAsDefault = async function() {
  this.isDefault = true;
  await this.save();
};

module.exports = mongoose.model('Banking', bankingSchema);
