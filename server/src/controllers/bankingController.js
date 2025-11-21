const Banking = require('../models/bankingModel');
const Settings = require('../models/settingsModel');

// @desc    Get all banks for a user
// @route   GET /api/banking
// @access  Private
const getBanks = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    const banks = await Banking.find({ userId, isActive: true })
      .sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: banks
    });
  } catch (error) {
    console.error('Get banks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving banks'
    });
  }
};

// @desc    Get a single bank
// @route   GET /api/banking/:id
// @access  Private
const getBank = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const bank = await Banking.findOne({
      _id: req.params.id,
      userId
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank not found'
      });
    }

    res.status(200).json({
      success: true,
      data: bank
    });
  } catch (error) {
    console.error('Get bank error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving bank'
    });
  }
};

// @desc    Get default bank for user
// @route   GET /api/banking/default
// @access  Private
const getDefaultBank = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const bank = await Banking.getDefaultBank(userId);

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'No default bank found'
      });
    }

    res.status(200).json({
      success: true,
      data: bank
    });
  } catch (error) {
    console.error('Get default bank error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving default bank'
    });
  }
};

// @desc    Create a new bank
// @route   POST /api/banking
// @access  Private
const createBank = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    // Get user's settings for reference
    const settings = await Settings.findOne({ userId });

    // Check if this is the first bank - make it default
    const existingBanks = await Banking.countDocuments({ userId, isActive: true });
    const isFirstBank = existingBanks === 0;

    const bankData = {
      userId,
      settingsId: settings?._id,
      accountName: req.body.accountName,
      bankName: req.body.bankName,
      iban: req.body.iban,
      swift: req.body.swift,
      notes: req.body.notes,
      isDefault: req.body.isDefault !== undefined ? req.body.isDefault : isFirstBank,
      isActive: true
    };

    const bank = await Banking.create(bankData);

    res.status(201).json({
      success: true,
      message: 'Bank created successfully',
      data: bank
    });
  } catch (error) {
    console.error('Create bank error:', error);

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
      message: 'Error creating bank'
    });
  }
};

// @desc    Update a bank
// @route   PUT /api/banking/:id
// @access  Private
const updateBank = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    const bank = await Banking.findOne({
      _id: req.params.id,
      userId
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank not found'
      });
    }

    // Update allowed fields
    const allowedFields = ['accountName', 'bankName', 'iban', 'swift', 'notes', 'isDefault'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        bank[field] = req.body[field];
      }
    });

    await bank.save();

    res.status(200).json({
      success: true,
      message: 'Bank updated successfully',
      data: bank
    });
  } catch (error) {
    console.error('Update bank error:', error);

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
      message: 'Error updating bank'
    });
  }
};

// @desc    Delete a bank (soft delete)
// @route   DELETE /api/banking/:id
// @access  Private
const deleteBank = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    const bank = await Banking.findOne({
      _id: req.params.id,
      userId
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank not found'
      });
    }

    // Soft delete
    bank.isActive = false;

    // If this was the default bank, set another bank as default
    if (bank.isDefault) {
      bank.isDefault = false;
      await bank.save();

      // Find another active bank and make it default
      const anotherBank = await Banking.findOne({
        userId,
        isActive: true,
        _id: { $ne: bank._id }
      });

      if (anotherBank) {
        anotherBank.isDefault = true;
        await anotherBank.save();
      }
    } else {
      await bank.save();
    }

    res.status(200).json({
      success: true,
      message: 'Bank deleted successfully'
    });
  } catch (error) {
    console.error('Delete bank error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting bank'
    });
  }
};

// @desc    Set bank as default
// @route   PUT /api/banking/:id/set-default
// @access  Private
const setDefaultBank = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    const bank = await Banking.findOne({
      _id: req.params.id,
      userId,
      isActive: true
    });

    if (!bank) {
      return res.status(404).json({
        success: false,
        message: 'Bank not found'
      });
    }

    await bank.setAsDefault();

    res.status(200).json({
      success: true,
      message: 'Default bank updated successfully',
      data: bank
    });
  } catch (error) {
    console.error('Set default bank error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting default bank'
    });
  }
};

module.exports = {
  getBanks,
  getBank,
  getDefaultBank,
  createBank,
  updateBank,
  deleteBank,
  setDefaultBank
};
