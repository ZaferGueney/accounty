// The project .env wins over variables inherited from the launching shell
// (e.g. another app's MONGODB_URI). Render has no .env file, so its settings stand.
require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const { testRedisConnection } = require('./config/redis');
const aadeService = require('./services/aadeService');

// Import routes
const userRoutes = require('./routes/userRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const kadRoutes = require('./routes/kadRoutes');
const customerRoutes = require('./routes/customerRoutes');
const clientRoutes = require('./routes/clientRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const bankingRoutes = require('./routes/bankingRoutes');
const externalRoutes = require('./routes/externalRoutes');
const serviceRoutes = require('./routes/serviceRoutes');

const app = express();
const PORT = process.env.PORT || 7842;

// ---------------------------------------------------------------- startup
// The HTTP port opens right away (Render and the local client expect it), but
// /api requests wait until MongoDB is connected instead of failing or hanging
// on Mongoose's command buffer. That window right after a (re)start is what
// used to produce "random error, reload and it works".
const READY_WAIT_MS = Number(process.env.READY_WAIT_MS || 20000);
const state = { dbReady: false, startedAt: Date.now(), lastDbError: null };
let resolveDbReady;
let dbReadyPromise = new Promise((resolve) => { resolveDbReady = resolve; });

mongoose.connection.on('connected', () => {
  state.dbReady = true;
  resolveDbReady();
});
mongoose.connection.on('disconnected', () => {
  if (!state.dbReady) return;
  state.dbReady = false;
  console.warn('⚠️  MongoDB disconnected - requests will wait for the reconnect');
  dbReadyPromise = new Promise((resolve) => { resolveDbReady = resolve; });
});
mongoose.connection.on('reconnected', () => {
  state.dbReady = true;
  resolveDbReady();
  console.log('✅ MongoDB reconnected');
});

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('Database connection error: MONGODB_URI is not set');
    process.exit(1);
  }
  // MONGODB_DB lets a local/test run point at another database on the same cluster
  const options = {
    serverSelectionTimeoutMS: 15000,
    ...(process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {})
  };
  // Mongoose does not retry the *initial* connection; a DNS/wifi blip at boot
  // must not leave the server up but permanently without a database.
  for (let attempt = 1; ; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, options);
      console.log(`MongoDB Connected: ${conn.connection.host} (db: ${conn.connection.name})`);
      return;
    } catch (error) {
      state.lastDbError = error.message;
      const delay = Math.min(30000, 2000 * attempt);
      console.error(`Database connection failed (attempt ${attempt}): ${error.message} - retrying in ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

const waitForDb = (ms) => state.dbReady
  ? Promise.resolve(true)
  : Promise.race([
      dbReadyPromise.then(() => true),
      new Promise((r) => setTimeout(() => r(false), ms).unref())
    ]);

// Background checks: none of these may block or break request handling.
const testServices = async () => {
  await testRedisConnection();

  console.log('🇬🇷 Testing AADE myDATA API...');
  const aadeResult = await aadeService.testConnection();
  if (!aadeResult.success) {
    console.warn('⚠️  AADE API not available - invoicing features will be limited');
    console.warn(`   Reason: ${aadeResult.message}`);
    if (aadeResult.error === 'Configuration error') {
      console.warn('   💡 Add AADE credentials to .env file when ready for production');
    }
  }
  console.log('🚀 All service checks completed');
};

connectDB();
testServices().catch((error) => console.error('Service initialization error:', error.message));

// A stray rejected promise must never take the whole server down (Node exits
// on unhandled rejections by default) - log it and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.stack : reason);
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:4629',
  credentials: true
}));
app.use(cookieParser()); // Add cookie parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Express 5 leaves req.body undefined when a request has no body.
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// Health check: always answers, reports readiness (503 while not ready).
app.get('/api/health', (req, res) => {
  const ready = state.dbReady;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'OK' : 'STARTING',
    ready,
    message: ready ? 'Accounty server is running' : 'Accounty server is starting up',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Hold API requests until the database is ready (bounded wait).
app.use('/api', async (req, res, next) => {
  if (state.dbReady) return next();
  const ready = await waitForDb(READY_WAIT_MS);
  if (ready) return next();
  res.set('Retry-After', '5');
  res.status(503).json({
    success: false,
    code: 'STARTING_UP',
    message: 'Server is starting up or the database is unreachable. Please try again in a few seconds.'
  });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/kads', kadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/services', serviceRoutes);

// AADE service status check
app.get('/api/aade/status', (req, res) => {
  const status = aadeService.getStatus();
  res.json({
    success: true,
    aade: status
  });
});

// Test AADE connection endpoint
app.post('/api/aade/test', async (req, res) => {
  try {
    const result = await aadeService.testConnection();
    res.json({
      success: result.success,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  if (res.headersSent) return next(err);
  // Malformed JSON bodies etc. are client errors, not server crashes.
  const status = err.status || err.statusCode || 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});