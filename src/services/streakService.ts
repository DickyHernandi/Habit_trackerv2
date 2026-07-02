import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getTodayDate, getYesterdayDate } from '../utils/dateUtils';
import { unlockAchievement } from './achievementService';
import { db } from './firebase';

// Fungsi ini menghitung bonus poin tambahan berdasarkan panjang streak pengguna.
export function getStreakBonus(streak: number) {
  return streak >= 5 ? 10 : streak;
}

// Fungsi ini memperbarui streak pengguna setiap kali habit selesai, lalu memberi achievement jika streak mencapai batas tertentu.
export async function updateUserStreak(userId: string) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return 0;
  }

  const userData = snapshot.data();
  const today = getTodayDate();
  const lastCompletedDate = userData.lastCompletedDate;
  const currentStreak = userData.streak || 0;

  if (lastCompletedDate === today) {
    return currentStreak;
  }

  if (lastCompletedDate === getYesterdayDate()) {
    const nextStreak = currentStreak + 1;
    await updateDoc(userRef, {
      streak: nextStreak,
      lastCompletedDate: today
    });

    if (nextStreak === 3 && !userData.achievements?.includes('Consistency Kickoff')) {
      await unlockAchievement(userId, 'Consistency Kickoff');
    }

    if (nextStreak === 7 && !userData.achievements?.includes('Week of Wins')) {
      await unlockAchievement(userId, 'Week of Wins');
    }

    if (nextStreak === 14 && !userData.achievements?.includes('Streak Legend')) {
      await unlockAchievement(userId, 'Streak Legend');
    }
    return nextStreak;
  }

  await updateDoc(userRef, {
    streak: 1,
    lastCompletedDate: today
  });

  return 1;
}
