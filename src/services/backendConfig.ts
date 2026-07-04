import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BACKEND_URL_STORAGE_KEY = 'BACKEND_URL_OVERRIDE';

const DEFAULT_BACKEND_URL =
  (Constants.expoConfig?.extra as any)?.BACKEND_URL ||
  process.env.BACKEND_URL ||
  'https://huggingface.co/spaces/Daedra007/Habit-Tracker';

export async function getBackendUrl() {
  try {
    const override = await AsyncStorage.getItem(BACKEND_URL_STORAGE_KEY);
    if (override) {
      console.log('[BackendConfig] getBackendUrl: override present', override);
      return override;
    }
  } catch (error) {
    console.warn('Gagal membaca override BACKEND_URL dari AsyncStorage', error);
  }

  console.log('[BackendConfig] getBackendUrl: using default backend', DEFAULT_BACKEND_URL);
  return DEFAULT_BACKEND_URL;
}

export async function setBackendUrl(url: string) {
  try {
    console.log('[BackendConfig] setBackendUrl: storing override', url);
    await AsyncStorage.setItem(BACKEND_URL_STORAGE_KEY, url);
  } catch (error) {
    console.warn('Gagal menyimpan override BACKEND_URL ke AsyncStorage', error);
  }
}

export async function clearBackendUrl() {
  try {
    console.log('[BackendConfig] clearBackendUrl: removing override');
    await AsyncStorage.removeItem(BACKEND_URL_STORAGE_KEY);
  } catch (error) {
    console.warn('Gagal menghapus override BACKEND_URL dari AsyncStorage', error);
  }
}

export function getDefaultBackendUrl() {
  return DEFAULT_BACKEND_URL;
}
