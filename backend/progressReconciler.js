import Expo from 'expo-server-sdk';
import admin, { db } from './firebaseConfig.js';

const expo = new Expo();

// Backend ini bertanggung jawab mengirim notifikasi push ke Expo dan merekonsiliasi
// habit progress yang terlewat agar status habit tetap konsisten.

// Fungsi ini dipanggil setelah sistem memutuskan apakah habit progres dianggap berhasil atau gagal.
// Jika berhasil, poin dan statistik pengguna akan ditambah; jika gagal, data akan dicatat ke history sebagai kegagalan.
async function finalizeProgressHabitCompletion(habit, hasSuccess) {
  if (!habit?.userId) {
    return;
  }

  const historyPayload = {
    userId: habit.userId,
    habitName: habit.name,
    habitType: habit.type,
    points: 0,
    status: 'failed',
    completedAt: admin.firestore.Timestamp.now()
  };

  if (!hasSuccess) {
    await db.collection('history').add(historyPayload);
    return;
  }

  const earnedPoints = getNumber(habit?.completedCheckpoint, 0) * 10;

  await db.collection('users').doc(habit.userId).update({
    points: admin.firestore.FieldValue.increment(earnedPoints),
    completedHabits: admin.firestore.FieldValue.increment(1),
    completedCheckpoints: admin.firestore.FieldValue.increment(1)
  });

  await db.collection('history').add({
    ...historyPayload,
    points: earnedPoints,
    status: 'completed'
  });
}

async function getUserPushTokens(userId) {
  if (!userId) {
    return [];
  }

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    console.warn('[Backend] getUserPushTokens: user not found', { userId });
    return [];
  }

  const userData = userDoc.data();
  const pushTokens = Array.isArray(userData?.pushTokens) ? userData.pushTokens : [];
  console.log('[Backend] getUserPushTokens', { userId, pushTokensCount: pushTokens.length });
  return pushTokens;
}

// Hapus token Expo yang sudah tidak valid dari Firestore.
// Ini mencegah backend menyimpan token lama dan mencoba mengirim notifikasi ke device yang sudah tidak terdaftar lagi.
async function removeInvalidUserPushTokens(userId, invalidTokens) {
  if (!userId || !Array.isArray(invalidTokens) || invalidTokens.length === 0) {
    return;
  }

  console.log('[Backend] removeInvalidUserPushTokens: menghapus token invalid dari user', { userId, invalidTokens });
  await db.collection('users').doc(userId).update({
    pushTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
  });
}

async function sendPushNotificationToUser(userId, title, body, data = {}) {
  const tokens = await getUserPushTokens(userId);
  console.log('[Backend] sendPushNotificationToUser', { userId, title, body, tokenCount: tokens.length });
  if (!tokens.length) {
    console.log('[Backend] sendPushNotificationToUser: no push tokens available', { userId });
    return;
  }

  const messages = tokens.reduce((acc, token) => {
    if (!Expo.isExpoPushToken(token)) {
      console.warn('[Backend] sendPushNotificationToUser: skipping invalid Expo token', token);
      return acc;
    }

    acc.push({
      to: token,
      sound: 'default',
      title,
      body,
      data: {
        ...data,
        userId: String(userId)
      }
    });

    return acc;
  }, []);

  if (messages.length === 0) {
    return;
  }

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log('[Backend] sendPushNotificationToUser: send chunk result', { tickets });

      const invalidTokens = [];
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error') {
          const token = chunk[index]?.to;
          console.warn('[Backend] Expo push ticket error', ticket.details, token);

          const errorCode = ticket.details?.error;
          if (token && ['DeviceNotRegistered', 'InvalidCredentials', 'MessageTooBig', 'InvalidRegistration', 'Unregistered'].includes(errorCode)) {
            invalidTokens.push(token);
          }
        }
      });

      if (invalidTokens.length > 0) {
        console.log('[Backend] sendPushNotificationToUser: found invalid tokens, cleaning up', { userId, invalidTokens });
        await removeInvalidUserPushTokens(userId, invalidTokens);
      }
    } catch (error) {
      console.error('[Backend] Unable to send push notification via Expo', error);
    }
  }
}

