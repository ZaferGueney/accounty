import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7842; // Custom port :XZTY

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Accounty server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});