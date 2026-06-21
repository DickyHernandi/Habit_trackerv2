import admin, { db } from './firebaseConfig.js';

const USE_PROGRESS_HABIT_TEST_TIMING = true;
const PROGRESS_NEXT_CHECKPOINT_DELAY_MS = USE_PROGRESS_HABIT_TEST_TIMING
  ? 4 * 60 * 1000
  : 4 * 60 * 60 * 1000;
const PROGRESS_REMINDER_AMOUNT = 30;
const PROGRESS_REMINDER_UNIT_MS = USE_PROGRESS_HABIT_TEST_TIMING ? 1000 : 60 * 1000;
const PROGRESS_REMINDER_WINDOW_MS = PROGRESS_REMINDER_AMOUNT * PROGRESS_REMINDER_UNIT_MS;

function getNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

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

    const updatePayload = {
      attemptedCheckpoints: nextAttemptedCheckpoints
    };

    if (nextAttemptedCheckpoints >= totalCheckpoint) {
      Object.assign(updatePayload, {
        completed: true,
        failed: true,
        checkpointStatus: 'pending',
        notificationIds: [],
        checkpointAvailableAt: null,
        checkpointReminderDeadlineAt: null,
        failedAt: admin.firestore.Timestamp.now()
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
