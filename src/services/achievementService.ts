import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Fungsi ini membuka achievement untuk pengguna jika belum pernah unlocked sebelumnya.
// Proses ini menambahkan nama achievement ke daftar achievements pengguna di Firestore.
export async function unlockAchievement(userId: string, achievement: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      console.log(`[AchievementService] User ${userId} does not exist`);
      return;
    }

    const userData = snapshot.data();
    const currentAchievements = userData.achievements || [];

    if (currentAchievements.includes(achievement)) {
      console.log(`[AchievementService] Achievement "${achievement}" already unlocked for user ${userId}`);
      return;
    }

    console.log(`[AchievementService] Unlocking achievement "${achievement}" for user ${userId}`);
    
    await updateDoc(userRef, {
      achievements: arrayUnion(achievement)
    });

    console.log(`[AchievementService] Successfully unlocked "${achievement}". Total achievements: ${currentAchievements.length + 1}`);
  } catch (error: any) {
    console.error(`[AchievementService] Failed to unlock achievement "${achievement}":`, error.message);
  }
}
