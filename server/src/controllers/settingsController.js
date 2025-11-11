const Settings = require('../models/settingsModel');
const User = require('../models/userModel');
const { redisUtils } = require('../config/redis');

// Helper function to check if a step is complete
const checkStepCompletion = (step, data) => {
  switch (step) {
    case 'business':
      return !!(data.legalName && data.legalForm);
    case 'tax':
      return !!(data.afm && data.doy?.code && data.doy?.name && 
                data.activityCodes && data.activityCodes.length > 0);
    case 'address':
      return !!(data.street && data.number && 
                data.city && data.postalCode && data.prefecture);
    case 'contact':
      return !!(data.phone && data.email);
    case 'banking':
      return !!(data.accountName && data.bankName && data.iban);
    case 'invoicing':
      return true; // Has defaults
    default:
      return false;
  }
};

// Get user settings
const getSettings = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    
    // Try to get settings from Redis cache first
    let settings = await redisUtils.getSettingsCache(userId);
    
    if (!settings) {
      // If not in cache, get from database
      settings = await Settings.findOne({ userId });
      
      if (!settings) {
        return res.status(404).json({
          success: false,
          message: 'Settings not found'
        });
      }
      
      // Cache the settings
      await redisUtils.setSettingsCache(userId, settings, 1800); // Cache for 30 minutes
    }

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving settings'
    });
  }
};

// Create initial settings
const createSettings = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    
    const existingSettings = await Settings.findOne({ userId });
    
    if (existingSettings) {
      return res.status(400).json({
        success: false,
        message: 'Settings already exist for this user'
      });
    }

    const settings = new Settings({
      userId,
      ...req.body
    });

    await settings.save();
    
    // Cache the new settings
    await redisUtils.setSettingsCache(userId, settings, 1800); // Cache for 30 minutes

    res.status(201).json({
      success: true,
      message: 'Settings created successfully',
      data: settings
    });
  } catch (error) {
    console.error('Create settings error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'AFM already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating settings'
    });
  }
};

// Update settings (full update)
const updateSettings = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    
    const settings = await Settings.findOne({ userId });
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    // Update all provided fields
    Object.assign(settings, req.body);
    await settings.save();
    
    // Update cache
    await redisUtils.setSettingsCache(userId, settings, 1800); // Cache for 30 minutes

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'AFM already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating settings'
    });
  }
};

// Update specific section (partial update)
const updateSection = async (req, res) => {
  try {
    const { section } = req.params;
    const userId = req.user.userId || req.user._id;
    const allowedSections = ['business', 'tax', 'address', 'contact', 'banking', 'invoicing', 'branding'];
    
    if (!allowedSections.includes(section)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section'
      });
    }

    let settings = await Settings.findOne({ userId });
    
    if (!settings) {
      // Use direct MongoDB insertion to bypass validation for partial data
      const newSettingsData = {
        userId,
        [section]: req.body,
        // Add some default values
        isComplete: false,
        completedSteps: {
          business: false,
          tax: false,
          address: false,
          contact: false,
          banking: false,
          invoicing: false
        },
        invoicing: {
          series: 'INV',
          nextNumber: 1,
          paymentTerms: 30,
          defaultCurrency: 'EUR',
          language: 'el'
        },
        branding: {
          primaryColor: '#3B82F6',
          secondaryColor: '#64748B'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert directly into MongoDB to bypass Mongoose validation
      const result = await Settings.collection.insertOne(newSettingsData);
      settings = await Settings.findById(result.insertedId);
    } else {
      // Update specific section
      settings[section] = { ...settings[section], ...req.body };
      
      // Manually update completion status since we're bypassing the pre-save hook
      const isStepComplete = checkStepCompletion(section, settings[section]);
      settings.completedSteps[section] = isStepComplete;
      
      // Check overall completion
      settings.isComplete = Object.values(settings.completedSteps).every(step => step === true);
      
      // Update in database
      await Settings.updateOne(
        { userId }, 
        { 
          $set: { 
            [section]: settings[section],
            [`completedSteps.${section}`]: isStepComplete,
            isComplete: settings.isComplete,
            updatedAt: new Date()
          } 
        }
      );
      
      // Refresh from database to ensure consistency
      settings = await Settings.findOne({ userId });
    }
    
    // Update cache
    await redisUtils.setSettingsCache(userId, settings, 1800); // Cache for 30 minutes

    res.status(200).json({
      success: true,
      message: `${section} section updated successfully`,
      data: settings
    });
  } catch (error) {
    console.error('Update section error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating section'
    });
  }
};

