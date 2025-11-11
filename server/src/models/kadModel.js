const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const kadSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        // Allow various KAD formats: XX.XX, XX.XXX, XX.XX.XX, XX.XX.XXX, XX.XX.XX.XX
        return /^\d{2}\.\d{2,4}$/.test(v) || /^\d{2}\.\d{2}\.\d{2,3}$/.test(v) || /^\d{2}\.\d{2}\.\d{2}\.\d{2}$/.test(v);
      },
      message: 'KAD code must be in valid format (XX.XX, XX.XXX, XX.XX.XX, XX.XX.XXX, or XX.XX.XX.XX)'
    }
  },
  originalCode: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  descriptionEN: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  section: {
    type: String,
    required: true,
    trim: true,
    enum: [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'
    ]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  vatRate: {
    type: Number,
    default: 24, // Standard Greek VAT rate
    min: 0,
    max: 100
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  keywords: [{
    type: String,
    trim: true
  }],
  relatedCodes: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^\d{2}\.\d{2}$/.test(v);
      },
      message: 'Related code must be in format XX.XX'
    }
  }],
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient searching
kadSchema.index({ code: 1 });
kadSchema.index({ originalCode: 1 });
kadSchema.index({ category: 1 });
kadSchema.index({ section: 1 });
kadSchema.index({ isActive: 1 });
kadSchema.index({ isPopular: -1 });
kadSchema.index({ description: 'text', descriptionEN: 'text', keywords: 'text' });

// Add pagination plugin
kadSchema.plugin(mongoosePaginate);

// Static method to get popular KADs
kadSchema.statics.getPopular = function() {
  return this.find({ isActive: true, isPopular: true }).sort({ code: 1 });
};

// Static method to search KADs with enhanced matching and proper prioritization
kadSchema.statics.search = function(query) {
  // Clean query - remove dots, spaces, and normalize
  const cleanQuery = query.replace(/[\s.]/g, '');
  const isCodeSearch = /^[\d.]+$/.test(query);
  
  if (isCodeSearch) {
    // Use aggregation pipeline for proper code search prioritization
    const pipeline = [
      {
        $match: {
          isActive: true,
          $or: [
            // Exact matches
            { code: query },
            { originalCode: query },
            { originalCode: cleanQuery },
            
            // Starts with query (7022 finds 70221000)
            { code: new RegExp(`^${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') },
            { originalCode: new RegExp(`^${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') },
            
            // Contains query
            { code: new RegExp(cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            { originalCode: new RegExp(cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
          ]
        }
      },
      {
        $addFields: {
          priority: {
            $switch: {
              branches: [
                { case: { $eq: ['$code', query] }, then: 1 },
                { case: { $eq: ['$originalCode', query] }, then: 2 },
                { case: { $eq: ['$originalCode', cleanQuery] }, then: 3 },
                { case: { $regexMatch: { input: '$code', regex: `^${cleanQuery}`, options: 'i' } }, then: 4 },
                { case: { $regexMatch: { input: '$originalCode', regex: `^${cleanQuery}`, options: 'i' } }, then: 5 }
              ],
              default: 6
            }
          }
        }
      },
      {
        $sort: {
          priority: 1,
          code: 1
        }
      }
    ];
    
    return this.aggregate(pipeline);
  } else {
    // Text-based search with simple find
    const words = query.split(/\s+/).filter(word => word.length > 2);
    
    return this.find({
      isActive: true,
      $or: [
        // Exact phrase in description
        { description: new RegExp(query, 'i') },
        { descriptionEN: new RegExp(query, 'i') },
        
        // All words must be present
        { $and: words.map(word => ({ description: new RegExp(word, 'i') })) },
        { $and: words.map(word => ({ descriptionEN: new RegExp(word, 'i') })) },
        
        // Keywords
        { keywords: { $in: words.map(word => new RegExp(word, 'i')) } },
        
        // Individual words
        ...words.map(word => ({ description: new RegExp(word, 'i') })),
        ...words.map(word => ({ descriptionEN: new RegExp(word, 'i') }))
      ]
    }).sort({ isPopular: -1, code: 1 });
  }
};

// Static method to get by section
kadSchema.statics.getBySection = function(section) {
  return this.find({ isActive: true, section }).sort({ code: 1 });
};

module.exports = mongoose.model('KAD', kadSchema);