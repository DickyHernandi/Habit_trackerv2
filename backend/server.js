import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import authRoutes from './authRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`   Register: POST http://localhost:${PORT}/auth/register`);
  console.log(`   Login:    POST http://localhost:${PORT}/auth/login`);
  console.log(`   Validate: POST http://localhost:${PORT}/auth/validate`);
});
