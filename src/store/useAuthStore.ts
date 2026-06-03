import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  
  setAuth: (userId: string, username: string, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  restoreSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userId: null,
  username: null,
  token: null,
  loading: false,
  error: null,

  setAuth: (userId: string, username: string, token: string) => {
    set({ isAuthenticated: true, userId, username, token, error: null });
    AsyncStorage.setItem('authToken', token);
    AsyncStorage.setItem('userId', userId);
    AsyncStorage.setItem('username', username);
  },

  clearAuth: () => {
    set({ isAuthenticated: false, userId: null, username: null, token: null });
    AsyncStorage.removeItem('authToken');
    AsyncStorage.removeItem('userId');
    AsyncStorage.removeItem('username');
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  restoreSession: async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userId = await AsyncStorage.getItem('userId');
      const username = await AsyncStorage.getItem('username');

      if (token && userId && username) {
        set({ isAuthenticated: true, token, userId, username });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to restore session:', error);
      return false;
    }
  }
}));
