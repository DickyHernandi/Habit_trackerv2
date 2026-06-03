import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../services/firebase';
import { addUserPoints } from '../services/gamificationService';
import { saveHistory } from '../services/historyService';
import { cancelScheduledNotifications, getProgressNextCheckpointDelayMs, getProgressReminderWindowMs, scheduleProgressHabitNotifications } from '../services/notificationService';
import { getStreakBonus, updateUserStreak } from '../services/streakService';
import { CURRENT_USER_ID } from '../services/userService';

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
  const totalCheckpoint = getTotalCheckpointCount(habitData);
  const checkpointStatus = typeof habitData?.checkpointStatus === 'string' ? habitData.checkpointStatus : 'pending';

  return {
    ...habitData,
    completedCheckpoint: getNumber(habitData?.completedCheckpoint, 0),
    checkpointTarget: getNumber(habitData?.checkpointTarget, 0),
    totalCheckpoint,
    checkpointStatus,
    failed: false,
    notificationIds: Array.isArray(habitData?.notificationIds) ? habitData.notificationIds : [],
    checkpointAvailableAt,
    checkpointReminderDeadlineAt
  };
}

async function persistProgressHabitState(habitId: string, nextHabit: any) {
  await updateDoc(doc(db, 'habits', habitId), {
    completedCheckpoint: getNumber(nextHabit.completedCheckpoint, 0),
    completed: Boolean(nextHabit.completed),
    failed: Boolean(nextHabit.failed),
    checkpointStatus: nextHabit.checkpointStatus,
    notificationIds: Array.isArray(nextHabit.notificationIds) ? nextHabit.notificationIds : [],
    checkpointAvailableAt: nextHabit.checkpointAvailableAt ?? null,
    checkpointReminderDeadlineAt: nextHabit.checkpointReminderDeadlineAt ?? null
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

    if (latestHabit.completedCheckpoint >= getTotalCheckpointCount(latestHabit)) {
      return;
    }

    await cancelScheduledNotifications(latestHabit.notificationIds);

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
      checkpointStatus: 'missed',
      completed: false,
      failed: false,
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs()
    };

    await persistProgressHabitState(latestHabit.id, nextHabit);
    setHabit(nextHabit);

    Alert.alert('Checkpoint missed', 'This checkpoint was missed, but your progress habit is still active.');
  }

  async function confirmCheckpoint() {
    if (!normalizedHabit || normalizedHabit.completed || normalizedHabit.failed) {
      return;
    }

    const checkpointAvailableAt = getNumber(normalizedHabit.checkpointAvailableAt, 0);

    if (Date.now() < checkpointAvailableAt) {
      const remaining = formatCountdown(checkpointAvailableAt - Date.now());
      Alert.alert('Checkpoint is locked', `Next checkpoint will be available in ${remaining}.`);
      return;
    }

    const newCheckpoint = normalizedHabit.completedCheckpoint + 1;
    const totalCheckpoint = getTotalCheckpointCount(normalizedHabit);
    const isCompleted = newCheckpoint >= totalCheckpoint;
    const earnedPoints = 10;

    if (isCompleted) {
      const nextStreak = await updateUserStreak(CURRENT_USER_ID);
      const streakBonus = getStreakBonus(nextStreak);
      const finalEarnedPoints = earnedPoints + streakBonus;

      await cancelScheduledNotifications(normalizedHabit.notificationIds);
      await addUserPoints(CURRENT_USER_ID, finalEarnedPoints);
      await saveHistory(CURRENT_USER_ID, normalizedHabit.name, normalizedHabit.type, finalEarnedPoints, 'completed');

      const nextHabit = {
        ...normalizedHabit,
        completedCheckpoint: newCheckpoint,
        completed: true,
        failed: false,
        checkpointStatus: 'pending',
        notificationIds: [],
        checkpointAvailableAt: null,
        checkpointReminderDeadlineAt: null
      };

      await persistProgressHabitState(normalizedHabit.id, nextHabit);
      setHabit(nextHabit);

      Alert.alert('Berhasil', `Progress Habit selesai +${finalEarnedPoints} poin`);
      return;
    }

    await cancelScheduledNotifications(normalizedHabit.notificationIds);
    await addUserPoints(CURRENT_USER_ID, earnedPoints);
    await saveHistory(CURRENT_USER_ID, normalizedHabit.name, normalizedHabit.type, earnedPoints, 'completed');

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

    await cancelScheduledNotifications(normalizedHabit.notificationIds);

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
      checkpointStatus: 'missed',
      completed: false,
      failed: false,
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs()
    };

    await persistProgressHabitState(normalizedHabit.id, nextHabit);
    setHabit(nextHabit);

    Alert.alert('Checkpoint missed', 'This checkpoint was skipped, but your progress habit is still active.');
  }

  const progressPercent = Math.min(100, ((normalizedHabit.completedCheckpoint ?? 0) / getTotalCheckpointCount(normalizedHabit)) * 100);
  const isCheckpointAvailable = now >= getNumber(normalizedHabit.checkpointAvailableAt, 0);
  const timeUntilCheckpoint = Math.max(0, getNumber(normalizedHabit.checkpointAvailableAt, 0) - now);
  const showMissedNotice = normalizedHabit.checkpointStatus === 'missed' && !isCheckpointAvailable;

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
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressValue}>{normalizedHabit.completedCheckpoint ?? 0} / {getTotalCheckpointCount(normalizedHabit)}</Text>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.targetInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Daily Target:</Text>
              <Text style={styles.infoValue}>{normalizedHabit.target}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Checkpoint:</Text>
              <Text style={styles.infoValue}>{normalizedHabit.completedCheckpoint + 1}</Text>
            </View>
          </View>
        </View>

        {showMissedNotice && (
          <View style={styles.failedCard}>
            <Text style={styles.failedTitle}>Checkpoint missed</Text>
            <Text style={styles.failedSubtitle}>Next checkpoint opens in {formatCountdown(timeUntilCheckpoint)}.</Text>
          </View>
        )}

        {!normalizedHabit.completed && !showMissedNotice && !isCheckpointAvailable && (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Checkpoint is locked</Text>
            <Text style={styles.lockedSubtitle}>Next checkpoint opens in {formatCountdown(timeUntilCheckpoint)}.</Text>
          </View>
        )}

        {!normalizedHabit.completed && !showMissedNotice && isCheckpointAvailable && (
          <View style={styles.questionCard}>
            <Text style={styles.question}>Have you completed {normalizedHabit.checkpointTarget}?</Text>

            <View style={styles.buttonRow}>
              <Pressable style={[styles.actionButton, styles.yesButton]} onPress={confirmCheckpoint}>
                <Text style={styles.buttonText}>Yes</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.noButton]} onPress={rejectCheckpoint}>
                <Text style={styles.buttonText}>No</Text>
              </Pressable>
            </View>
          </View>
        )}

        {normalizedHabit.completed && (
          <View style={styles.completedCard}>
            <Text style={styles.completedTitle}>All Done!</Text>
            <Text style={styles.completedSubtitle}>You've reached all {getTotalCheckpointCount(normalizedHabit)} checkpoints.</Text>
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
  }
});
