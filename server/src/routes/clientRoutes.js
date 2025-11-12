const express = require('express');
const router = express.Router();
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  updateClientStats,
  getClientsByService,
  getExpiringContracts
} = require('../controllers/clientController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/clients/expiring - Get expiring contracts (must come before /:id)
router.get('/expiring', getExpiringContracts);

// GET /api/clients/service/:serviceType - Get clients by service type
router.get('/service/:serviceType', getClientsByService);

// GET /api/clients - Get all clients for accountant
// POST /api/clients - Create new client
router.route('/')
  .get(getClients)
  .post(createClient);

// GET /api/clients/:id - Get single client
// PUT /api/clients/:id - Update client
// DELETE /api/clients/:id - Delete client
router.route('/:id')
  .get(getClientById)
  .put(updateClient)
  .delete(deleteClient);

// PUT /api/clients/:id/stats - Update client statistics
router.put('/:id/stats', updateClientStats);

module.exports = router;