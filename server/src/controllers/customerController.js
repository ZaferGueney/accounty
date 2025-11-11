const Customer = require('../models/customerModel');

// @desc    Get all customers for a user
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, type, clientId } = req.query;
    const userId = req.user.userId;

    let query = { userId, isActive: true };

    // Filter by client if provided
    if (clientId) {
      query.clientId = clientId;
    }

    // Filter by customer type
    if (type && ['individual', 'business'].includes(type)) {
      query.customerType = type;
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { 'taxInfo.businessName': searchRegex },
        { 'taxInfo.afm': searchRegex }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { name: 1 }
    };

    // Manual pagination since we're not using mongoose-paginate
    const skip = (options.page - 1) * options.limit;
    
    const [customers, total] = await Promise.all([
      Customer.find(query)
        .skip(skip)
        .limit(options.limit)
        .sort(options.sort),
      Customer.countDocuments(query)
    ]);

    res.json({
      success: true,
      customers,
      pagination: {
        total,
        page: options.page,
        pages: Math.ceil(total / options.limit),
        limit: options.limit
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
};

// @desc    Get a single customer
// @route   GET /api/customers/:id
// @access  Private
const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      customer
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: error.message
    });
  }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
  try {
    const customerData = {
      ...req.body,
      userId: req.user.userId
    };

    // Check for duplicate AFM if provided
    if (customerData.taxInfo?.afm) {
      const existing = await Customer.findOne({
        userId: req.user.userId,
        'taxInfo.afm': customerData.taxInfo.afm
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Customer with this AFM already exists'
        });
      }
    }

    const customer = await Customer.create(customerData);

    res.status(201).json({
      success: true,
      customer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
  }
};

// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check for AFM conflicts if changing AFM
    if (req.body.taxInfo?.afm && req.body.taxInfo.afm !== customer.taxInfo?.afm) {
      const existing = await Customer.findOne({
        userId: req.user.userId,
        'taxInfo.afm': req.body.taxInfo.afm,
        _id: { $ne: customer._id }
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Another customer with this AFM already exists'
        });
      }
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key !== '_id' && key !== 'userId') {
        customer[key] = req.body[key];
      }
    });

    await customer.save();

    res.json({
      success: true,
      customer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update customer',
      error: error.message
    });
  }
};

// @desc    Delete a customer (soft delete)
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has invoices
    const Invoice = require('../models/invoiceModel');
    const invoiceCount = await Invoice.countDocuments({
      customerId: customer._id,
      status: { $ne: 'cancelled' }
    });

    if (invoiceCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete customer with ${invoiceCount} active invoices`
      });
    }

    customer.isActive = false;
    await customer.save();

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
};

// @desc    Search customers
// @route   GET /api/customers/search
// @access  Private
const searchCustomers = async (req, res) => {
  try {
    const { q, clientId } = req.query;
    const userId = req.user.userId;

    if (!q) {
      return res.json({
        success: true,
        customers: []
      });
    }

    const customers = await Customer.search(userId, q, clientId);

    res.json({
      success: true,
      customers
    });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search customers',
      error: error.message
    });
  }
};

module.exports = {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers
};