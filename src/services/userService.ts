import { useAuthStore } from '../store/useAuthStore';

// For backward compatibility - get current user ID from auth store
export function getCurrentUserId(): string {
  const userId = useAuthStore.getState().userId;
  if (!userId) {
    throw new Error('User is not authenticated');
  }
  return userId;
}

// Keep this for backward compatibility but it will be populated from auth store
export let CURRENT_USER_ID = 'ILXQ4ibn2FF4MBrSDaOy'; // Fallback for testing

// Initialize CURRENT_USER_ID from auth store if available
const userId = useAuthStore.getState().userId;
if (userId) {
  CURRENT_USER_ID = userId;
}

