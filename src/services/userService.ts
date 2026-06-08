import { useAuthStore } from '../store/useAuthStore';

export function getCurrentUserId(): string {
  const userId = useAuthStore.getState().userId;
  if (!userId) {
    throw new Error('User is not authenticated');
  }
  return userId;
}

