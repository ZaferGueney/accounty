const KAD = require("../models/kadModel");
const { redisUtils } = require("../config/redis");

// @desc    Get all KADs with pagination and filtering
// @route   GET /api/kads
// @access  Public
const getKADs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      section,
      category,
      popular,
      sort = "code",
    } = req.query;

    const query = { isActive: true };

    // Apply filters with enhanced search and proper prioritization
    if (search) {
      const cleanSearch = search.replace(/[\s.]/g, "");
      const isCodeSearch = /^[\d.]+$/.test(search);

      if (isCodeSearch) {
        // Code-based search with proper escaping
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const escapedCleanSearch = cleanSearch.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        query.$or = [
          // Exact matches (highest priority)
          { code: search },
          { originalCode: search },
          { originalCode: cleanSearch },

          // Starts with search (7022 should find 70.22.10.00)
          { code: new RegExp(`^${escapedSearch.replace(/\\./g, "\\.")}`, "i") },
          { code: new RegExp(`^${escapedCleanSearch}`, "i") },
          { originalCode: new RegExp(`^${escapedCleanSearch}`, "i") },

          // Contains search pattern
          { code: new RegExp(escapedSearch.replace(/\\./g, "\\."), "i") },
          { originalCode: new RegExp(escapedCleanSearch, "i") },
        ];
      } else {
        // Text-based search
        query.$or = [
          // Description search (Greek and English)
          { description: new RegExp(search, "i") },
          { descriptionEN: new RegExp(search, "i") },
          // Keywords search
          { keywords: { $in: [new RegExp(search, "i")] } },
        ];
      }
    }

    if (section) {
      query.section = section;
    }

    if (category) {
      query.category = new RegExp(category, "i");
    }

    if (popular === "true") {
      query.isPopular = true;
    }

    // Sorting options
    let sortObj = {};
    switch (sort) {
      case "code":
        sortObj = { code: 1 };
        break;
      case "description":
        sortObj = { description: 1 };
        break;
      case "popular":
        sortObj = { isPopular: -1, code: 1 };
        break;
      case "section":
        sortObj = { section: 1, code: 1 };
        break;
      default:
        sortObj = { code: 1 };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortObj,
      lean: true,
    };

    const result = await KAD.paginate(query, options);

    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        page: result.page,
        pages: result.totalPages,
        total: result.totalDocs,
        limit: result.limit,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Get KADs error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving KADs",
    });
  }
};

// @desc    Get single KAD by code
// @route   GET /api/kads/:code
// @access  Public
const getKAD = async (req, res) => {
  try {
    const { code } = req.params;

    const kad = await KAD.findOne({ code, isActive: true });

    if (!kad) {
      return res.status(404).json({
        success: false,
        message: "KAD not found",
      });
    }

    res.status(200).json({
      success: true,
      data: kad,
    });
  } catch (error) {
    console.error("Get KAD error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving KAD",
    });
  }
};

// @desc    Create new KAD
// @route   POST /api/kads
// @access  Private (Admin)
const createKAD = async (req, res) => {
  try {
    const kadData = req.body;

    // Check if KAD already exists
    const existingKAD = await KAD.findOne({ code: kadData.code });
    if (existingKAD) {
      return res.status(400).json({
        success: false,
        message: "KAD with this code already exists",
      });
    }

    const kad = await KAD.create(kadData);

    res.status(201).json({
      success: true,
      message: "KAD created successfully",
      data: kad,
    });
  } catch (error) {
    console.error("Create KAD error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating KAD",
    });
  }
};

// @desc    Update KAD
// @route   PUT /api/kads/:code
// @access  Private (Admin)
const updateKAD = async (req, res) => {
  try {
    const { code } = req.params;
    const updateData = req.body;

    const kad = await KAD.findOneAndUpdate(
      { code },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!kad) {
      return res.status(404).json({
        success: false,
        message: "KAD not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "KAD updated successfully",
      data: kad,
    });
  } catch (error) {
    console.error("Update KAD error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating KAD",
    });
  }
};

// @desc    Delete KAD (soft delete)
// @route   DELETE /api/kads/:code
// @access  Private (Admin)
const deleteKAD = async (req, res) => {
  try {
    const { code } = req.params;

    const kad = await KAD.findOneAndUpdate(
      { code },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!kad) {
      return res.status(404).json({
        success: false,
        message: "KAD not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "KAD deactivated successfully",
    });
  } catch (error) {
    console.error("Delete KAD error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting KAD",
    });
  }
};

// @desc    Bulk upload KADs from JSON
// @route   POST /api/kads/bulk-upload
// @access  Private (Admin)
const bulkUploadKADs = async (req, res) => {
  try {
    const { kads, replaceExisting = false } = req.body;

    if (!Array.isArray(kads)) {
      return res.status(400).json({
        success: false,
        message: "KADs must be an array",
      });
    }

    let created = 0;
    let updated = 0;
    let errors = [];

    for (const kadData of kads) {
      try {
        const existingKAD = await KAD.findOne({ code: kadData.code });

        if (existingKAD) {
          if (replaceExisting) {
            await KAD.findOneAndUpdate(
              { code: kadData.code },
              { ...kadData, updatedAt: new Date() },
              { runValidators: true }
            );
            updated++;
          } else {
            errors.push(`KAD ${kadData.code} already exists`);
          }
        } else {
          await KAD.create(kadData);
          created++;
        }
      } catch (error) {
        errors.push(`Error processing KAD ${kadData.code}: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: "Bulk upload completed",
      stats: {
        total: kads.length,
        created,
        updated,
        errors: errors.length,
      },
      errors: errors.slice(0, 10), // Limit error messages
    });
  } catch (error) {
    console.error("Bulk upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error during bulk upload",
    });
  }
};

// @desc    Get KAD sections with counts
// @route   GET /api/kads/sections
// @access  Public
const getSections = async (req, res) => {
  try {
    const sections = await KAD.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$section",
          count: { $sum: 1 },
          popularCount: {
            $sum: { $cond: [{ $eq: ["$isPopular", true] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: sections,
    });
  } catch (error) {
    console.error("Get sections error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving sections",
    });
  }
};

// @desc    Search KADs
// @route   GET /api/kads/search/:query
// @access  Public
const searchKADs = async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 20 } = req.query;

    const kads = await KAD.search(query).limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: kads,
    });
  } catch (error) {
    console.error("Search KADs error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching KADs",
    });
  }
};

// @desc    Get popular KADs
// @route   GET /api/kads/popular
// @access  Public
const getPopularKADs = async (req, res) => {
  try {
    const kads = await KAD.getPopular();

    res.status(200).json({
      success: true,
      data: kads,
    });
  } catch (error) {
    console.error("Get popular KADs error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving popular KADs",
    });
  }
};

module.exports = {
  getKADs,
  getKAD,
  createKAD,
  updateKAD,
  deleteKAD,
  bulkUploadKADs,
  getSections,
  searchKADs,
  getPopularKADs,
};
