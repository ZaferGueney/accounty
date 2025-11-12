const Client = require('../models/clientModel');
const User = require('../models/userModel');

// @desc    Get all clients for an accountant
// @route   GET /api/clients
// @access  Private (Accountant only)
const getClients = async (req, res) => {
  try {
    const accountantId = req.user.userId;

    // Check if user is an accountant
    const user = await User.findById(accountantId);
    if (!user || !user.isAccountant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Accountant privileges required.'
      });
    }

    const { 
      page = 1, 
      limit = 20, 
      search,
      serviceType,
      isActive = true
    } = req.query;

    let query = { accountant: accountantId };

    // Apply filters
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (serviceType) {
      query['contractInfo.serviceType'] = serviceType;
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { companyName: searchRegex },
        { contactPerson: searchRegex },
        { email: searchRegex },
        { 'taxInfo.afm': searchRegex }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { companyName: 1 }
    };

    const skip = (options.page - 1) * options.limit;

    const [clients, total] = await Promise.all([
      Client.find(query)
        .populate('accountant', 'firstName lastName email')
        .sort(options.sort)
        .skip(skip)
        .limit(options.limit),
      Client.countDocuments(query)
    ]);

    const pages = Math.ceil(total / options.limit);

    res.json({
      success: true,
      clients,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        pages
      }
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
      error: error.message
    });
  }
};

// @desc    Get single client by ID
// @route   GET /api/clients/:id
// @access  Private (Accountant only)
const getClientById = async (req, res) => {
  try {
    const accountantId = req.user.userId;
    const clientId = req.params.id;

    // Check if user is an accountant
    const user = await User.findById(accountantId);
    if (!user || !user.isAccountant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Accountant privileges required.'
      });
    }

    const client = await Client.findOne({ 
      _id: clientId, 
      accountant: accountantId 
    }).populate('accountant', 'firstName lastName email');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      client
    });
  } catch (error) {
    console.error('Get client by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch client',
      error: error.message
    });
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Private (Accountant only)
const createClient = async (req, res) => {
  try {
    const accountantId = req.user.userId;
    const clientData = req.body;

    // Check if user is an accountant
    const user = await User.findById(accountantId);
    if (!user || !user.isAccountant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Accountant privileges required.'
      });
    }

    // Check if client with same AFM already exists for this accountant
    const existingClient = await Client.findOne({
      accountant: accountantId,
      'taxInfo.afm': clientData.taxInfo?.afm
    });

    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'Client with this AFM already exists'
      });
    }

    const client = await Client.create({
      ...clientData,
      accountant: accountantId
    });

    await client.populate('accountant', 'firstName lastName email');

    res.status(201).json({
      success: true,
      client
    });
  } catch (error) {
    console.error('Create client error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `Client with this ${field} already exists`
      });
    }

    res.status(400).json({
      success: false,
      message: 'Failed to create client',
      error: error.message
    });
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private (Accountant only)
const updateClient = async (req, res) => {
  try {
    const accountantId = req.user.userId;
    const clientId = req.params.id;
    const updateData = req.body;

    // Check if user is an accountant
    const user = await User.findById(accountantId);
    if (!user || !user.isAccountant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Accountant privileges required.'
      });
    }

    const client = await Client.findOneAndUpdate(
      { _id: clientId, accountant: accountantId },
      updateData,
      { new: true, runValidators: true }
    ).populate('accountant', 'firstName lastName email');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      client
    });
  } catch (error) {
    console.error('Update client error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `Client with this ${field} already exists`
      });
    }

    res.status(400).json({
      success: false,
      message: 'Failed to update client',
      error: error.message
    });
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private (Accountant only)
const deleteClient = async (req, res) => {
  try {
    const accountantId = req.user.userId;
    const clientId = req.params.id;

    // Check if user is an accountant
    const user = await User.findById(accountantId);
    if (!user || !user.isAccountant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Accountant privileges required.'
      });
    }

    const client = await Client.findOneAndDelete({ 
      _id: clientId, 
      accountant: accountantId 
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete client',
      error: error.message
    });
  }
};

// @desc    Update client statistics
// @route   PUT /api/clients/:id/stats
// @access  Private (Accountant only)
const updateClientStats = async (req, res) => {
  try {
    const accountantId = req.user.userId;
    const clientId = req.params.id;

    // Check if user is an accountant
    const user = await User.findById(accountantId);
    if (!user || !user.isAccountant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Accountant privileges required.'
      });
    }

    const client = await Client.findOne({ 
      _id: clientId, 
      accountant: accountantId 
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    await client.updateStats();

    res.json({
      success: true,
      stats: client.stats
    });
  } catch (error) {
    console.error('Update client stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update client statistics',
      error: error.message
    });
  }
};

// @desc    Get clients by service type
// @route   GET /api/clients/service/:serviceType
// @access  Private (Accountant only)
const getClientsByService = async (req, res) => {
  try {
    const accountantId = req.user.userId;
    const { serviceType } = req.params;

    // Check if user is an accountant
    const user = await User.findById(accountantId);
    if (!user || !user.isAccountant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Accountant privileges required.'
      });
    }

    const clients = await Client.findByServiceType(accountantId, serviceType);

    res.json({
      success: true,
      clients
    });
  } catch (error) {
    console.error('Get clients by service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients by service type',
      error: error.message
    });
  }
};

// @desc    Get expiring client contracts
// @route   GET /api/clients/expiring
// @access  Private (Accountant only)
const getExpiringContracts = async (req, res) => {
  try {
    const accountantId = req.user.userId;
    const { daysAhead = 30 } = req.query;

    // Check if user is an accountant
    const user = await User.findById(accountantId);
    if (!user || !user.isAccountant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Accountant privileges required.'
      });
    }

    const clients = await Client.getExpiringContracts(accountantId, parseInt(daysAhead));

    res.json({
      success: true,
      clients,
      daysAhead: parseInt(daysAhead)
    });
  } catch (error) {
    console.error('Get expiring contracts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch expiring contracts',
      error: error.message
    });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  updateClientStats,
  getClientsByService,
  getExpiringContracts
};