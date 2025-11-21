require('dotenv').config();
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

const app = express();
const PORT = process.env.PORT || 7842;

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://dbFyped:bat8fugi4@cluster0.9ire6.mongodb.net/Accounty?retryWrites=true&w=majority');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Test services on startup
const testServices = async () => {
  // Test database connection
  await connectDB();
  
  // Test Redis connection
  await testRedisConnection();
  
  // Test AADE API connection
  console.log('\n🇬🇷 Testing AADE myDATA API...');
  const aadeResult = await aadeService.testConnection();
  
  if (!aadeResult.success) {
    console.warn('⚠️  AADE API not available - invoicing features will be limited');
    console.warn(`   Reason: ${aadeResult.message}`);
    
    // Don't exit the server, just warn the user
    if (aadeResult.error === 'Configuration error') {
      console.warn('   💡 Add AADE credentials to .env file when ready for production');
    }
  }
  
  console.log('\n🚀 All service checks completed\n');
};

// Initialize services
testServices().catch(error => {
  console.error('Service initialization error:', error);
  // Don't exit - let the server start even if some services fail
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:4629',
  credentials: true
}));
app.use(cookieParser()); // Add cookie parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/kads', kadRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/external', externalRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Accounty server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

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
  console.error(err.stack);
  res.status(500).json({
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