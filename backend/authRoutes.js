import bcrypt from 'bcryptjs';
import Expo from 'expo-server-sdk';
import express from 'express';
import admin, { db } from './firebaseConfig.js';
import { generateToken, verifyToken } from './middleware.js';

const router = express.Router();

// Route register dipakai saat pengguna baru membuat akun.
// Fungsi ini memvalidasi input, memastikan username belum dipakai, lalu menyimpan user dan mengirim token login.
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan Password diperlukan' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password harus 6 karakter atau lebih' });
    }

    // Mengubah username menjadi huruf kecil agar tidak case-sensitive dan menghapus spasi di awal/akhir.
    const usernameLower = username.toLowerCase().trim();

    // Cek apakah username sudah ada di Firestore.
    const existingUser = await db
      .collection('auth_users')
      .where('username', '==', usernameLower)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return res.status(409).json({ error: 'Username sudah ada' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat user baru di Firestore dengan koleksi "auth_users""
    const userRef = await db.collection('auth_users').add({
      username: usernameLower,
      password: hashedPassword,
      createdAt: new Date(),
      points: 0,
      level: 1,
      streak: 0,
      lastCompletedDate: null
    });

    // Buat token
    const token = generateToken(userRef.id, usernameLower);
    console.log('[Backend] register: user created', { userId: userRef.id, username: usernameLower });

    // Buat juga user di koleksi "user"
    await db.collection('users').doc(userRef.id).set({
      username: usernameLower,
      points: 0,
      level: 1,
      streak: 0,
      lastCompletedDate: null,
      createdAt: new Date(),
      pushTokens: []
    });

    res.status(201).json({
      success: true,
      token,
      userId: userRef.id,
      username: usernameLower
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registrasi Gagal' });
  }
});

// Route login memeriksa username dan password, lalu mengembalikan token jika kredensial sesuai.
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan Password diperlukan' });
    }

    // Ubah username menjadi huruf kecil agar tidak case-sensitive dan menghapus spasi di awal/akhir.
    const usernameLower = username.toLowerCase().trim();

    // Cari user di Firestore berdasarkan username.
    const userSnapshot = await db
      .collection('auth_users')
      .where('username', '==', usernameLower)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return res.status(401).json({ error: 'Username atau Password salah' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Cek password
    const passwordMatch = await bcrypt.compare(password, userData.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Username atau Password salah' });
    }

    // Buat token
    const token = generateToken(userDoc.id, usernameLower);
    console.log('[Backend] login: user authenticated', { userId: userDoc.id, username: usernameLower });

    res.json({
      success: true,
      token,
      userId: userDoc.id,
      username: usernameLower
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login Gagal' });
  }
});

// Route untuk mendaftarkan token push device pengguna agar backend dapat mengirim notifikasi.
// Token push akan disimpan hanya jika valid dan bukan duplikat.
router.post('/device-token', verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    console.log('[Backend] /auth/device-token called', { userId: req.userId, token });

    if (!token || typeof token !== 'string') {
      console.warn('[Backend] /auth/device-token invalid token data', token);
      return res.status(400).json({ error: 'Token push tidak valid' });
    }

    if (!Expo.isExpoPushToken(token)) {
      console.warn('[Backend] /auth/device-token invalid Expo token format', token);
      return res.status(400).json({ error: 'Token push bukan Expo push token' });
    }

    await db.collection('users').doc(req.userId).set({
      pushTokens: admin.firestore.FieldValue.arrayUnion(token)
    }, { merge: true });

    console.log('[Backend] /auth/device-token saved token for user', req.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Backend] Register device token error:', error);
    res.status(500).json({ error: 'Gagal mendaftarkan token device' });
  }
});

// Route validate dipakai untuk memeriksa apakah token pengguna masih valid sebelum fitur lain dibuka.
router.post('/validate', verifyToken, async (req, res) => {
  try {
    console.log('[Backend] /auth/validate: token valid', { userId: req.userId, username: req.username });
    res.json({
      success: true,
      userId: req.userId,
      username: req.username
    });
  } catch (error) {
    console.error('[Backend] /auth/validate failed', error);
    res.status(401).json({ error: 'Verifikasi Token Gagal' });
  }
});

export default router;