// Check settings completion status
const getCompletionStatus = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    
    // Try to get settings from cache first
    let settings = await redisUtils.getSettingsCache(userId);
    
    if (!settings) {
      settings = await Settings.findOne({ userId });
      if (settings) {
        await redisUtils.setSettingsCache(userId, settings, 1800); // Cache for 30 minutes
      }
    }
    
    if (!settings) {
      return res.status(200).json({
        success: true,
        data: {
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
        }
      });
    }

    // Determine next incomplete step
    const steps = settings.completedSteps;
    const stepOrder = ['business', 'tax', 'address', 'contact', 'banking', 'invoicing'];
    const nextStep = stepOrder.find(step => !steps[step]) || null;

    res.status(200).json({
      success: true,
      data: {
        isComplete: settings.isComplete,
        canCreateInvoices: settings.isComplete && 
                         settings.completedSteps.business && 
                         settings.completedSteps.tax && 
                         settings.completedSteps.address && 
                         settings.completedSteps.contact && 
                         settings.completedSteps.banking,
        completedSteps: settings.completedSteps,
        nextStep
      }
    });
  } catch (error) {
    console.error('Get completion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking completion status'
    });
  }
};

// Validate AFM (Greek Tax Number)
const validateAFM = async (req, res) => {
  try {
    const { afm } = req.params;
    
    if (!/^\d{9}$/.test(afm)) {
      return res.status(400).json({
        success: false,
        message: 'AFM must be exactly 9 digits'
      });
    }

    // Check if AFM already exists for another user
    const existingSettings = await Settings.findOne({ 
      'tax.afm': afm,
      userId: { $ne: req.user._id }
    });

    if (existingSettings) {
      return res.status(400).json({
        success: false,
        message: 'AFM already registered'
      });
    }

    // Basic AFM validation algorithm (Greek tax number validation)
    const afmArray = afm.split('').map(Number);
    let sum = 0;
    
    for (let i = 0; i < 8; i++) {
      sum += afmArray[i] * Math.pow(2, 8 - i);
    }
    
    const remainder = sum % 11;
    const checkDigit = remainder >= 10 ? 0 : remainder;
    
    if (checkDigit !== afmArray[8]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid AFM'
      });
    }

    res.status(200).json({
      success: true,
      message: 'AFM is valid and available'
    });
  } catch (error) {
    console.error('Validate AFM error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating AFM'
    });
  }
};