export async function sendPendingProgressReminderNotifications() {
  const now = Date.now();
  console.log('[Backend] sendPendingProgressReminderNotifications: checking habits at', now);
  const snapshot = await db.collection('habits')
    .where('type', '==', 'progress')
    .where('completed', '==', false)
    .where('failed', '==', false)
    .where('checkpointAvailableAt', '<=', now)
    .where('checkpointReminderDeadlineAt', '>', now)
    .get();

  const promises = [];
  snapshot.docs.forEach((docSnap) => {
    const habit = { id: docSnap.id, ...(docSnap.data() || {}) };
    console.log('[Backend] sendPendingProgressReminderNotifications habit available', {
      habitId: habit.id,
      userId: habit.userId,
      checkpointAvailableAt: habit.checkpointAvailableAt,
      checkpointReminderDeadlineAt: habit.checkpointReminderDeadlineAt
    });
    const lastSentAt = getNumber(habit.progressNotificationSentAt, 0);
    console.log('[Backend] sendPendingProgressReminderNotifications habit', {
      habitId: habit.id,
      userId: habit.userId,
      checkpointAvailableAt: habit.checkpointAvailableAt,
      checkpointReminderDeadlineAt: habit.checkpointReminderDeadlineAt,
      progressNotificationSentAt: lastSentAt
    });

    if (lastSentAt >= getNumber(habit.checkpointAvailableAt, 0)) {
      console.log('[Backend] sendPendingProgressReminderNotifications: already sent notification for habit', {
        habitId: habit.id,
        lastSentAt,
        checkpointAvailableAt: habit.checkpointAvailableAt
      });
      return;
    }

    promises.push((async () => {
      await sendPushNotificationToUser(
        habit.userId,
        'Checkpoint tersedia',
        `Checkpoint untuk ${habit.name} sudah tersedia. Buka aplikasi untuk mengonfirmasi.`,
        { habitId: habit.id, type: 'progress-available' }
      );

      await db.collection('habits').doc(habit.id).update({
        progressNotificationSentAt: Date.now()
      });
    })());
  });

  await Promise.all(promises);
}

const USE_PROGRESS_HABIT_TEST_TIMING = true;
const PROGRESS_NEXT_CHECKPOINT_DELAY_MS = USE_PROGRESS_HABIT_TEST_TIMING
  ? 4 * 60 * 1000
  : 4 * 60 * 60 * 1000;
const PROGRESS_REMINDER_AMOUNT = 30;
const PROGRESS_REMINDER_UNIT_MS = USE_PROGRESS_HABIT_TEST_TIMING ? 1000 : 60 * 1000;
const PROGRESS_REMINDER_WINDOW_MS = PROGRESS_REMINDER_AMOUNT * PROGRESS_REMINDER_UNIT_MS;

// Fungsi helper ini memastikan nilai yang dibaca dari Firestore selalu bisa diubah menjadi angka.
// Jika datanya bukan angka, sistem akan memakai nilai fallback agar aplikasi tidak error.
function getNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

// Fungsi ini membangun status setiap checkpoint berdasarkan data habit saat ini.
// Hasilnya dipakai untuk mengetahui checkpoint mana yang sudah lewat, mana yang gagal, dan mana yang masih menunggu.
function buildCheckpointResults(habit) {
  const completedCheckpoint = getNumber(habit?.completedCheckpoint, 0);
  const attemptedCheckpoints = getNumber(habit?.attemptedCheckpoints, 0);
  const totalCheckpoint = Math.max(1, getNumber(habit?.totalCheckpoint, 5));

  if (Array.isArray(habit?.checkpointResults) && habit.checkpointResults.length > 0) {
    return habit.checkpointResults
      .slice(0, totalCheckpoint)
      .concat(Array.from({ length: Math.max(0, totalCheckpoint - habit.checkpointResults.length) }, () => 'pending'));
  }

  return Array.from({ length: totalCheckpoint }, (_, index) => {
    if (index < completedCheckpoint) {
      return 'passed';
    }

    if (index < attemptedCheckpoints) {
      return 'failed';
    }

    return 'pending';
  });
}

