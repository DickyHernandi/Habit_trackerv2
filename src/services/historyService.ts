import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

// Fungsi ini mencatat hasil habit ke koleksi history, baik selesai maupun gagal, agar riwayat aktivitas pengguna tersimpan.
export async function saveHistory(
  userId: string,
  habitName: string,
  habitType: string,
  points: number,
  status: 'completed' | 'failed' = 'completed'
) {
  await addDoc(collection(db, 'history'), {
    userId,
    habitName,
    habitType,
    points,
    status,
    completedAt: new Date()
  });
}