// Get Greek tax offices (DOY) list
const getTaxOffices = async (req, res) => {
  try {
    // This would typically come from a database or external API
    // For now, providing common Greek tax offices
    const taxOffices = [
      // Athens Tax Offices
      { code: 'A001', name: 'Α\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'Β001', name: 'Β\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'Γ001', name: 'Γ\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'Δ001', name: 'Δ\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'Ε001', name: 'Ε\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'ΣΤ001', name: 'ΣΤ\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'Ζ001', name: 'Ζ\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'Η001', name: 'Η\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'Θ001', name: 'Θ\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'ΚΕΦ001', name: 'ΚΕΦΟΔΕ ΑΤΤΙΚΗΣ', city: 'Athens' },
      { code: 'ΚΕΦ002', name: 'ΚΕΦΟΔΕ Α\' ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'ΚΑΔ001', name: 'ΚΑΔ ΑΘΗΝΩΝ', city: 'Athens' },
      { code: 'ΦΑΕ001', name: 'ΦΑΕ ΑΘΗΝΩΝ', city: 'Athens' },
      
      // Thessaloniki
      { code: 'ΘΕΣ001', name: 'ΘΕΣΣΑΛΟΝΙΚΗΣ', city: 'Thessaloniki' },
      { code: 'ΘΕΣ002', name: 'Β\' ΘΕΣΣΑΛΟΝΙΚΗΣ', city: 'Thessaloniki' },
      { code: 'ΘΕΣ003', name: 'Γ\' ΘΕΣΣΑΛΟΝΙΚΗΣ', city: 'Thessaloniki' },
      { code: 'ΘΕΣ004', name: 'Δ\' ΘΕΣΣΑΛΟΝΙΚΗΣ', city: 'Thessaloniki' },
      { code: 'ΚΕΦΘ001', name: 'ΚΕΦΟΔΕ ΘΕΣΣΑΛΟΝΙΚΗΣ', city: 'Thessaloniki' },
      
      // Piraeus
      { code: 'Π001', name: 'ΠΕΙΡΑΙΑ', city: 'Piraeus' },
      { code: 'Π002', name: 'Β\' ΠΕΙΡΑΙΑ', city: 'Piraeus' },
      { code: 'Π003', name: 'Γ\' ΠΕΙΡΑΙΑ', city: 'Piraeus' },
      
      // Major Cities
      { code: 'ΠΑ001', name: 'ΠΑΤΡΩΝ', city: 'Patras' },
      { code: 'ΛΑ001', name: 'ΛΑΡΙΣΑΣ', city: 'Larissa' },
      { code: 'ΗΡ001', name: 'ΗΡΑΚΛΕΙΟΥ', city: 'Heraklion' },
      { code: 'ΙΩ001', name: 'ΙΩΑΝΝΙΝΩΝ', city: 'Ioannina' },
      { code: 'ΒΟ001', name: 'ΒΟΛΟΥ', city: 'Volos' },
      { code: 'ΧΑ001', name: 'ΧΑΝΙΩΝ', city: 'Chania' },
      { code: 'ΚΑΒ001', name: 'ΚΑΒΑΛΑΣ', city: 'Kavala' },
      { code: 'ΣΕ001', name: 'ΣΕΡΡΩΝ', city: 'Serres' },
      { code: 'ΤΡ001', name: 'ΤΡΙΚΑΛΩΝ', city: 'Trikala' },
      { code: 'ΚΟ001', name: 'ΚΟΖΑΝΗΣ', city: 'Kozani' },
      { code: 'ΧΑΛ001', name: 'ΧΑΛΚΙΔΑΣ', city: 'Chalkida' },
      { code: 'ΑΓ001', name: 'ΑΓΡΙΝΙΟΥ', city: 'Agrinio' },
      
      // Islands
      { code: 'ΡΟ001', name: 'ΡΟΔΟΥ', city: 'Rhodes' },
      { code: 'ΚΩ001', name: 'ΚΩ', city: 'Kos' },
      { code: 'ΜΥ001', name: 'ΜΥΤΙΛΗΝΗΣ', city: 'Mytilene' },
      { code: 'ΣΥ001', name: 'ΣΥΡΟΥ', city: 'Syros' },
      { code: 'ΚΕΡ001', name: 'ΚΕΡΚΥΡΑΣ', city: 'Corfu' },
      { code: 'ΖΑ001', name: 'ΖΑΚΥΝΘΟΥ', city: 'Zakynthos' }
    ];

    res.status(200).json({
      success: true,
      data: taxOffices
    });
  } catch (error) {
    console.error('Get tax offices error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving tax offices'
    });
  }
};

// Get activity codes (KAD)
const getActivityCodes = async (req, res) => {
  try {
    // Common Greek business activity codes
    const activityCodes = [
      // Technology & Software
      { code: '62.01', description: 'Δραστηριότητες προγραμματισμού ηλεκτρονικών υπολογιστών' },
      { code: '62.02', description: 'Δραστηριότητες παροχής συμβουλών σχετικά με τους ηλεκτρονικούς υπολογιστές' },
      { code: '58.29', description: 'Έκδοση λοιπού λογισμικού' },
      { code: '63.11', description: 'Δραστηριότητες επεξεργασίας δεδομένων, φιλοξενίας και συναφείς δραστηριότητες' },
      { code: '95.11', description: 'Επισκευή ηλεκτρονικών υπολογιστών και περιφερειακού εξοπλισμού' },
      
      // Business Services
      { code: '70.22', description: 'Δραστηριότητες παροχής συμβουλών σχετικά με την επιχειρηματική και άλλη διαχείριση' },
      { code: '82.99', description: 'Λοιπές δραστηριότητες επιχειρηματικής υποστήριξης' },
      { code: '69.20', description: 'Λογιστικές και ελεγκτικές δραστηριότητες· φορολογικές συμβουλές' },
      { code: '73.11', description: 'Υπηρεσίες διαφημιστικών πρακτορείων' },
      { code: '74.10', description: 'Δραστηριότητες εξειδικευμένου σχεδιασμού' },
      { code: '74.20', description: 'Δραστηριότητες φωτογραφίας' },
      
      // Retail & E-commerce
      { code: '47.91', description: 'Λιανικό εμπόριο μέσω παραγγελιών ταχυδρομικώς ή μέσω διαδικτύου' },
      { code: '47.11', description: 'Λιανικό εμπόριο σε μη εξειδικευμένα καταστήματα' },
      { code: '47.19', description: 'Λοιπό λιανικό εμπόριο σε μη εξειδικευμένα καταστήματα' },
      { code: '46.90', description: 'Μη εξειδικευμένο χονδρικό εμπόριο' },
      
      // Food & Hospitality
      { code: '56.10', description: 'Δραστηριότητες εστιατορίων και κινητών μονάδων εστίασης' },
      { code: '56.30', description: 'Δραστηριότητες παροχής ποτών' },
      { code: '55.10', description: 'Ξενοδοχεία και παρόμοια καταλύματα' },
      { code: '56.21', description: 'Υπηρεσίες παροχής τροφίμων για εκδηλώσεις' },
      
      // Personal Services
      { code: '96.02', description: 'Κομμωτήρια και άλλες δραστηριότητες περιποίησης' },
      { code: '96.04', description: 'Δραστηριότητες φυσικής ευεξίας' },
      { code: '95.23', description: 'Επισκευή υποδημάτων και δερμάτινων ειδών' },
      
      // Construction & Real Estate
      { code: '41.20', description: 'Κατασκευή κτηρίων' },
      { code: '68.10', description: 'Αγορά και πώληση ιδίων ακινήτων' },
      { code: '68.20', description: 'Ενοικίαση και εκμίσθωση ιδίων ή μισθωμένων ακινήτων' },
      
      // Transportation
      { code: '49.32', description: 'Λειτουργία ταξί' },
      { code: '53.20', description: 'Λοιπές δραστηριότητες ταχυδρομείου και courier' },
      
      // Education & Training
      { code: '85.59', description: 'Λοιπή εκπαίδευση' },
      { code: '85.52', description: 'Πολιτιστική εκπαίδευση' },
      
      // Healthcare
      { code: '86.23', description: 'Οδοντιατρική' },
      { code: '86.90', description: 'Λοιπές δραστηριότητες ανθρώπινης υγείας' },
      
      // Manufacturing
      { code: '10.85', description: 'Παραγωγή έτοιμων γευμάτων και πιάτων' },
      { code: '32.99', description: 'Λοιπές μεταποιητικές δραστηριότητες' },
      
      // Professional Services
      { code: '71.11', description: 'Δραστηριότητες αρχιτεκτονικής' },
      { code: '71.12', description: 'Δραστηριότητες μηχανικής και συναφείς τεχνικές συμβουλές' },
      { code: '69.10', description: 'Νομικές δραστηριότητες' }
    ];

    res.status(200).json({
      success: true,
      data: activityCodes
    });
  } catch (error) {
    console.error('Get activity codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving activity codes'
    });
  }
};

module.exports = {
  getSettings,
  createSettings,
  updateSettings,
  updateSection,
  getCompletionStatus,
  validateAFM,
  getTaxOffices,
  getActivityCodes
};