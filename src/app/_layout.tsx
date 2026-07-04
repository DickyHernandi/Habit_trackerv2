import { AuthModal } from '@/components/auth/AuthModal';
import { registerDeviceToken } from '@/services/authService';
import { getBackendUrl } from '@/services/backendConfig';
import { reconcileMissedProgressHabitsForUser } from '@/services/notificationService';
import { useAuthStore } from '@/store/useAuthStore';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Slot, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';

// Root layout bertanggung jawab memulihkan sesi auth, menginisialisasi notifikasi,
// dan menjaga agar event AppState ditangani saat aplikasi kembali aktif.
// Komponen ini menunggu sampai auth selesai diperiksa sebelum merender konten utama.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, restoreSession } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const notificationInitialized = useRef(false);
  const router = useRouter();

  // RootLayout bertanggung jawab memulihkan sesi auth, mendaftarkan notifikasi,
  // dan menangani event AppState ketika aplikasi aktif kembali.
  // Komponen ini hanya merender konten aplikasi setelah auth selesai diperiksa.
  async function initNotifications() {
    console.log('[Frontend] initNotifications: memeriksa izin notifikasi');
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;

    if (status !== 'granted') {
      console.log('[Frontend] initNotifications: izin belum granted, meminta izin');
      const permissionResponse = await Notifications.requestPermissionsAsync();
      finalStatus = permissionResponse.status;
    }

    console.log('[Frontend] initNotifications: finalStatus=', finalStatus);
    if (finalStatus !== 'granted') {
      console.warn('[Frontend] initNotifications: notifikasi tidak diizinkan');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData?.data;
    const userToken = useAuthStore.getState().token;
    const validExpoToken = typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

    console.log('[Frontend] initNotifications: push token diperoleh', {
      tokenPreview: typeof token === 'string' ? token.slice(0, 16) : token,
      validExpoToken,
      hasAuthToken: Boolean(userToken)
    });

    if (token && validExpoToken && userToken) {
      try {
        await registerDeviceToken(token, userToken);
        console.log('[Frontend] initNotifications: token device berhasil didaftarkan ke backend');
      } catch (error) {
        console.error('[Frontend] initNotifications: gagal mendaftarkan token device', error);
      }
    } else if (!validExpoToken) {
      console.warn('[Frontend] initNotifications: token Expo tidak valid, tidak didaftarkan ke backend', { token });
    } else {
      console.warn('[Frontend] initNotifications: token Expo atau auth token tidak tersedia');
    }
  }

  // Pulihkan sesi auth dan rekonsiliasi habit progress yang terlewat.
  async function checkAuth() {
    console.log('[Frontend] checkAuth: memulihkan sesi auth');
    try {
      await restoreSession();
      const userId = useAuthStore.getState().userId;
      console.log('[Frontend] checkAuth: sesi dipulihkan', { userId });
      if (userId) {
        const BACKEND_URL = await getBackendUrl();
        try {
          const response = await fetch(`${BACKEND_URL}/reconcile-missed-progress?userId=${encodeURIComponent(userId)}`);
          const data = await response.json();
          console.log('[Frontend] checkAuth: backend reconcile response', data);
          await reconcileMissedProgressHabitsForUser(userId);
        } catch (backendError) {
          console.error('[Frontend] checkAuth: rekonsiliasi backend gagal', backendError);
        }
      }
    } catch (error) {
      console.error('[Frontend] checkAuth: restore session gagal', error);
    } finally {
      setAuthChecked(true);
    }
  }

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      })
    });

    const receivedSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      console.log('Notification received while app is running', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data
      });
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const habitId = response.notification.request.content.data?.habitId;
      if (habitId) {
        const userId = useAuthStore.getState().userId;
        if (userId) {
          await reconcileMissedProgressHabitsForUser(userId);
        }
        router.push(`/habit/${habitId}`);
      }
    });

    checkAuth();

    const appStateSubscription = AppState.addEventListener('change', async (state) => {
      console.log('[Frontend] AppState changed to', state);
      if (state === 'active') {
        const userId = useAuthStore.getState().userId;
        console.log('[Frontend] AppState active, mencoba rekonsiliasi progress habit', { userId });
        if (userId) {
          await reconcileMissedProgressHabitsForUser(userId);
        }
      }
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, [restoreSession]);

  useEffect(() => {
    if (isAuthenticated && !notificationInitialized.current) {
      notificationInitialized.current = true;
      initNotifications();
    }
  }, [isAuthenticated]);

  if (!authChecked) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Tampilkan modal login jika user belum terautentikasi. */}
      <AuthModal visible={!isAuthenticated} />
      {/* Render halaman yang sesuai hanya jika user sudah login. */}
      {isAuthenticated && <Slot />}
    </ThemeProvider>
  );
}
