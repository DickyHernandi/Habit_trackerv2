import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

const USE_PROGRESS_HABIT_TEST_TIMING = true;
const PROGRESS_CHECKPOINT_DELAY_MS = USE_PROGRESS_HABIT_TEST_TIMING
  ? 2 * 60 * 1000
  : 2 * 60 * 60 * 1000;
const PROGRESS_NEXT_CHECKPOINT_DELAY_MS = USE_PROGRESS_HABIT_TEST_TIMING
  ? 4 * 60 * 1000
  : 4 * 60 * 60 * 1000;
const PROGRESS_REMINDER_AMOUNT = 30;
const PROGRESS_REMINDER_UNIT_MS = USE_PROGRESS_HABIT_TEST_TIMING ? 1000 : 60 * 1000;
const PROGRESS_REMINDER_UNIT_LABEL = USE_PROGRESS_HABIT_TEST_TIMING ? 'second' : 'minute';
const PROGRESS_REMINDER_UNIT_PLURAL_LABEL = USE_PROGRESS_HABIT_TEST_TIMING ? 'seconds' : 'minutes';
const PROGRESS_REMINDER_WINDOW_MS = PROGRESS_REMINDER_AMOUNT * PROGRESS_REMINDER_UNIT_MS;
const PROGRESS_NOTIFICATION_CHANNEL_ID = 'habit-progress-reminders';

export async function requestNotificationPermission() {
  const currentPermissions = await Notifications.getPermissionsAsync();

  if (currentPermissions.granted) {
    console.log('Notification permission already granted');
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  console.log('Notification permission request result', { status, currentPermissions });
  return status === 'granted';
}

export function getProgressCheckpointDelayMs() {
  return PROGRESS_CHECKPOINT_DELAY_MS;
}

export function getProgressNextCheckpointDelayMs() {
  return PROGRESS_NEXT_CHECKPOINT_DELAY_MS;
}

export function getProgressReminderWindowMs() {
  return PROGRESS_REMINDER_WINDOW_MS;
}

function getProgressNotificationTrigger(checkpointAvailableAt: number): Notifications.NotificationTriggerInput {
  const now = Date.now();
  const delayMs = Math.max(0, checkpointAvailableAt - now);

  if (delayMs <= 1000) {
    return null;
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(checkpointAvailableAt),
    channelId: PROGRESS_NOTIFICATION_CHANNEL_ID
  };
}

function resolveProgressCheckpointAvailableAt(isNextCheckpoint: boolean) {
  return Date.now() + (isNextCheckpoint ? getProgressNextCheckpointDelayMs() : getProgressCheckpointDelayMs());
}

async function ensureProgressNotificationChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(PROGRESS_NOTIFICATION_CHANNEL_ID, {
    name: 'Progress Habit Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    lightColor: '#2563EB'
  });
}

export async function showTimedHabitBackgroundWarning(habitName: string) {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Timed Habit Warning',
      body: `${habitName} akan gagal dalam 30 detik jika kamu tidak kembali ke aplikasi.`
    },
    trigger: null
  });
}

export async function showTimedHabitFailedNotification(habitName: string) {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Timed Habit Failed',
      body: `${habitName} gagal karena kamu meninggalkan aplikasi lebih dari 30 detik.`
    },
    trigger: null
  });
}

export async function scheduleProgressHabitNotifications(
  habitId: string,
  habitName: string,
  checkpointTarget: number,
  checkpointAvailableAt: number,
  checkpointStatus: 'pending' | 'missed' = 'pending',
  isNextCheckpoint = false
) {
  const granted = await requestNotificationPermission();
  const notificationIds: string[] = [];
  const fallbackCheckpointAvailableAt = resolveProgressCheckpointAvailableAt(isNextCheckpoint);
  const resolvedCheckpointAvailableAt = Number.isFinite(checkpointAvailableAt) && checkpointAvailableAt > Date.now()
    ? checkpointAvailableAt
    : fallbackCheckpointAvailableAt;

  console.log('Scheduling progress notification', {
    habitId,
    habitName,
    checkpointTarget,
    granted,
    checkpointStatus,
    isNextCheckpoint,
    fallbackCheckpointAvailableAt,
    resolvedCheckpointAvailableAt,
    incomingCheckpointAvailableAt: checkpointAvailableAt
  });

  if (granted) {
    try {
      await ensureProgressNotificationChannel();
      const trigger = getProgressNotificationTrigger(resolvedCheckpointAvailableAt);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Progress Habit Reminder',
          body: `Have you completed ${checkpointTarget} for ${habitName}? You have ${PROGRESS_REMINDER_AMOUNT} ${PROGRESS_REMINDER_UNIT_PLURAL_LABEL} to confirm.`,
          priority: 'max',
          vibrate: [0, 250, 250, 250],
          data: {
            habitId,
            reminderIndex: 0,
            type: 'progress-reminder'
          }
        },
        trigger: trigger
          ? {
              ...trigger,
              channelId: PROGRESS_NOTIFICATION_CHANNEL_ID
            }
          : null
      });

      notificationIds.push(notificationId);
      console.log('Progress notification scheduled', {
        habitId,
        notificationId,
        resolvedCheckpointAvailableAt,
        trigger
      });

      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      console.log('Scheduled notifications after progress schedule', {
        count: allScheduled.length,
        requests: allScheduled.map((request) => ({
          identifier: request.identifier,
          trigger: request.trigger,
          content: request.content
        }))
      });
    } catch (notificationError) {
      console.warn('Unable to schedule progress reminder', {
        habitId,
        resolvedCheckpointAvailableAt,
        notificationError
      });
    }
  }

  await updateDoc(doc(db, 'habits', habitId), {
    checkpointAvailableAt: resolvedCheckpointAvailableAt,
    checkpointReminderDeadlineAt: resolvedCheckpointAvailableAt + PROGRESS_REMINDER_WINDOW_MS,
    checkpointStatus,
    failed: false,
    notificationIds
  });

  return notificationIds;
}

export async function cancelScheduledNotification(notificationId?: string | null) {
  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelScheduledNotifications(notificationIds?: string[] | null) {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return;
  }

  await Promise.all(
    notificationIds.map((notificationId) =>
      notificationId
        ? Notifications.cancelScheduledNotificationAsync(notificationId)
        : Promise.resolve()
    )
  );
}

export async function saveNotificationTimestamp(habitId: string) {
  await updateDoc(doc(db, 'habits', habitId), {
    lastNotificationTime: Date.now(),
    notificationExpired: false
  });
}
