import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../services/firebase';
import { addUserPoints } from '../services/gamificationService';
import { saveHistory } from '../services/historyService';
import { cancelScheduledNotifications, getProgressCheckpointDelayMs, getProgressNextCheckpointDelayMs, getProgressReminderWindowMs, scheduleProgressHabitNotifications } from '../services/notificationService';
import { getStreakBonus, updateUserStreak } from '../services/streakService';
import { getCurrentUserId } from '../services/userService';

// Cooldown duration for progress habits (6 minutes for testing, change to 6 hours for production)
const PROGRESS_HABIT_COOLDOWN_MS = 6 * 60 * 1000; // 6 minutes for testing
const TOTAL_PROGRESS_CHECKPOINTS = 5;

type Props = {
  habit: any;
  setHabit: (updater: any) => void;
};

// Fungsi helper untuk mengubah nilai apa pun menjadi angka yang aman dipakai dalam logika habit.
function getNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getTotalCheckpointCount() {
  return TOTAL_PROGRESS_CHECKPOINTS;
}

// Membuat status default checkpoint saat data belum ada atau belum diproses.
function getDefaultCheckpointResults(habitData: any) {
  const completedCheckpoint = getNumber(habitData?.completedCheckpoint, 0);
  const attemptedCheckpoints = getNumber(habitData?.attemptedCheckpoints, 0);

  return Array.from({ length: TOTAL_PROGRESS_CHECKPOINTS }, (_, index) => {
    if (index < completedCheckpoint) {
      return 'passed';
    }

    if (index < attemptedCheckpoints) {
      return 'failed';
    }

    return 'pending';
  });
}

// Menormalkan hasil checkpoint dari Firestore agar bentuk datanya konsisten di seluruh komponen.
function normalizeCheckpointResults(habitData: any) {
  const rawCheckpointResults = Array.isArray(habitData?.checkpointResults)
    ? habitData.checkpointResults
    : [];

  if (rawCheckpointResults.length > 0) {
    return rawCheckpointResults
      .slice(0, TOTAL_PROGRESS_CHECKPOINTS)
      .concat(Array.from({ length: Math.max(0, TOTAL_PROGRESS_CHECKPOINTS - rawCheckpointResults.length) }, () => 'pending'));
  }

  return getDefaultCheckpointResults(habitData);
}

