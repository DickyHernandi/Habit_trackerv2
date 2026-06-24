import { AuthModal } from '@/components/auth/AuthModal';
import { reconcileMissedProgressHabitsForUser, requestNotificationPermission, reschedulePendingProgressHabitsForUser } from '@/services/notificationService';
import { useAuthStore } from '@/store/useAuthStore';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
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
    async function initNotifications() {
      await requestNotificationPermission();
    }

    const BACKEND_URL =
      (Constants.expoConfig?.extra as any)?.BACKEND_URL ||
      process.env.BACKEND_URL ||
      'https://habittrackerv2-production.up.railway.app';

    async function checkAuth() {
      try {
        await restoreSession();
        const userId = useAuthStore.getState().userId;
        if (userId) {
          try {
            await fetch(`${BACKEND_URL}/reconcile-missed-progress?userId=${encodeURIComponent(userId)}`);
          } catch (backendError) {
            console.warn('Backend progress reconciliation failed:', backendError);
          }
          await reschedulePendingProgressHabitsForUser(userId);
          await reconcileMissedProgressHabitsForUser(userId);
        }
      } catch (error) {
        console.error('Auth restore failed:', error);
      } finally {
        setAuthChecked(true);
      }
    }

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

      const habitId = notification.request.content.data?.habitId;
      const userId = useAuthStore.getState().userId;
      if (habitId && userId) {
        await reschedulePendingProgressHabitsForUser(userId);
        await reconcileMissedProgressHabitsForUser(userId);
      }
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

    initNotifications();
    checkAuth();

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
      <AuthModal visible={!isAuthenticated} />
      {isAuthenticated && <Slot />}
    </ThemeProvider>
  );
}
