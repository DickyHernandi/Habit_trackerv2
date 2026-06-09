import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthModal } from '@/components/auth/AuthModal';
import { requestNotificationPermission } from '@/services/notificationService';
import { useAuthStore } from '@/store/useAuthStore';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, restoreSession } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    async function prepareSplash() {
      try {
        await SplashScreen.preventAutoHideAsync();
      } catch {}
      await SplashScreen.hideAsync();
    }

    async function initNotifications() {
      await requestNotificationPermission();
    }

    async function checkAuth() {
      try {
        await restoreSession();
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

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received while app is running', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: notification.request.content.data
      });
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const habitId = response.notification.request.content.data?.habitId;
      if (habitId) {
        router.push(`/habit/${habitId}`);
      }
    });

    prepareSplash();
    initNotifications();
    checkAuth();

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [restoreSession]);

  if (!authChecked) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthModal visible={!isAuthenticated} />
      {isAuthenticated && <Slot />}
    </ThemeProvider>
  );
}
