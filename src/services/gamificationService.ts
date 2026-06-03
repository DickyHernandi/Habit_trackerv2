import {
    doc,
    getDoc,
    increment,
    updateDoc
} from 'firebase/firestore';

import { unlockAchievement } from './achievementService';
import { db } from './firebase';

import {
    calculateLevel
} from '../utils/levelUtils';

export async function addUserPoints(
  userId: string,
  earnedPoints: number
) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return;

  const userData = snapshot.data();
  const currentPoints = userData.points || 0;
  const userAchievements = userData.achievements || [];
  const newPoints = currentPoints + earnedPoints;
  const newLevel = calculateLevel(newPoints);

  await updateDoc(userRef, {
    points: increment(earnedPoints),
    level: newLevel
  });

  if (newPoints >= 100 && !userAchievements.includes('100 Points')) {
    await unlockAchievement(userId, '100 Points');
  }

  if (currentPoints === 0 && earnedPoints > 0 && !userAchievements.includes('First Habit')) {
    await unlockAchievement(userId, 'First Habit');
  }
}
