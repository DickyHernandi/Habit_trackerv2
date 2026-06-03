import bcrypt from 'bcryptjs';
import express from 'express';
import { db } from './firebaseConfig.js';
import { generateToken, verifyToken } from './middleware.js';

const router = express.Router();

// POST /auth/register - Create a new user
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Convert username to lowercase for case-insensitive storage
    const usernameLower = username.toLowerCase().trim();

    // Check if username already exists
    const existingUser = await db
      .collection('auth_users')
      .where('username', '==', usernameLower)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user document
    const userRef = await db.collection('auth_users').add({
      username: usernameLower,
      password: hashedPassword,
      createdAt: new Date(),
      points: 0,
      level: 1,
      streak: 0,
      lastCompletedDate: null
    });

    // Generate token
    const token = generateToken(userRef.id, usernameLower);

    // Also initialize user in the main users collection (for compatibility with existing habits)
    await db.collection('users').doc(userRef.id).set({
      username: usernameLower,
      points: 0,
      level: 1,
      streak: 0,
      lastCompletedDate: null,
      createdAt: new Date()
    });

    res.status(201).json({
      success: true,
      token,
      userId: userRef.id,
      username: usernameLower
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login - Authenticate user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Convert username to lowercase
    const usernameLower = username.toLowerCase().trim();

    // Find user
    const userSnapshot = await db
      .collection('auth_users')
      .where('username', '==', usernameLower)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // Verify password
    const passwordMatch = await bcrypt.compare(password, userData.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate token
    const token = generateToken(userDoc.id, usernameLower);

    res.json({
      success: true,
      token,
      userId: userDoc.id,
      username: usernameLower
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/validate - Check if token is valid
router.post('/validate', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      userId: req.userId,
      username: req.username
    });
  } catch (error) {
    res.status(401).json({ error: 'Token validation failed' });
  }
});

export default router;
