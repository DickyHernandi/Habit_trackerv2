import { useAuthStore } from '../store/useAuthStore';

// Helper sederhana untuk mengambil ID user yang sedang login dari store auth.
export function getCurrentUserId(): string {
  const userId = useAuthStore.getState().userId;
  if (!userId) {
    throw new Error('User is not authenticated');
  }
  return userId;
}

