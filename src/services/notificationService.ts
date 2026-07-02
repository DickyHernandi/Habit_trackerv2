import * as Notifications from 'expo-notifications';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from './firebase';
import { addUserPoints } from './gamificationService';
import { saveHistory } from './historyService';
import { getStreakBonus, updateUserStreak } from './streakService';

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
  ? 3 * 60 * 1000
  : 3 * 60 * 60 * 1000;
const PROGRESS_NEXT_CHECKPOINT_DELAY_MS = USE_PROGRESS_HABIT_TEST_TIMING
  ? 3 * 60 * 1000
  : 3 * 60 * 60 * 1000;
const PROGRESS_REMINDER_AMOUNT = USE_PROGRESS_HABIT_TEST_TIMING ? 30 : 30;
const PROGRESS_REMINDER_UNIT_MS = USE_PROGRESS_HABIT_TEST_TIMING ? 1000 : 60 * 1000;
const PROGRESS_REMINDER_UNIT_LABEL = USE_PROGRESS_HABIT_TEST_TIMING ? 'detik' : 'menit';
const PROGRESS_REMINDER_UNIT_PLURAL_LABEL = USE_PROGRESS_HABIT_TEST_TIMING ? 'detik' : 'menit';
const PROGRESS_REMINDER_WINDOW_MS = PROGRESS_REMINDER_AMOUNT * PROGRESS_REMINDER_UNIT_MS;
const PROGRESS_NOTIFICATION_CHANNEL_ID = 'habit-progress-reminders';

// Fungsi ini meminta izin notifikasi ke pengguna supaya reminder dan alert bisa ditampilkan.
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

// Fungsi ini mengembalikan durasi awal sebelum checkpoint progress pertama tersedia.
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
  const safeTargetAt = Math.max(checkpointAvailableAt, now + 1000);
  const delayMs = Math.max(0, safeTargetAt - now);

  if (delayMs <= 1000) {
    return null;
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: new Date(safeTargetAt),
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
    name: 'Pengingat Progress Habit',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableLights: true,
    lightColor: '#2563EB'
  });
}

// Fungsi ini menampilkan notifikasi peringatan saat timer habit timed sedang berjalan dan aplikasi pindah ke latar belakang.
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

// Fungsi ini menampilkan notifikasi ketika habit timed gagal karena pengguna meninggalkan aplikasi terlalu lama.
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

function formatProgressTargetNotificationText(checkpointTarget: number, unit?: string) {
  const targetText = Number.isFinite(checkpointTarget) && checkpointTarget > 0
    ? `${checkpointTarget}${unit ? ` ${unit}` : ''}`
    : `${checkpointTarget}`;

  return targetText;
}

// Fungsi ini menyimpan status checkpoint progress ke Firestore tanpa menjadwalkan notifikasi lokal.
export async function scheduleProgressHabitNotifications(
  habitId: string,
  habitName: string,
  checkpointTarget: number,
  checkpointAvailableAt: number,
  checkpointStatus: 'pending' | 'missed' = 'pending',
  isNextCheckpoint = false,
  unit?: string,
  existingNotificationIds?: string[] | null
) {
  const fallbackCheckpointAvailableAt = resolveProgressCheckpointAvailableAt(isNextCheckpoint);
  const resolvedCheckpointAvailableAt = Number.isFinite(checkpointAvailableAt) && checkpointAvailableAt > Date.now()
    ? checkpointAvailableAt
    : fallbackCheckpointAvailableAt;

  await updateDoc(doc(db, 'habits', habitId), {
    checkpointAvailableAt: resolvedCheckpointAvailableAt,
    checkpointReminderDeadlineAt: resolvedCheckpointAvailableAt + PROGRESS_REMINDER_WINDOW_MS,
    checkpointStatus,
    failed: false,
    notificationIds: []
  });

  return [];
}