// Memeriksa apakah dalam siklus saat ini ada checkpoint yang sudah berhasil dilewati.
function hasPassedCheckpointInCurrentCycle(habitData: any) {
  const checkpointResults = Array.isArray(habitData?.checkpointResults) && habitData.checkpointResults.length > 0
    ? habitData.checkpointResults
    : getDefaultCheckpointResults(habitData);

  return checkpointResults.some((result: string | undefined) => result === 'passed');
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

function formatProgressTargetText(value: number, unit?: string) {
  if (!Number.isFinite(value)) {
    return '';
  }

  return unit ? `${value} ${unit}` : `${value}`;
}

// Menyusun data habit progress ke format yang lebih mudah dipakai oleh UI dan logika fitur.
function normalizeProgressHabit(habitData: any) {
  const checkpointAvailableAt = Number.isFinite(habitData?.checkpointAvailableAt)
    ? habitData.checkpointAvailableAt
    : null;
  const checkpointReminderDeadlineAt = Number.isFinite(habitData?.checkpointReminderDeadlineAt)
    ? habitData.checkpointReminderDeadlineAt
    : null;
  const completedAt = Number.isFinite(habitData?.completedAt)
    ? habitData.completedAt
    : null;
  const failedAt = Number.isFinite(habitData?.failedAt)
    ? habitData.failedAt
    : null;
  const totalCheckpoint = getTotalCheckpointCount();
  const checkpointStatus = typeof habitData?.checkpointStatus === 'string' ? habitData.checkpointStatus : 'pending';

  return {
    ...habitData,
    completedCheckpoint: getNumber(habitData?.completedCheckpoint, 0),
    attemptedCheckpoints: getNumber(habitData?.attemptedCheckpoints, 0),
    checkpointTarget: getNumber(habitData?.checkpointTarget, 0),
    unit: typeof habitData?.unit === 'string' ? habitData.unit : '',
    totalCheckpoint,
    checkpointStatus,
    notificationIds: Array.isArray(habitData?.notificationIds) ? habitData.notificationIds : [],
    checkpointAvailableAt,
    checkpointReminderDeadlineAt,
    completedAt,
    failedAt,
    checkpointResults: normalizeCheckpointResults(habitData)
  };
}

type CheckpointStepStatus = 'done' | 'failed' | 'current' | 'locked';

// Membuat tampilan visual tiap checkpoint, apakah sudah selesai, gagal, aktif, atau terkunci.
function buildCheckpointSteps(habit: any): CheckpointStepStatus[] {
  const checkpointResults = Array.isArray(habit?.checkpointResults) && habit.checkpointResults.length > 0
    ? habit.checkpointResults
    : getDefaultCheckpointResults(habit);

  const normalizedResults = checkpointResults.map((result: string | undefined) => {
    if (result === 'passed' || result === 'failed') {
      return result;
    }

    return 'pending';
  });

  const currentIndex = normalizedResults.findIndex((result: string) => result === 'pending');

  return normalizedResults.map((result: string, index: number) => {
    if (result === 'passed') {
      return 'done';
    }

    if (result === 'failed') {
      return 'failed';
    }

    if (currentIndex === -1) {
      return 'locked';
    }

    return index === currentIndex ? 'current' : 'locked';
  });
}

// Menandai checkpoint yang sedang aktif dengan hasil passed atau failed.
function applyCheckpointOutcome(habit: any, outcome: 'passed' | 'failed') {
  const currentResults = Array.isArray(habit?.checkpointResults) && habit.checkpointResults.length > 0
    ? [...habit.checkpointResults]
    : getDefaultCheckpointResults(habit);

  const nextIndex = currentResults.findIndex((result: string | undefined) => result === 'pending');
  if (nextIndex === -1) {
    return currentResults;
  }

  currentResults[nextIndex] = outcome;
  return currentResults;
}

// Menyimpan perubahan status habit progress ke Firestore agar data tetap konsisten.
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
    failedAt: nextHabit.failedAt ?? null,
    checkpointResults: Array.isArray(nextHabit.checkpointResults) ? nextHabit.checkpointResults : []
  });
}

