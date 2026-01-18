const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  // Core Fields
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },

  // Pricing
  basePrice: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unit: {
    type: String,
    enum: ['pcs', 'hrs', 'days', 'kg', 'm', 'm2', 'liters', 'months'],
    default: 'hrs'
  },

  // Tax
  vatCategory: {
    type: String,
    enum: ['1', '2', '3', '4', '5', '6', '7', '8'],
    default: '1' // 24% VAT (standard rate in Greece)
  },

  // Income Classification (for AADE)
  incomeClassification: {
    classificationType: {
      type: String,
      default: 'E3_561_001'
    },
    categoryId: {
      type: String,
      default: 'category1_3'
    }
  },

  // Relationships
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Usage Statistics
  stats: {
    timesUsed: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
serviceSchema.index({ userId: 1, name: 1 });
serviceSchema.index({ userId: 1, isActive: 1 });
serviceSchema.index({ userId: 1, 'stats.timesUsed': -1 });

// Static method to find services by user
serviceSchema.statics.findByUser = function(userId) {
  return this.find({ userId, isActive: true }).sort({ name: 1 });
};

// Static method to search services
serviceSchema.statics.search = function(userId, query) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    userId,
    isActive: true,
    $or: [
      { name: searchRegex },
      { description: searchRegex }
    ]
  }).sort({ 'stats.timesUsed': -1, name: 1 }).limit(10);
};

// Static method to get recent/most-used services
serviceSchema.statics.getRecent = function(userId, limit = 10) {
  return this.find({
    userId,
    isActive: true
  }).sort({ 'stats.timesUsed': -1, 'stats.lastUsed': -1 }).limit(limit);
};

// Instance method to track usage
serviceSchema.methods.trackUsage = async function() {
  this.stats.timesUsed += 1;
  this.stats.lastUsed = new Date();
  await this.save();
};

// Ensure virtual fields are serialized
serviceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Service', serviceSchema);