// Fungsi ini menandai checkpoint berikutnya sebagai gagal ketika habit melewati batas waktu.
// Biasanya dipanggil saat sistem mendeteksi habit progres yang tidak diselesaikan tepat waktu.
function markNextCheckpointFailed(habit) {
  const checkpointResults = buildCheckpointResults(habit);
  const nextIndex = checkpointResults.findIndex((result) => result === 'pending');

  if (nextIndex !== -1) {
    checkpointResults[nextIndex] = 'failed';
  }

  return checkpointResults;
}

// Fungsi ini memeriksa apakah dalam siklus saat ini ada checkpoint yang berhasil dilewati.
// Informasi ini penting untuk menentukan apakah habit akhirnya dianggap berhasil atau gagal.
function hasPassedCheckpointInCurrentCycle(habit) {
  return buildCheckpointResults(habit).some((result) => result === 'passed');
}

// Fungsi utama ini memeriksa habit bertipe progress yang sudah melewati deadline checkpoint.
// Saat ditemukan, sistem akan meng-update status habit, menandai checkpoint yang terlewat, dan mencatat hasil akhir ke database.
export async function reconcileMissedProgressHabits({ userId } = {}) {
  const now = Date.now();
  console.log('[Backend] reconcileMissedProgressHabits: start', { userId, now });
  let query = db.collection('habits')
    .where('type', '==', 'progress')
    .where('completed', '==', false)
    .where('failed', '==', false)
    .where('checkpointReminderDeadlineAt', '<=', now);

  if (userId) {
    query = query.where('userId', '==', userId);
  }

  const snapshot = await query.get();
  if (snapshot.empty) {
    console.log('[Backend] reconcileMissedProgressHabits: tidak ada habit terlewat');
    return [];
  }

  console.log('[Backend] reconcileMissedProgressHabits: habits found', snapshot.size);
  const updates = [];

  for (const document of snapshot.docs) {
    const habit = { id: document.id, ...(document.data() || {}) };
    const attemptedCheckpoints = getNumber(habit.attemptedCheckpoints, 0);
    const totalCheckpoint = Math.max(1, getNumber(habit.totalCheckpoint, 5));
    const nextAttemptedCheckpoints = attemptedCheckpoints + 1;
    const checkpointResults = markNextCheckpointFailed(habit);
    const hasSuccess = hasPassedCheckpointInCurrentCycle({ ...habit, checkpointResults });

    const updatePayload = {
      attemptedCheckpoints: nextAttemptedCheckpoints,
      checkpointResults
    };

    if (nextAttemptedCheckpoints >= totalCheckpoint) {
      Object.assign(updatePayload, {
        completed: hasSuccess,
        failed: !hasSuccess,
        checkpointStatus: hasSuccess ? 'pending' : 'failed',
        notificationIds: [],
        checkpointAvailableAt: null,
        checkpointReminderDeadlineAt: null,
        completedAt: hasSuccess ? admin.firestore.Timestamp.now() : null,
        failedAt: !hasSuccess ? admin.firestore.Timestamp.now() : null
      });
    } else {
      const nextCheckpointAt = now + PROGRESS_NEXT_CHECKPOINT_DELAY_MS;
      Object.assign(updatePayload, {
        checkpointStatus: 'missed',
        notificationIds: [],
        checkpointAvailableAt: nextCheckpointAt,
        checkpointReminderDeadlineAt: nextCheckpointAt + PROGRESS_REMINDER_WINDOW_MS
      });
    }

    await db.collection('habits').doc(habit.id).update(updatePayload);
    await finalizeProgressHabitCompletion(habit, hasSuccess);

    if (nextAttemptedCheckpoints < totalCheckpoint) {
      await sendPushNotificationToUser(
        habit.userId,
        'Checkpoint gagal',
        `Checkpoint untuk ${habit.name} terlewat. Checkpoint berikutnya akan dijadwalkan otomatis.`,
        { habitId: habit.id, type: 'progress-failure' }
      );
    }

    updates.push({
      id: habit.id,
      nextAttemptedCheckpoints,
      completed: Boolean(updatePayload.completed),
      failed: Boolean(updatePayload.failed),
      checkpointStatus: updatePayload.checkpointStatus
    });
  }

  return updates;
}
