import { AuthModal } from '@/components/auth/AuthModal';
import { registerDeviceToken } from '@/services/authService';
import { getBackendUrl } from '@/services/backendConfig';
import { reconcileMissedProgressHabitsForUser } from '@/services/notificationService';
import { useAuthStore } from '@/store/useAuthStore';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Slot, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, restoreSession } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Inisialisasi notifikasi Expo untuk perangkat ini.
    async function initNotifications() {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        const userToken = useAuthStore.getState().token;
        if (token && userToken) {
          try {
            await registerDeviceToken(token, userToken);
          } catch (error) {
            console.warn('Failed to register device token', error);
          }
        }
      }
    }

    // Pulihkan sesi auth dan rekonsiliasi habit progress yang terlewat.
    async function checkAuth() {
      try {
        await restoreSession();
        const userId = useAuthStore.getState().userId;
        if (userId) {
          const BACKEND_URL = await getBackendUrl();
          try {
            await fetch(`${BACKEND_URL}/reconcile-missed-progress?userId=${encodeURIComponent(userId)}`);
            await reconcileMissedProgressHabitsForUser(userId);
          } catch (backendError) {
            console.warn('Backend progress reconciliation failed:', backendError);
          }
        }
      } catch (error) {
        console.error('Auth restore failed:', error);
      } finally {
        setAuthChecked(true);
      }
    }

    // Atur cara notifikasi ditangani saat app berada di foreground.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      })
    });

    // Catat notifikasi yang diterima saat aplikasi sedang berjalan.
    const receivedSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      console.log('Notification received while app is running', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data
      });
    });

    // Tangani tap notifikasi dan buka layar habit terkait.
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

    initNotifications();
    checkAuth();

    // Saat app kembali aktif, rekonsiliasi lagi progress yang terlewat.
    const appStateSubscription = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        const userId = useAuthStore.getState().userId;
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
