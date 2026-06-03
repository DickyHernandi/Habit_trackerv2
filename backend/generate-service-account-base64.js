import fs from 'fs';
import path from 'path';

const filePath = path.resolve(process.cwd(), 'serviceAccountKey.json');

if (!fs.existsSync(filePath)) {
  console.error('Error: backend/serviceAccountKey.json not found.');
  process.exit(1);
}

const keyJson = fs.readFileSync(filePath, 'utf8');
const base64 = Buffer.from(keyJson, 'utf8').toString('base64');
console.log(base64);
