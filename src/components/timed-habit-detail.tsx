import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addUserPoints } from '../services/gamificationService';
import { saveHistory } from '../services/historyService';
import { cancelScheduledNotification, showTimedHabitBackgroundWarning, showTimedHabitFailedNotification } from '../services/notificationService';
import { getStreakBonus, updateUserStreak } from '../services/streakService';
import { getCurrentUserId } from '../services/userService';

type Props = {
  habit: any;
};

export function TimedHabitDetail({ habit }: Props) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const backgroundTime = useRef<number | null>(null);
  const timerNotificationId = useRef<string | null>(null);
  const backgroundWarningShown = useRef(false);

  useEffect(() => {
    setTimeLeft(0);
    setRunning(false);
    backgroundTime.current = null;
    timerNotificationId.current = null;
    backgroundWarningShown.current = false;
  }, [habit?.id]);

  async function startTimer() {
    if (!habit?.duration) return;

    await cancelScheduledNotification(timerNotificationId.current);
    timerNotificationId.current = null;
    backgroundWarningShown.current = false;
    backgroundTime.current = null;
    setTimeLeft(habit.duration * 60);
    setRunning(true);
  }

  useEffect(() => {
    let interval: any;

    if (running && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }

    if (timeLeft === 0 && running) {
      void completeTimedHabit();
    }

    return () => clearInterval(interval);
  }, [running, timeLeft]);

  async function completeTimedHabit() {
    setRunning(false);
    await cancelScheduledNotification(timerNotificationId.current);
    timerNotificationId.current = null;
    backgroundWarningShown.current = false;
    backgroundTime.current = null;

    const nextStreak = await updateUserStreak(getCurrentUserId());
    const streakBonus = getStreakBonus(nextStreak);
    const basePoints = habit.duration * 2;
    const earnedPoints = basePoints + streakBonus;

    await addUserPoints(getCurrentUserId(), earnedPoints, 'timed');
    await saveHistory(getCurrentUserId(), habit.name, habit.type, earnedPoints, 'completed');
    Alert.alert('Selamat!', `Kamu telah menyelesaikan "${habit.name}". Kamu mendapatkan ${basePoints} poin dan bonus streak +${streakBonus} poin.`);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      console.log(`[TimedHabit] AppState changed to: ${state}, running: ${running}`);
      
      if ((state === 'background' || state === 'inactive') && running && habit?.name && !backgroundWarningShown.current) {
        console.log(`[TimedHabit] App going to background with active timer for: ${habit.name}`);
        backgroundTime.current = Date.now();
        backgroundWarningShown.current = true;
        await cancelScheduledNotification(timerNotificationId.current);
        timerNotificationId.current = await showTimedHabitBackgroundWarning(habit.name);
      }

      if (state === 'active' && backgroundTime.current) {
        const diff = (Date.now() - backgroundTime.current) / 1000;
        console.log(`[TimedHabit] App came back to foreground. Time away: ${diff}s, running: ${running}`);
        backgroundTime.current = null;

        if (diff > 30 && running) {
          console.log(`[TimedHabit] Timer failed - app was in background for more than 30 seconds`);
          await failTimedHabit();
          return;
        }

        backgroundWarningShown.current = false;
        await cancelScheduledNotification(timerNotificationId.current);
        timerNotificationId.current = null;
      }
    });

    return () => subscription.remove();
  }, [habit, running]);

  async function failTimedHabit() {
    setRunning(false);
    setTimeLeft(0);
    await cancelScheduledNotification(timerNotificationId.current);
    timerNotificationId.current = null;
    backgroundWarningShown.current = false;
    backgroundTime.current = null;
    await saveHistory(getCurrentUserId(), habit.name, habit.type, 0, 'failed');
    await showTimedHabitFailedNotification(habit.name);
    Alert.alert('Gagal', 'Kamu keluar aplikasi lebih dari 30 detik. Coba lagi.');
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerCard}>
        <Text style={styles.habitName}>{habit.name}</Text>
        <View style={[styles.typeBadge, { backgroundColor: '#4C9A2A' }]}>
          <Text style={styles.badgeText}>{habit.type?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.timedSection}>
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Waktu Tersisa</Text>
          <Text style={styles.timer}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </Text>
          <Text style={styles.durationText}>Target: {habit.duration} menit</Text>
        </View>

        {!running && (
          <Pressable style={styles.startButton} onPress={startTimer}>
            <Text style={styles.startButtonText}>Mulai Timer</Text>
          </Pressable>
        )}

        {running && (
          <View style={styles.runningCard}>
            <Text style={styles.runningText}>Timer sedang berjalan...</Text>
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
  timedSection: {
    gap: 16
  },
  timerCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  timerLabel: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  timer: {
    fontSize: 72,
    fontWeight: '900',
    color: '#2563EB',
    marginVertical: 16
  },
  durationText: {
    color: '#9CA3AF',
    fontSize: 15,
    marginTop: 8
  },
  startButton: {
    backgroundColor: '#4C9A2A',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700'
  },
  runningCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB'
  },
  runningText: {
    color: '#1E40AF',
    fontSize: 16,
    fontWeight: '600'
  }
});
