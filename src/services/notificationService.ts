import * as Notifications from 'expo-notifications';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
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

function getProgressNotificationTrigger(checkpointAvailableAt: number): Notifications.NotificationTriggerInput | null {
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

      const reminderTrigger = getProgressNotificationTrigger(resolvedCheckpointAvailableAt);
      const reminderNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Progress Habit Reminder',
          body: `Have you completed ${checkpointTarget} for ${habitName}? You have ${PROGRESS_REMINDER_AMOUNT} ${PROGRESS_REMINDER_UNIT_PLURAL_LABEL} to confirm.`,
          priority: 'max',
          vibrate: [0, 250, 250, 250],
          data: {
            habitId,
            type: 'progress-reminder'
          }
        },
        trigger: reminderTrigger
          ? {
              ...reminderTrigger,
              channelId: PROGRESS_NOTIFICATION_CHANNEL_ID
            }
          : null
      });

      notificationIds.push(reminderNotificationId);

      const deadlineAt = resolvedCheckpointAvailableAt + PROGRESS_REMINDER_WINDOW_MS;
      const deadlineTrigger = getProgressNotificationTrigger(deadlineAt);
      const deadlineNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Progress Habit Missed',
          body: `You missed the checkpoint for ${habitName}. The next checkpoint will be scheduled automatically.`,
          priority: 'max',
          vibrate: [0, 250, 250, 250],
          data: {
            habitId,
            type: 'progress-failure'
          }
        },
        trigger: deadlineTrigger
          ? {
              ...deadlineTrigger,
              channelId: PROGRESS_NOTIFICATION_CHANNEL_ID
            }
          : null
      });

      notificationIds.push(deadlineNotificationId);

      console.log('Progress notification scheduled', {
        habitId,
        reminderNotificationId,
        deadlineNotificationId,
        resolvedCheckpointAvailableAt,
        deadlineAt,
        reminderTrigger,
        deadlineTrigger
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

function getNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export async function reconcileMissedProgressHabit(habit: any) {
  if (!habit || habit.type !== 'progress' || habit.completed || habit.failed) {
    return null;
  }

  const deadlineAt = getNumber(habit.checkpointReminderDeadlineAt, 0);
  if (deadlineAt <= 0 || Date.now() < deadlineAt) {
    return null;
  }

  await cancelScheduledNotifications(Array.isArray(habit.notificationIds) ? habit.notificationIds : []);

  const attemptedCheckpoints = getNumber(habit.attemptedCheckpoints, 0);
  const totalCheckpoint = Math.max(1, getNumber(habit.totalCheckpoint, 5));
  const newAttempted = attemptedCheckpoints + 1;
  const isCompleted = newAttempted >= totalCheckpoint;

  if (isCompleted) {
    const nextHabit = {
      ...habit,
      attemptedCheckpoints: newAttempted,
      completed: true,
      failed: true,
      checkpointStatus: 'pending',
      notificationIds: [],
      checkpointAvailableAt: null,
      checkpointReminderDeadlineAt: null,
      failedAt: Date.now()
    };

    await updateDoc(doc(db, 'habits', habit.id), {
      attemptedCheckpoints: nextHabit.attemptedCheckpoints,
      completed: nextHabit.completed,
      failed: nextHabit.failed,
      checkpointStatus: nextHabit.checkpointStatus,
      notificationIds: nextHabit.notificationIds,
      checkpointAvailableAt: nextHabit.checkpointAvailableAt,
      checkpointReminderDeadlineAt: nextHabit.checkpointReminderDeadlineAt,
      failedAt: nextHabit.failedAt
    });

    return nextHabit;
  }

  const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
  const reminderIds = await scheduleProgressHabitNotifications(
    habit.id,
    habit.name,
    getNumber(habit.checkpointTarget, 0),
    nextCheckpointAt,
    'missed',
    true
  );

  const nextHabit = {
    ...habit,
    attemptedCheckpoints: newAttempted,
    checkpointStatus: 'missed',
    completed: false,
    failed: false,
    notificationIds: reminderIds,
    checkpointAvailableAt: nextCheckpointAt,
    checkpointReminderDeadlineAt: nextCheckpointAt + PROGRESS_REMINDER_WINDOW_MS
  };

  await updateDoc(doc(db, 'habits', habit.id), {
    attemptedCheckpoints: nextHabit.attemptedCheckpoints,
    checkpointStatus: nextHabit.checkpointStatus,
    completed: nextHabit.completed,
    failed: nextHabit.failed,
    notificationIds: nextHabit.notificationIds,
    checkpointAvailableAt: nextHabit.checkpointAvailableAt,
    checkpointReminderDeadlineAt: nextHabit.checkpointReminderDeadlineAt
  });

  return nextHabit;
}

export async function reconcileMissedProgressHabitsForUser(userId: string) {
  if (!userId) {
    return;
  }

  const habitsSnapshot = await getDocs(
    query(
      collection(db, 'habits'),
      where('userId', '==', userId),
      where('type', '==', 'progress')
    )
  );

  const now = Date.now();
  const reconciliationPromises = habitsSnapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as any) }))
    .filter((habit: any) => {
      const deadlineAt = getNumber(habit.checkpointReminderDeadlineAt, 0);
      return (
        habit &&
        habit.type === 'progress' &&
        !habit.completed &&
        !habit.failed &&
        deadlineAt > 0 &&
        deadlineAt <= now
      );
    })
    .map((habit: any) => reconcileMissedProgressHabit(habit));

  await Promise.all(reconciliationPromises);
}
