import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

// Middleware ini memeriksa apakah request membawa token JWT yang valid.
// Jika token sah, informasi user akan ditambahkan ke request agar route berikutnya bisa mengakses identitas pengguna.
export function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    console.warn('[Backend] verifyToken: no token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (error) {
    console.warn('[Backend] verifyToken: invalid token', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Fungsi ini membuat token JWT yang dipakai untuk menjaga sesi login pengguna.
export function generateToken(userId, username) {
  return jwt.sign({ userId, username }, process.env.JWT_SECRET, { expiresIn: '30d' });
}
