import { arrayUnion, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function unlockAchievement(userId: string, achievement: string) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return;
  }

  const userData = snapshot.data();
  const currentAchievements = userData.achievements || [];

  if (currentAchievements.includes(achievement)) {
    return;
  }

  await updateDoc(userRef, {
    achievements: arrayUnion(achievement)
  });
}
