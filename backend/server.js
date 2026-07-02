import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './authRoutes.js';
import { db } from './firebaseConfig.js';
import { reconcileMissedProgressHabits } from './progressReconciler.js';

const fileDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(fileDir, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware dasar: mengizinkan request dari frontend dan membaca body JSON.
app.use(cors());
app.use(express.json());

// Route autentikasi dipisahkan ke file tersendiri agar kode lebih terstruktur.
app.use('/auth', authRoutes);

// Endpoint /health dipakai untuk mengecek apakah server backend sedang aktif dan siap menerima request.
app.get('/health', (req, res) => {
  res.json({ status: 'Backend is running' });
});

// Endpoint debug ini membantu memastikan koneksi ke Firestore berjalan dengan baik sebelum fitur lain dipakai.
app.get('/debug/firestore', async (req, res) => {
  try {
    const result = await db.collection('auth_users').limit(1).get();
    res.json({ 
      status: 'Firestore connection OK',
      docCount: result.size,
      message: 'Service account credentials are valid and Firestore is accessible'
    });
  } catch (error) {
    res.status(500).json({
      status: 'Firestore connection FAILED',
      error: error.message,
      code: error.code,
      details: error.details || 'No additional details'
    });
  }
});

// Endpoint ini dipakai secara manual untuk menjalankan proses rekonsiliasi habit progres yang terlewat.
app.get('/reconcile-missed-progress', async (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

  try {
    const reconciled = await reconcileMissedProgressHabits({ userId });
    res.json({ success: true, reconciled: reconciled.length, details: reconciled });
  } catch (error) {
    console.error('Failed to reconcile missed progress habits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fungsi ini menjalankan scheduler berkala untuk memeriksa habit progres yang tidak terselesaikan secara otomatis.
function startMissedProgressScheduler() {
  const intervalMs = Number(process.env.PROGRESS_RECONCILER_INTERVAL_MS) || 30_000;

  setInterval(async () => {
    try {
      const reconciled = await reconcileMissedProgressHabits();
      if (reconciled.length > 0) {
        console.log(`Reconciled ${reconciled.length} missed progress habit(s)`);
      }
    } catch (error) {
      console.error('Progress reconciliation failed:', error);
    }
  }, intervalMs);
}

startMissedProgressScheduler();

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`   Register: POST http://localhost:${PORT}/auth/register`);
  console.log(`   Login:    POST http://localhost:${PORT}/auth/login`);
  console.log(`   Validate: POST http://localhost:${PORT}/auth/validate`);
});
