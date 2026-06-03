import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config();

// Initialize Firebase Admin
// Make sure you have a service account key file at backend/serviceAccountKey.json
// Download it from Firebase Console > Project Settings > Service Accounts
const serviceAccount = await import('./serviceAccountKey.json', { assert: { type: 'json' } }).catch(() => null);

if (!serviceAccount) {
  console.error('ERROR: serviceAccountKey.json not found. Please download it from Firebase Console.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount.default)
});

export const db = admin.firestore();
export default admin;