// Fungsi ini membatalkan satu notifikasi yang sudah dijadwalkan sebelumnya.
export async function cancelScheduledNotification(notificationId?: string | null) {
  if (!notificationId) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// Fungsi ini membatalkan beberapa notifikasi sekaligus saat habit berubah status atau selesai.
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

function hasPassedCheckpointInCurrentCycle(habit: any) {
  const checkpointResults = Array.isArray(habit?.checkpointResults) && habit.checkpointResults.length > 0
    ? habit.checkpointResults
    : Array.from({ length: 5 }, (_, index) => {
        if (index < getNumber(habit?.completedCheckpoint, 0)) {
          return 'passed';
        }
        if (index < getNumber(habit?.attemptedCheckpoints, 0)) {
          return 'failed';
        }
        return 'pending';
      });

  return checkpointResults.some((result: string | undefined) => result === 'passed');
}

async function finalizeProgressHabitCompletion(habit: any, hasSuccess: boolean) {
  if (!habit?.userId) {
    return;
  }

  if (!hasSuccess) {
    await saveHistory(habit.userId, habit.name, habit.type, 0, 'failed');
    return;
  }

  const checkpointPoints = getNumber(habit?.completedCheckpoint, 0) * 10;
  const nextStreak = await updateUserStreak(habit.userId);
  const streakBonus = getStreakBonus(nextStreak);
  const finalEarnedPoints = checkpointPoints + streakBonus;

  await addUserPoints(habit.userId, finalEarnedPoints, 'progress');
  await saveHistory(habit.userId, habit.name, habit.type, finalEarnedPoints, 'completed');
}

// Fungsi ini memproses habit progress yang melewati deadline checkpoint dan menentukan apakah habit tersebut dianggap gagal atau dilanjutkan.
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
  const totalCheckpoint = 5;
  const newAttempted = attemptedCheckpoints + 1;
  const isCompleted = newAttempted >= totalCheckpoint;
  const checkpointResults = Array.isArray(habit.checkpointResults) && habit.checkpointResults.length > 0
    ? [...habit.checkpointResults]
    : Array.from({ length: totalCheckpoint }, (_, index) => {
        if (index < getNumber(habit.completedCheckpoint, 0)) {
          return 'passed';
        }
        if (index < attemptedCheckpoints) {
          return 'failed';
        }
        return 'pending';
      });

  const nextIndex = checkpointResults.findIndex((result: string | undefined) => result === 'pending');
  if (nextIndex !== -1) {
    checkpointResults[nextIndex] = 'failed';
  }

  const hasSuccess = hasPassedCheckpointInCurrentCycle({ ...habit, checkpointResults });

  if (isCompleted) {
    const nextHabit = {
      ...habit,
      attemptedCheckpoints: newAttempted,
      completed: hasSuccess,
      failed: !hasSuccess,
      checkpointStatus: hasSuccess ? 'pending' : 'failed',
      notificationIds: [],
      checkpointAvailableAt: null,
      checkpointReminderDeadlineAt: null,
      completedAt: hasSuccess ? Date.now() : null,
      failedAt: !hasSuccess ? Date.now() : null,
      checkpointResults
    };

    await updateDoc(doc(db, 'habits', habit.id), {
      attemptedCheckpoints: nextHabit.attemptedCheckpoints,
      completed: nextHabit.completed,
      failed: nextHabit.failed,
      checkpointStatus: nextHabit.checkpointStatus,
      notificationIds: nextHabit.notificationIds,
      checkpointAvailableAt: nextHabit.checkpointAvailableAt,
      checkpointReminderDeadlineAt: nextHabit.checkpointReminderDeadlineAt,
      completedAt: nextHabit.completedAt ?? null,
      failedAt: nextHabit.failedAt,
      checkpointResults: nextHabit.checkpointResults
    });

    await finalizeProgressHabitCompletion(habit, hasSuccess);
    return nextHabit;
  }

  const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
  const reminderIds = await scheduleProgressHabitNotifications(
    habit.id,
    habit.name,
    getNumber(habit.checkpointTarget, 0),
    nextCheckpointAt,
    'missed',
    true,
    typeof habit.unit === 'string' ? habit.unit : undefined,
    Array.isArray(habit.notificationIds) ? habit.notificationIds : []
  );

  const nextHabit = {
    ...habit,
    attemptedCheckpoints: newAttempted,
    checkpointStatus: 'missed',
    completed: false,
    failed: false,
    notificationIds: reminderIds,
    checkpointAvailableAt: nextCheckpointAt,
    checkpointReminderDeadlineAt: nextCheckpointAt + PROGRESS_REMINDER_WINDOW_MS,
    checkpointResults
  };

  await updateDoc(doc(db, 'habits', habit.id), {
    attemptedCheckpoints: nextHabit.attemptedCheckpoints,
    checkpointStatus: nextHabit.checkpointStatus,
    completed: nextHabit.completed,
    failed: nextHabit.failed,
    notificationIds: nextHabit.notificationIds,
    checkpointAvailableAt: nextHabit.checkpointAvailableAt,
    checkpointReminderDeadlineAt: nextHabit.checkpointReminderDeadlineAt,
    checkpointResults: nextHabit.checkpointResults
  });

  return nextHabit;
}

// Fungsi ini menjadwalkan ulang notifikasi progress habit yang masih pending untuk pengguna tertentu saat sesi dipulihkan.
export async function reschedulePendingProgressHabitsForUser(userId: string) {
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
  const pendingHabits = habitsSnapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as any) }))
    .filter((habit: any) => {
      const checkpointAvailableAt = getNumber(habit.checkpointAvailableAt, 0);
      return (
        habit &&
        !habit.completed &&
        !habit.failed &&
        checkpointAvailableAt > now &&
        checkpointAvailableAt > 0
      );
    });

  await Promise.all(
    pendingHabits.map(async (habit: any) => {
      const checkpointAvailableAt = getNumber(habit.checkpointAvailableAt, 0);
      const checkpointReminderDeadlineAt = getNumber(habit.checkpointReminderDeadlineAt, 0);
      if (!checkpointAvailableAt || !checkpointReminderDeadlineAt || checkpointAvailableAt <= now) {
        return null;
      }

      return scheduleProgressHabitNotifications(
        habit.id,
        habit.name,
        getNumber(habit.checkpointTarget, 0),
        checkpointAvailableAt,
        typeof habit.checkpointStatus === 'string' ? habit.checkpointStatus : 'pending',
        false,
        typeof habit.unit === 'string' ? habit.unit : undefined,
        Array.isArray(habit.notificationIds) ? habit.notificationIds : []
      );
    })
  );
}

// Fungsi ini memeriksa semua habit progress milik pengguna dan mengeksekusi rekonsiliasi jika deadline sudah terlewati.
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
