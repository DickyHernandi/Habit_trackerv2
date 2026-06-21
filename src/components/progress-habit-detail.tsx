import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../services/firebase';
import { addUserPoints } from '../services/gamificationService';
import { saveHistory } from '../services/historyService';
import { cancelScheduledNotifications, getProgressNextCheckpointDelayMs, getProgressReminderWindowMs, scheduleProgressHabitNotifications } from '../services/notificationService';
import { getStreakBonus, updateUserStreak } from '../services/streakService';
import { getCurrentUserId } from '../services/userService';

// Cooldown duration for progress habits (6 minutes for testing, change to 6 hours for production)
const PROGRESS_HABIT_COOLDOWN_MS = 6 * 60 * 1000; // 6 minutes for testing

type Props = {
  habit: any;
  setHabit: (updater: any) => void;
};

function getNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getTotalCheckpointCount(habit: any) {
  return Math.max(1, getNumber(habit?.totalCheckpoint, 5));
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function normalizeProgressHabit(habitData: any) {
  const checkpointAvailableAt = getNumber(habitData?.checkpointAvailableAt, 0);
  const checkpointReminderDeadlineAt = getNumber(habitData?.checkpointReminderDeadlineAt, 0);
  const completedAt = getNumber(habitData?.completedAt, 0);
  const failedAt = getNumber(habitData?.failedAt, 0);
  const totalCheckpoint = getTotalCheckpointCount(habitData);
  const checkpointStatus = typeof habitData?.checkpointStatus === 'string' ? habitData.checkpointStatus : 'pending';

  return {
    ...habitData,
    completedCheckpoint: getNumber(habitData?.completedCheckpoint, 0),
    attemptedCheckpoints: getNumber(habitData?.attemptedCheckpoints, 0),
    checkpointTarget: getNumber(habitData?.checkpointTarget, 0),
    totalCheckpoint,
    checkpointStatus,
    failed: false,
    notificationIds: Array.isArray(habitData?.notificationIds) ? habitData.notificationIds : [],
    checkpointAvailableAt,
    checkpointReminderDeadlineAt,
    completedAt,
    failedAt
  };
}

async function persistProgressHabitState(habitId: string, nextHabit: any) {
  await updateDoc(doc(db, 'habits', habitId), {
    completedCheckpoint: getNumber(nextHabit.completedCheckpoint, 0),
    attemptedCheckpoints: getNumber(nextHabit.attemptedCheckpoints, 0),
    completed: Boolean(nextHabit.completed),
    failed: Boolean(nextHabit.failed),
    checkpointStatus: nextHabit.checkpointStatus,
    notificationIds: Array.isArray(nextHabit.notificationIds) ? nextHabit.notificationIds : [],
    checkpointAvailableAt: nextHabit.checkpointAvailableAt ?? null,
    checkpointReminderDeadlineAt: nextHabit.checkpointReminderDeadlineAt ?? null,
    completedAt: nextHabit.completedAt ?? null,
    failedAt: nextHabit.failedAt ?? null
  });
}

export function ProgressHabitDetail({ habit, setHabit }: Props) {
  const normalizedHabit = normalizeProgressHabit(habit);
  const [now, setNow] = useState(Date.now());
  const habitRef = useRef(normalizedHabit);

  useEffect(() => {
    habitRef.current = normalizedHabit;
  }, [normalizedHabit]);

  useEffect(() => {
    if (!normalizedHabit || normalizedHabit.completed || normalizedHabit.failed) {
      return;
    }

    const checkpointAvailableAt = getNumber(normalizedHabit.checkpointAvailableAt, 0);
    const deadlineAt = getNumber(normalizedHabit.checkpointReminderDeadlineAt, 0);

    if (!checkpointAvailableAt || !deadlineAt) {
      return;
    }

    if (Date.now() >= deadlineAt) {
      void failCurrentProgressCheckpoint();
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const timeout = setTimeout(() => {
      void failCurrentProgressCheckpoint();
    }, deadlineAt - Date.now());

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [normalizedHabit]);

  async function failCurrentProgressCheckpoint() {
    const latestHabit = habitRef.current;

    if (!latestHabit || latestHabit.completed || latestHabit.failed) {
      return;
    }

    if (latestHabit.attemptedCheckpoints >= getTotalCheckpointCount(latestHabit)) {
      return;
    }

    const newAttempted = latestHabit.attemptedCheckpoints + 1;
    const totalCheckpoint = getTotalCheckpointCount(latestHabit);
    const isCompleted = newAttempted >= totalCheckpoint;

    await cancelScheduledNotifications(latestHabit.notificationIds);

    if (isCompleted) {
      // All checkpoints have been attempted, mark as completed (failed state)
      const nextHabit = {
        ...latestHabit,
        attemptedCheckpoints: newAttempted,
        completed: true,
        failed: true,
        checkpointStatus: 'pending',
        notificationIds: [],
        checkpointAvailableAt: null,
        checkpointReminderDeadlineAt: null,
        failedAt: Date.now()
      };

      await persistProgressHabitState(latestHabit.id, nextHabit);
      setHabit(nextHabit);

      Alert.alert('Checkpoint terlewat', 'Semua checkpoint telah dicoba. Habit ini sekarang ditandai gagal.');
      return;
    }

    const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      latestHabit.id,
      latestHabit.name,
      latestHabit.checkpointTarget,
      nextCheckpointAt,
      'missed',
      true
    );

    const nextHabit = {
      ...latestHabit,
      attemptedCheckpoints: newAttempted,
      checkpointStatus: 'missed',
      completed: false,
      failed: false,
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs()
    };

    await persistProgressHabitState(latestHabit.id, nextHabit);
    setHabit(nextHabit);

    Alert.alert('Checkpoint terlewat', 'Checkpoint ini terlewat, tetapi habit progresmu masih aktif.');
  }

  async function confirmCheckpoint() {
    if (!normalizedHabit || normalizedHabit.completed || normalizedHabit.failed) {
      return;
    }

    const checkpointAvailableAt = getNumber(normalizedHabit.checkpointAvailableAt, 0);

    if (Date.now() < checkpointAvailableAt) {
      const remaining = formatCountdown(checkpointAvailableAt - Date.now());
      Alert.alert('Checkpoint terkunci', `Checkpoint berikutnya akan tersedia dalam ${remaining}.`);
      return;
    }

    const newCheckpoint = normalizedHabit.completedCheckpoint + 1;
    const newAttempted = normalizedHabit.attemptedCheckpoints + 1;
    const totalCheckpoint = getTotalCheckpointCount(normalizedHabit);
    const isCompleted = newAttempted >= totalCheckpoint;
    const earnedPoints = 10;

    if (isCompleted) {
      const nextStreak = await updateUserStreak(getCurrentUserId());
      const streakBonus = getStreakBonus(nextStreak);
      const baseCheckpointPoints = newCheckpoint * earnedPoints;
      const finalEarnedPoints = baseCheckpointPoints + streakBonus;

      await cancelScheduledNotifications(normalizedHabit.notificationIds);
      await addUserPoints(getCurrentUserId(), finalEarnedPoints);
      await saveHistory(getCurrentUserId(), normalizedHabit.name, normalizedHabit.type, finalEarnedPoints, 'completed');

      const nextHabit = {
        ...normalizedHabit,
        completedCheckpoint: newCheckpoint,
        attemptedCheckpoints: newAttempted,
        completed: true,
        failed: false,
        checkpointStatus: 'pending',
        notificationIds: [],
        checkpointAvailableAt: null,
        checkpointReminderDeadlineAt: null,
        completedAt: Date.now()
      };

      await persistProgressHabitState(normalizedHabit.id, nextHabit);
      setHabit(nextHabit);

      Alert.alert('Selamat!', `Progress Habit selesai! Kamu mendapatkan ${baseCheckpointPoints} poin dan bonus streak +${streakBonus} poin.`);
      return;
    }

    await cancelScheduledNotifications(normalizedHabit.notificationIds);

    const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      normalizedHabit.id,
      normalizedHabit.name,
      normalizedHabit.checkpointTarget,
      nextCheckpointAt,
      'pending',
      true
    );

    const nextHabit = {
      ...normalizedHabit,
      completedCheckpoint: newCheckpoint,
      attemptedCheckpoints: newAttempted,
      completed: false,
      failed: false,
      checkpointStatus: 'pending',
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs()
    };

    await persistProgressHabitState(normalizedHabit.id, nextHabit);
    setHabit(nextHabit);
  }

  async function rejectCheckpoint() {
    if (!normalizedHabit || normalizedHabit.completed || normalizedHabit.failed) {
      return;
    }

    const newAttempted = normalizedHabit.attemptedCheckpoints + 1;
    const totalCheckpoint = getTotalCheckpointCount(normalizedHabit);
    const isCompleted = newAttempted >= totalCheckpoint;

    await cancelScheduledNotifications(normalizedHabit.notificationIds);

    if (isCompleted) {
      // All checkpoints have been attempted, mark as completed (failed state)
      const nextHabit = {
        ...normalizedHabit,
        attemptedCheckpoints: newAttempted,
        completed: true,
        failed: true,
        checkpointStatus: 'pending',
        notificationIds: [],
        checkpointAvailableAt: null,
        checkpointReminderDeadlineAt: null,
        failedAt: Date.now()
      };

      await persistProgressHabitState(normalizedHabit.id, nextHabit);
      setHabit(nextHabit);
      Alert.alert('Habit gagal', 'Semua checkpoint telah dicoba. Habit ini sekarang ditandai gagal.');
      return;
    }

    const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      normalizedHabit.id,
      normalizedHabit.name,
      normalizedHabit.checkpointTarget,
      nextCheckpointAt,
      'missed',
      true
    );

    const nextHabit = {
      ...normalizedHabit,
      attemptedCheckpoints: newAttempted,
      checkpointStatus: 'missed',
      completed: false,
      failed: false,
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs()
    };

    await persistProgressHabitState(normalizedHabit.id, nextHabit);
    setHabit(nextHabit);

    Alert.alert('Checkpoint terlewat', 'Checkpoint ini terlewat, tetapi habit progresmu masih tetap aktif.');
  }

  const progressPercent = Math.min(100, ((normalizedHabit.attemptedCheckpoints ?? 0) / getTotalCheckpointCount(normalizedHabit)) * 100);
  const isCheckpointAvailable = now >= getNumber(normalizedHabit.checkpointAvailableAt, 0);
  const timeUntilCheckpoint = Math.max(0, getNumber(normalizedHabit.checkpointAvailableAt, 0) - now);
  const showMissedNotice = normalizedHabit.checkpointStatus === 'missed' && !isCheckpointAvailable;

  // Cooldown logic
  const completedAt = getNumber(normalizedHabit.completedAt, 0);
  const failedAt = getNumber(normalizedHabit.failedAt, 0);
  const lastEndTime = completedAt > 0 ? completedAt : failedAt;
  const isInCooldown = lastEndTime > 0 && (now - lastEndTime) < PROGRESS_HABIT_COOLDOWN_MS;
  const timeUntilRestart = Math.max(0, lastEndTime + PROGRESS_HABIT_COOLDOWN_MS - now);

  async function resetProgressHabit() {
    const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      normalizedHabit.id,
      normalizedHabit.name,
      normalizedHabit.checkpointTarget,
      nextCheckpointAt,
      'pending',
      true
    );

    const resetHabit = {
      ...normalizedHabit,
      completedCheckpoint: 0,
      attemptedCheckpoints: 0,
      completed: false,
      failed: false,
      checkpointStatus: 'pending',
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs(),
      completedAt: null,
      failedAt: null
    };

    await persistProgressHabitState(normalizedHabit.id, resetHabit);
    setHabit(resetHabit);
    Alert.alert('Berhasil', 'Progress Habit telah direset. Checkpoint baru akan muncul segera.');
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerCard}>
        <Text style={styles.habitName}>{normalizedHabit.name}</Text>
        <View style={[styles.typeBadge, { backgroundColor: '#2563EB' }]}>
          <Text style={styles.badgeText}>{normalizedHabit.type?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Progres</Text>
          <Text style={styles.progressValue}>{normalizedHabit.attemptedCheckpoints ?? 0} / {getTotalCheckpointCount(normalizedHabit)}</Text>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.targetInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Target Harian:</Text>
              <Text style={styles.infoValue}>{normalizedHabit.target}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Checkpoint:</Text>
              <Text style={styles.infoValue}>{normalizedHabit.attemptedCheckpoints + 1}</Text>
            </View>
          </View>
        </View>

        {showMissedNotice && (
          <View style={styles.failedCard}>
            <Text style={styles.failedTitle}>Checkpoint terlewat</Text>
            <Text style={styles.failedSubtitle}>Checkpoint berikutnya akan terbuka dalam {formatCountdown(timeUntilCheckpoint)}.</Text>
          </View>
        )}

        {!normalizedHabit.completed && !showMissedNotice && !isCheckpointAvailable && (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Checkpoint terkunci</Text>
            <Text style={styles.lockedSubtitle}>Checkpoint berikutnya akan terbuka dalam {formatCountdown(timeUntilCheckpoint)}.</Text>
          </View>
        )}

        {!normalizedHabit.completed && !showMissedNotice && isCheckpointAvailable && (
          <View style={styles.questionCard}>
            <Text style={styles.question}>Apakah kamu sudah menyelesaikan {normalizedHabit.checkpointTarget}?</Text>

            <View style={styles.buttonRow}>
              <Pressable style={[styles.actionButton, styles.yesButton]} onPress={confirmCheckpoint}>
                <Text style={styles.buttonText}>Ya</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.noButton]} onPress={rejectCheckpoint}>
                <Text style={styles.buttonText}>Tidak</Text>
              </Pressable>
            </View>
          </View>
        )}

        {normalizedHabit.completed && (
          <View style={styles.completedCard}>
            <Text style={styles.completedTitle}>Selesai!</Text>
            <Text style={styles.completedSubtitle}>Kamu telah mencapai semua {getTotalCheckpointCount(normalizedHabit)} checkpoint.</Text>
          </View>
        )}

        {(normalizedHabit.completed || normalizedHabit.failed) && isInCooldown && (
          <View style={styles.cooldownCard}>
            <Text style={styles.cooldownTitle}>Sedang Cooldown</Text>
            <Text style={styles.cooldownSubtitle}>Kesempatan berikutnya tersedia dalam {formatCountdown(timeUntilRestart)}</Text>
          </View>
        )}

        {(normalizedHabit.completed || normalizedHabit.failed) && !isInCooldown && lastEndTime > 0 && (
          <View style={styles.readyCard}>
            <Text style={styles.readyTitle}>Siap untuk Dilanjutkan!</Text>
            <Text style={styles.readySubtitle}>Kamu bisa memulai habit ini lagi.</Text>
            <Pressable style={styles.resetButton} onPress={resetProgressHabit}>
              <Text style={styles.resetButtonText}>Mulai Siklus Baru</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F7FA'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  headerCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  habitName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    flex: 1
  },
  typeBadge: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 12
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700'
  },
  progressSection: {
    gap: 16
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  progressLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  progressValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
    marginBottom: 20
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 24
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 999
  },
  targetInfo: {
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6'
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 14
  },
  infoValue: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600'
  },
  questionCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  question: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    lineHeight: 28
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  yesButton: {
    backgroundColor: '#4C9A2A'
  },
  noButton: {
    backgroundColor: '#F87171'
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700'
  },
  lockedCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 20,
    padding: 18
  },
  lockedTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800'
  },
  lockedSubtitle: {
    color: '#0F172A',
    marginTop: 6,
    fontSize: 14
  },
  failedCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
    padding: 18
  },
  failedTitle: {
    color: '#991B1B',
    fontSize: 18,
    fontWeight: '800'
  },
  failedSubtitle: {
    color: '#991B1B',
    marginTop: 6,
    fontSize: 14
  },
  completedCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A'
  },
  completedTitle: {
    color: '#15803D',
    fontSize: 18,
    fontWeight: '700'
  },
  completedSubtitle: {
    color: '#22C55E',
    fontSize: 14,
    marginTop: 4
  },
  cooldownCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B'
  },
  cooldownTitle: {
    color: '#92400E',
    fontSize: 18,
    fontWeight: '700'
  },
  cooldownSubtitle: {
    color: '#B45309',
    fontSize: 14,
    marginTop: 4
  },
  readyCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6'
  },
  readyTitle: {
    color: '#1E40AF',
    fontSize: 18,
    fontWeight: '700'
  },
  readySubtitle: {
    color: '#2563EB',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16
  },
  resetButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
  }
});
