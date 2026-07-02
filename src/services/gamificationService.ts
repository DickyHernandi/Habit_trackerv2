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

// Fungsi ini menambah poin pengguna saat habit selesai, lalu menghitung level dan membuka achievement yang sesuai.
export async function addUserPoints(
  userId: string,
  earnedPoints: number,
  habitType?: string
) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return;

  const userData = snapshot.data();
  const currentPoints = userData.points || 0;
  const newPoints = currentPoints + earnedPoints;
  const newLevel = calculateLevel(newPoints);

  // Track completion counts
  const updateData: any = {
    points: increment(earnedPoints),
    level: newLevel
  };

  if (habitType === 'progress') {
    updateData.completedCheckpoints = increment(1);
  } else if (habitType === 'timed') {
    updateData.completedTimedHabits = increment(1);
  }

  updateData.completedHabits = increment(1);

  await updateDoc(userRef, updateData);

  const updatedSnapshot = await getDoc(userRef);
  if (!updatedSnapshot.exists()) return;

  const updatedData = updatedSnapshot.data();
  const updatedPoints = updatedData.points || 0;
  const updatedAchievements = updatedData.achievements || [];
  const updatedCompletedHabits = updatedData.completedHabits || 0;
  const updatedCompletedCheckpoints = updatedData.completedCheckpoints || 0;
  const updatedCompletedTimedHabits = updatedData.completedTimedHabits || 0;

  // Unlock achievements based on points
  if (updatedPoints >= 1000 && !updatedAchievements.includes('Ultimate Tracker')) {
    await unlockAchievement(userId, 'Ultimate Tracker');
  }

  // Unlock First Habit (first time with points)
  if (updatedCompletedHabits === 1 && earnedPoints > 0 && !updatedAchievements.includes('First Habit')) {
    await unlockAchievement(userId, 'First Habit');
  }

  // Unlock First Completion (first habit completed)
  if (updatedCompletedHabits === 1 && earnedPoints > 0 && !updatedAchievements.includes('First Completion')) {
    await unlockAchievement(userId, 'First Completion');
  }

  // Unlock Checkpoint Beginner (first checkpoint)
  if (habitType === 'progress' && updatedCompletedCheckpoints === 1 && !updatedAchievements.includes('Checkpoint Beginner')) {
    await unlockAchievement(userId, 'Checkpoint Beginner');
  }

  // Unlock Checkpoint Challenger (5 checkpoints)
  if (habitType === 'progress' && updatedCompletedCheckpoints === 5 && !updatedAchievements.includes('Checkpoint Challenger')) {
    await unlockAchievement(userId, 'Checkpoint Challenger');
  }

  // Unlock Checkpoint Champion (20 checkpoints)
  if (habitType === 'progress' && updatedCompletedCheckpoints === 20 && !updatedAchievements.includes('Checkpoint Champion')) {
    await unlockAchievement(userId, 'Checkpoint Champion');
  }

  // Unlock Timer Starter (first timed habit)
  if (habitType === 'timed' && updatedCompletedTimedHabits === 1 && !updatedAchievements.includes('Timer Starter')) {
    await unlockAchievement(userId, 'Timer Starter');
  }

  // Unlock Timer Pro (3 timed habits)
  if (habitType === 'timed' && updatedCompletedTimedHabits === 3 && !updatedAchievements.includes('Timer Pro')) {
    await unlockAchievement(userId, 'Timer Pro');
  }

  // Check for Badge Collector (10 achievements unlocked)
  if (updatedAchievements.length === 10 && !updatedAchievements.includes('Badge Collector')) {
    await unlockAchievement(userId, 'Badge Collector');
  }
}

// Fungsi ini memeriksa apakah jumlah habit yang dibuat sudah memenuhi syarat untuk membuka achievement tertentu.
export async function checkHabitCountAchievements(userId: string, habitCount: number, habitType?: string) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return;

  const userData = snapshot.data();
  const userAchievements = userData.achievements || [];

  if (habitCount === 1 && !userAchievements.includes('First Habit')) {
    await unlockAchievement(userId, 'First Habit');
  }

  if (habitType === 'timed' && habitCount === 1 && !userAchievements.includes('Timer Starter')) {
    await unlockAchievement(userId, 'Timer Starter');
  }

  // Unlock Habit Builder (5 habits)
  if (habitCount === 5 && !userAchievements.includes('Habit Builder')) {
    await unlockAchievement(userId, 'Habit Builder');
  }

  // Unlock Habit Master (20 habits)
  if (habitCount === 20 && !userAchievements.includes('Habit Master')) {
    await unlockAchievement(userId, 'Habit Master');
  }
}

// Fungsi ini mengecek jumlah history habit untuk membuka achievement terkait riwayat aktivitas pengguna.
export async function checkHistoryCountAchievements(userId: string, historyCount: number) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return;

  const userData = snapshot.data();
  const userAchievements = userData.achievements || [];

  // Unlock History Hunter (10 history entries)
  if (historyCount === 10 && !userAchievements.includes('History Hunter')) {
    await unlockAchievement(userId, 'History Hunter');
  }
}
