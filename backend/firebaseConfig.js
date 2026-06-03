import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fileDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(fileDir, '.env') });

// Debug: log whether SERVICE_ACCOUNT_BASE64 is present (no secret value printed)
if (process.env.SERVICE_ACCOUNT_BASE64) {
  console.log('DEBUG: SERVICE_ACCOUNT_BASE64 is present in environment');
} else {
  console.log('DEBUG: SERVICE_ACCOUNT_BASE64 is NOT present in environment');
}

// Load service account either from a file or from an environment variable (base64 encoded)
let serviceAccount = null;
const candidates = [
  path.resolve(process.cwd(), 'backend', 'serviceAccountKey.json'),
  path.resolve(process.cwd(), 'serviceAccountKey.json'),
  path.resolve(fileDir, 'serviceAccountKey.json')
];

console.log('DEBUG: checking serviceAccountKey paths:');
candidates.forEach((p) => console.log(`  - ${p} => ${fs.existsSync(p) ? 'FOUND' : 'missing'}`));

// choose first existing candidate as localPath
const localPath = candidates.find(p => fs.existsSync(p));
const envKey = process.env.SERVICE_ACCOUNT_BASE64?.trim() ?? process.env.SERVICE_ACCOUNT_JSON?.trim();
let envError = null;

if (envKey) {
  try {
    const decoded = envKey.startsWith('{')
      ? envKey
      : Buffer.from(envKey, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
    // write it to disk so local file-based tooling can also work
    try {
      const writePath = path.resolve(fileDir, 'serviceAccountKey.json');
      fs.writeFileSync(writePath, JSON.stringify(serviceAccount, null, 2), { encoding: 'utf8', flag: 'w' });
      console.log(`DEBUG: wrote serviceAccountKey.json to ${writePath}`);
    } catch (err) {
      console.warn('Warning: failed to write serviceAccountKey.json to disk:', err.message);
    }
  } catch (err) {
    envError = err;
    console.warn('Warning: Invalid SERVICE_ACCOUNT_BASE64/JSON value:', err.message);
    if (localPath) {
      console.warn('Falling back to local serviceAccountKey.json file.');
    }
  }
}

if (!serviceAccount) {
  if (localPath) {
    try {
      const raw = fs.readFileSync(localPath, 'utf8');
      serviceAccount = JSON.parse(raw);
    } catch (err) {
      console.error('Failed to read local serviceAccountKey.json:', err.message);
      process.exit(1);
    }
  } else {
    if (envError) {
      console.error('Invalid SERVICE_ACCOUNT_BASE64/JSON value and no local serviceAccountKey.json found.');
      console.error('Please fix SERVICE_ACCOUNT_BASE64/JSON or add backend/serviceAccountKey.json.');
    } else {
      console.error('ERROR: serviceAccountKey.json not found in any expected locations and SERVICE_ACCOUNT_BASE64/JSON not set.');
      console.error('Checked locations:\n' + candidates.join('\n'));
    }
    process.exit(1);
  }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export const db = admin.firestore();
export default admin;

// Additional debug info to help diagnose authentication issues
try {
  console.log('DEBUG: serviceAccount.project_id =', serviceAccount.project_id);
  console.log('DEBUG: serviceAccount.client_email =', serviceAccount.client_email);
} catch (err) {
  console.warn('DEBUG: failed to read serviceAccount fields:', err.message);
}

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('DEBUG: GOOGLE_APPLICATION_CREDENTIALS is set to', process.env.GOOGLE_APPLICATION_CREDENTIALS);
} else {
  console.log('DEBUG: GOOGLE_APPLICATION_CREDENTIALS is not set');
}

console.log('DEBUG: FIREBASE_PROJECT_ID env =', process.env.FIREBASE_PROJECT_ID);
