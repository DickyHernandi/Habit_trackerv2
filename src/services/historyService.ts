import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

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
