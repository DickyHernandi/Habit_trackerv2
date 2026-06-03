import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getTodayDate, getYesterdayDate } from '../utils/dateUtils';
import { unlockAchievement } from './achievementService';
import { db } from './firebase';

export function getStreakBonus(streak: number) {
  return streak >= 5 ? 10 : streak;
}

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

    if (nextStreak >= 7) {
      await unlockAchievement(userId, '7 Day Streak');
    }
    return nextStreak;
  }

  await updateDoc(userRef, {
    streak: 1,
    lastCompletedDate: today
  });

  return 1;
}