// Komponen ini mengatur alur interaktif habit progress: mulai, tunggu checkpoint, jawab ya/tidak, lalu simpan hasilnya.
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

  // Fungsi ini dipanggil ketika checkpoint melewati batas waktu dan dianggap gagal otomatis.
  async function failCurrentProgressCheckpoint() {
    const latestHabit = habitRef.current;

    if (!latestHabit || latestHabit.completed || latestHabit.failed) {
      return;
    }

    if (latestHabit.attemptedCheckpoints >= getTotalCheckpointCount()) {
      return;
    }

    const newAttempted = latestHabit.attemptedCheckpoints + 1;
    const totalCheckpoint = getTotalCheckpointCount();
    const isFinalStage = newAttempted >= totalCheckpoint;
    const checkpointResults = applyCheckpointOutcome(latestHabit, 'failed');
    const hasSuccess = hasPassedCheckpointInCurrentCycle({ ...latestHabit, checkpointResults });

    await cancelScheduledNotifications(latestHabit.notificationIds);

    if (isFinalStage) {
      const nextHabit = {
        ...latestHabit,
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

      await persistProgressHabitState(latestHabit.id, nextHabit);
      setHabit(nextHabit);

      if (hasSuccess) {
        const checkpointPoints = getNumber(latestHabit.completedCheckpoint, 0) * 10;
        const nextStreak = await updateUserStreak(getCurrentUserId());
        const streakBonus = getStreakBonus(nextStreak);
        const finalEarnedPoints = checkpointPoints + streakBonus;

        await addUserPoints(getCurrentUserId(), finalEarnedPoints, 'progress');
        await saveHistory(getCurrentUserId(), latestHabit.name, latestHabit.type, finalEarnedPoints, 'completed');
        Alert.alert('Selesai', `Progress habit selesai dengan ${latestHabit.completedCheckpoint} checkpoint dan mendapatkan poin ${checkpointPoints} + bonus ${streakBonus} poin`);
      } else {
        await saveHistory(getCurrentUserId(), latestHabit.name, latestHabit.type, 0, 'failed');
        Alert.alert('Checkpoint terlewat', 'Semua checkpoint telah dicoba. Habit ini sekarang ditandai gagal.');
      }
      return;
    }

    const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      latestHabit.id,
      latestHabit.name,
      latestHabit.checkpointTarget,
      nextCheckpointAt,
      'pending',
      true,
      latestHabit.unit,
      latestHabit.notificationIds
    );

    const nextHabit = {
      ...latestHabit,
      attemptedCheckpoints: newAttempted,
      checkpointStatus: 'pending',
      completed: false,
      failed: false,
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs(),
      checkpointResults
    };

    await persistProgressHabitState(latestHabit.id, nextHabit);
    setHabit(nextHabit);

    Alert.alert('Gagal', 'Checkpoint ini gagal, tetapi habit progresmu masih aktif.');
  }

  // Fungsi ini dipakai saat pengguna menandai checkpoint sebagai berhasil.
  async function confirmCheckpoint() {
    if (!normalizedHabit || normalizedHabit.completed || normalizedHabit.failed) {
      return;
    }

    const checkpointAvailableAt = normalizedHabit.checkpointAvailableAt;
    if (checkpointAvailableAt !== null && Date.now() < checkpointAvailableAt) {
      const remaining = formatCountdown(checkpointAvailableAt - Date.now());
      Alert.alert('Checkpoint terkunci', `Checkpoint berikutnya akan tersedia dalam ${remaining}.`);
      return;
    }

    const nextCompletedCheckpoint = normalizedHabit.completedCheckpoint + 1;
    const nextAttempted = normalizedHabit.attemptedCheckpoints + 1;
    const totalCheckpoint = getTotalCheckpointCount();
    const isFinalStage = nextAttempted >= totalCheckpoint;
    const checkpointResults = applyCheckpointOutcome(normalizedHabit, 'passed');

    await cancelScheduledNotifications(normalizedHabit.notificationIds);

    if (isFinalStage) {
      const checkpointPoints = nextCompletedCheckpoint * 10;
      const nextStreak = await updateUserStreak(getCurrentUserId());
      const streakBonus = getStreakBonus(nextStreak);
      const finalEarnedPoints = checkpointPoints + streakBonus;

      const nextHabit = {
        ...normalizedHabit,
        completedCheckpoint: nextCompletedCheckpoint,
        attemptedCheckpoints: nextAttempted,
        completed: true,
        failed: false,
        checkpointStatus: 'pending',
        notificationIds: [],
        checkpointAvailableAt: null,
        checkpointReminderDeadlineAt: null,
        completedAt: Date.now(),
        failedAt: null,
        checkpointResults
      };

      await persistProgressHabitState(normalizedHabit.id, nextHabit);
      setHabit(nextHabit);

      await addUserPoints(getCurrentUserId(), finalEarnedPoints, 'progress');
      await saveHistory(getCurrentUserId(), normalizedHabit.name, normalizedHabit.type, finalEarnedPoints, 'completed');

      Alert.alert(
        'Selamat!',
        `Progress habit selesai dengan ${nextCompletedCheckpoint} checkpoint dan mendapatkan poin ${checkpointPoints} + bonus ${streakBonus} poin`
      );
      return;
    }

    const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      normalizedHabit.id,
      normalizedHabit.name,
      normalizedHabit.checkpointTarget,
      nextCheckpointAt,
      'pending',
      true,
      normalizedHabit.unit,
      normalizedHabit.notificationIds
    );

    const nextHabit = {
      ...normalizedHabit,
      completedCheckpoint: nextCompletedCheckpoint,
      attemptedCheckpoints: nextAttempted,
      completed: false,
      failed: false,
      checkpointStatus: 'pending',
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs(),
      checkpointResults
    };

    await persistProgressHabitState(normalizedHabit.id, nextHabit);
    setHabit(nextHabit);
  }

  // Fungsi ini dipakai saat pengguna menandai checkpoint sebagai gagal.
  async function rejectCheckpoint() {
    if (!normalizedHabit || normalizedHabit.completed || normalizedHabit.failed) {
      return;
    }

    const newAttempted = normalizedHabit.attemptedCheckpoints + 1;
    const totalCheckpoint = getTotalCheckpointCount();
    const isFinalStage = newAttempted >= totalCheckpoint;
    const checkpointResults = applyCheckpointOutcome(normalizedHabit, 'failed');
    const hasSuccess = hasPassedCheckpointInCurrentCycle({ ...normalizedHabit, checkpointResults });

    await cancelScheduledNotifications(normalizedHabit.notificationIds);

    if (isFinalStage) {
      const nextHabit = {
        ...normalizedHabit,
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

      await persistProgressHabitState(normalizedHabit.id, nextHabit);
      setHabit(nextHabit);

      if (hasSuccess) {
        const checkpointPoints = getNumber(normalizedHabit.completedCheckpoint, 0) * 10;
        const nextStreak = await updateUserStreak(getCurrentUserId());
        const streakBonus = getStreakBonus(nextStreak);
        const finalEarnedPoints = checkpointPoints + streakBonus;

        await addUserPoints(getCurrentUserId(), finalEarnedPoints, 'progress');
        await saveHistory(getCurrentUserId(), normalizedHabit.name, normalizedHabit.type, finalEarnedPoints, 'completed');
        Alert.alert('Selesai', `Progress habit selesai dengan ${normalizedHabit.completedCheckpoint} checkpoint dan mendapatkan poin ${checkpointPoints} + bonus ${streakBonus} poin`);
      } else {
        await saveHistory(getCurrentUserId(), normalizedHabit.name, normalizedHabit.type, 0, 'failed');
        Alert.alert('Habit gagal', 'Kamu tidak menyelesaikan semua checkpoint pada siklus ini. Habit ini sekarang ditandai gagal.');
      }
      return;
    }

    const nextCheckpointAt = Date.now() + getProgressNextCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      normalizedHabit.id,
      normalizedHabit.name,
      normalizedHabit.checkpointTarget,
      nextCheckpointAt,
      'pending',
      true,
      normalizedHabit.unit,
      normalizedHabit.notificationIds
    );

    const nextHabit = {
      ...normalizedHabit,
      attemptedCheckpoints: newAttempted,
      checkpointStatus: 'pending',
      completed: false,
      failed: false,
      notificationIds: reminderIds,
      checkpointAvailableAt: nextCheckpointAt,
      checkpointReminderDeadlineAt: nextCheckpointAt + getProgressReminderWindowMs(),
      checkpointResults
    };

    await persistProgressHabitState(normalizedHabit.id, nextHabit);
    setHabit(nextHabit);

    Alert.alert('Gagal', 'Checkpoint ini gagal, tetapi habit progresmu masih tetap aktif.');
  }

  const totalCheckpoints = getTotalCheckpointCount();
  const progressPercent = Math.min(100, ((normalizedHabit.attemptedCheckpoints ?? 0) / totalCheckpoints) * 100);
  const checkpointSteps = buildCheckpointSteps(normalizedHabit);
  const checkpointDisplayValue = normalizedHabit.completed
    ? totalCheckpoints
    : Math.min(totalCheckpoints, (normalizedHabit.attemptedCheckpoints ?? 0) + 1);
  const isStarted = normalizedHabit.checkpointAvailableAt !== null && normalizedHabit.checkpointReminderDeadlineAt !== null;
  const isCheckpointAvailable = isStarted && now >= normalizedHabit.checkpointAvailableAt;
  const timeUntilCheckpoint = isStarted ? Math.max(0, normalizedHabit.checkpointAvailableAt - now) : 0;

  const completedAt = normalizedHabit.completedAt ?? 0;
  const failedAt = normalizedHabit.failedAt ?? 0;
  const lastEndTime = completedAt > 0 ? completedAt : failedAt;
  const isInCooldown = lastEndTime > 0 && (now - lastEndTime) < PROGRESS_HABIT_COOLDOWN_MS;
  const timeUntilRestart = Math.max(0, lastEndTime + PROGRESS_HABIT_COOLDOWN_MS - now);

  // Fungsi ini memulai siklus progress habit baru dan mengatur checkpoint pertama.
  async function startProgressHabit() {
    if (!normalizedHabit || normalizedHabit.completed || normalizedHabit.failed) {
      return;
    }

    const nextCheckpointAt = Date.now() + getProgressCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      normalizedHabit.id,
      normalizedHabit.name,
      normalizedHabit.checkpointTarget,
      nextCheckpointAt,
      'pending',
      false,
      normalizedHabit.unit,
      normalizedHabit.notificationIds
    );

    const nextHabit = {
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
      failedAt: null,
      checkpointResults: Array.from({ length: TOTAL_PROGRESS_CHECKPOINTS }, () => 'pending')
    };

    await persistProgressHabitState(normalizedHabit.id, nextHabit);
    setHabit(nextHabit);
    Alert.alert('Berhasil', 'Progress habit dimulai. Checkpoint pertama akan tersedia segera.');
  }

  // Fungsi ini memulai ulang siklus habit setelah selesai atau gagal, agar pengguna bisa mencoba lagi.
  async function resetProgressHabit() {
    const nextCheckpointAt = Date.now() + getProgressCheckpointDelayMs();
    const reminderIds = await scheduleProgressHabitNotifications(
      normalizedHabit.id,
      normalizedHabit.name,
      normalizedHabit.checkpointTarget,
      nextCheckpointAt,
      'pending',
      false,
      normalizedHabit.unit,
      normalizedHabit.notificationIds
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
      failedAt: null,
      checkpointResults: Array.from({ length: TOTAL_PROGRESS_CHECKPOINTS }, () => 'pending')
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
          <Text style={styles.progressValue}>{normalizedHabit.attemptedCheckpoints ?? 0} / {totalCheckpoints}</Text>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.targetInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Target Harian:</Text>
              <Text style={styles.infoValue}>{formatProgressTargetText(normalizedHabit.target, normalizedHabit.unit)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Checkpoint:</Text>
              <Text style={styles.infoValue}>{checkpointDisplayValue} / {totalCheckpoints}</Text>
            </View>
          </View>

          <View style={styles.checkpointRow}>
            {checkpointSteps.map((step, index) => (
              <View key={index} style={[styles.checkpointItem, step === 'done' && styles.checkpointDone, step === 'failed' && styles.checkpointFailed, step === 'current' && styles.checkpointCurrent, step === 'locked' && styles.checkpointLocked]}>
                <Text style={styles.checkpointLabel}>{index + 1}</Text>
              </View>
            ))}
          </View>
        </View>

        {!normalizedHabit.completed && !normalizedHabit.failed && !isStarted && (
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>Progress habit belum dimulai</Text>
            <Text style={styles.startSubtitle}>Tekan tombol mulai untuk memulai checkpoint pertama.</Text>
            <Pressable style={styles.startButton} onPress={startProgressHabit}>
              <Text style={styles.startButtonText}>Mulai Progress</Text>
            </Pressable>
          </View>
        )}

        {!normalizedHabit.completed && !normalizedHabit.failed && isStarted && !isCheckpointAvailable && (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Checkpoint terkunci</Text>
            <Text style={styles.lockedSubtitle}>Checkpoint berikutnya akan terbuka dalam {formatCountdown(timeUntilCheckpoint)}.</Text>
          </View>
        )}

        {!normalizedHabit.completed && !normalizedHabit.failed && isStarted && isCheckpointAvailable && (
          <View style={styles.questionCard}>
            <Text style={styles.question}>Apakah kamu sudah menyelesaikan {formatProgressTargetText(normalizedHabit.checkpointTarget, normalizedHabit.unit)}?</Text>

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
            <Text style={styles.completedSubtitle}>Kamu telah mencapai semua {totalCheckpoints} checkpoint.</Text>
          </View>
        )}

        {normalizedHabit.failed && !normalizedHabit.completed && (
          <View style={styles.failedCard}>
            <Text style={styles.failedTitle}>Habit Gagal</Text>
            <Text style={styles.failedSubtitle}>Siklus progress habit ini berakhir karena checkpoint tidak selesai.</Text>
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
  checkpointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16
  },
  checkpointItem: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkpointLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700'
  },
  checkpointDone: {
    backgroundColor: '#A7F3D0'
  },
  checkpointFailed: {
    backgroundColor: '#FECACA'
  },
  checkpointCurrent: {
    backgroundColor: '#BFDBFE'
  },
  checkpointLocked: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5
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
  startCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center'
  },
  startTitle: {
    color: '#1D4ED8',
    fontSize: 18,
    fontWeight: '800'
  },
  startSubtitle: {
    color: '#1E40AF',
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center'
  },
  startButton: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
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
