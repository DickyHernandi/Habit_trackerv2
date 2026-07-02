import admin, { db } from './firebaseConfig.js';

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
    return [];
  }

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
