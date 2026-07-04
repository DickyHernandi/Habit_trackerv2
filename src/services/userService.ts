import { useAuthStore } from '../store/useAuthStore';

// Helper sederhana untuk mengambil ID user yang sedang login dari store auth.
// Dipakai di banyak service frontend agar tidak perlu meneruskan userId secara manual.
export function getCurrentUserId(): string {
  const userId = useAuthStore.getState().userId;
  if (!userId) {
    console.warn('[UserService] getCurrentUserId: tidak ada userId tersimpan di store');
    throw new Error('User is not authenticated');
  }
  return userId;
}

