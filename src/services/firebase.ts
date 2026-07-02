import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// File ini menginisialisasi SDK Firebase untuk aplikasi frontend.
// Konfigurasi ini dipakai agar aplikasi bisa terhubung ke Firestore dan fitur lain dari Firebase.
const firebaseConfig = {
  apiKey: 'AIzaSyDBXGkzur5bfVDIQIhIMG0D45voTYNFROE',
  authDomain: 'habit-tracker-v2-9c3bf.firebaseapp.com',
  projectId: 'habit-tracker-v2-9c3bf',
  storageBucket: 'habit-tracker-v2-9c3bf.firebasestorage.app',
  messagingSenderId: '235181447337',
  appId: '1:235181447337:web:a24a59397bc774077031b8'
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);