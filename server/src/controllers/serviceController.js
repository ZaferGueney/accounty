const Service = require('../models/serviceModel');

// @desc    Get all services for a user
// @route   GET /api/services
// @access  Private
const getServices = async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const userId = req.user.userId;

    let query = { userId, isActive: true };

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [services, total] = await Promise.all([
      Service.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ 'stats.timesUsed': -1, name: 1 }),
      Service.countDocuments(query)
    ]);

    res.json({
      success: true,
      services,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message
    });
  }
};

// @desc    Get a single service
// @route   GET /api/services/:id
// @access  Private
const getService = async (req, res) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service',
      error: error.message
    });
  }
};

// @desc    Create a new service
// @route   POST /api/services
// @access  Private
const createService = async (req, res) => {
  try {
    const userId = req.user.userId;
    const serviceData = req.body;

    // Check for duplicate name
    const existingService = await Service.findOne({
      userId,
      name: serviceData.name?.trim(),
      isActive: true
    });

    if (existingService) {
      return res.status(400).json({
        success: false,
        message: 'A service with this name already exists'
      });
    }

    const service = await Service.create({
      ...serviceData,
      userId
    });

    res.status(201).json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create service',
      error: error.message
    });
  }
};

// @desc    Update a service
// @route   PUT /api/services/:id
// @access  Private
const updateService = async (req, res) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Check for duplicate name (if name is being changed)
    if (req.body.name && req.body.name.trim() !== service.name) {
      const existingService = await Service.findOne({
        userId: req.user.userId,
        name: req.body.name.trim(),
        isActive: true,
        _id: { $ne: service._id }
      });

      if (existingService) {
        return res.status(400).json({
          success: false,
          message: 'A service with this name already exists'
        });
      }
    }

    // Update allowed fields
    const allowedUpdates = [
      'name', 'description', 'basePrice', 'unit',
      'vatCategory', 'incomeClassification', 'stats'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        service[field] = req.body[field];
      }
    });

    await service.save();

    res.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update service',
      error: error.message
    });
  }
};

// @desc    Delete a service (soft delete)
// @route   DELETE /api/services/:id
// @access  Private
const deleteService = async (req, res) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Soft delete
    service.isActive = false;
    await service.save();

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service',
      error: error.message
    });
  }
};

// @desc    Search services (for autocomplete)
// @route   GET /api/services/search
// @access  Private
const searchServices = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user.userId;

    if (!q || q.length < 2) {
      return res.json({ success: true, services: [] });
    }

    const services = await Service.search(userId, q);

    res.json({
      success: true,
      services
    });
  } catch (error) {
    console.error('Search services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search services',
      error: error.message
    });
  }
};

// @desc    Get recent/most-used services
// @route   GET /api/services/recent
// @access  Private
const getRecentServices = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const services = await Service.getRecent(userId, parseInt(limit));

    res.json({
      success: true,
      services
    });
  } catch (error) {
    console.error('Get recent services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent services',
      error: error.message
    });
  }
};

// @desc    Track service usage (increment counter)
// @route   POST /api/services/:id/track
// @access  Private
const trackServiceUsage = async (req, res) => {
  try {
    const service = await Service.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await service.trackUsage();

    res.json({
      success: true,
      service
    });
  } catch (error) {
    console.error('Track service usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track service usage',
      error: error.message
    });
  }
};

module.exports = {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  searchServices,
  getRecentServices,
  trackServiceUsage
};
