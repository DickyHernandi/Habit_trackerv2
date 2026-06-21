import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { db } from '../../services/firebase';
import { addUserPoints } from '../../services/gamificationService';

export default function HabitDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [habit, setHabit] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const backgroundTime = useRef<number | null>(null);

  useEffect(() => {
    loadHabit();
  }, []);

  async function loadHabit() {
    const snapshot = await getDoc(doc(db, 'habits', String(id)));
    if (snapshot.exists()) {
      setHabit({
        id: snapshot.id,
        ...snapshot.data()
      });
    }
  }

  function startTimer() {
    if (!habit.duration) return;
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
      completeTimedHabit();
    }
    return () => clearInterval(interval);
  }, [running, timeLeft]);

  async function completeTimedHabit() {
    setRunning(false);
    await updateDoc(doc(db, 'habits', habit.id), { completed: true });
    const earnedPoints = habit.duration * 2;
    await addUserPoints('USER_ID_KAMU', earnedPoints);
    Alert.alert('Berhasil', `Timed Habit selesai +${earnedPoints} poin`);
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundTime.current = Date.now();
      }
      if (state === 'active' && backgroundTime.current) {
        const diff = (Date.now() - backgroundTime.current) / 1000;
        if (diff > 30 && running) {
          failTimedHabit();
        }
      }
    });
    return () => subscription.remove();
  }, [running]);

  async function failTimedHabit() {
    setRunning(false);
    setTimeLeft(0);
    Alert.alert('Gagal', 'Kamu keluar aplikasi lebih dari 30 detik');
  }

  async function confirmCheckpoint() {
    const newCheckpoint = (habit.completedCheckpoint ?? 0) + 1;
    const isCompleted = newCheckpoint >= 6;
    await updateDoc(doc(db, 'habits', habit.id), {
      completedCheckpoint: newCheckpoint,
      completed: isCompleted
    });
    await addUserPoints('USER_ID_KAMU', 10);
    setHabit({
      ...habit,
      completedCheckpoint: newCheckpoint,
      completed: isCompleted
    });
    if (isCompleted) {
      Alert.alert('Berhasil', 'Progress Habit selesai');
    }
  }

  function rejectCheckpoint() {
    Alert.alert('Checkpoint gagal', 'Progress tidak bertambah');
  }

  if (!habit) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Memuat detail habit...</Text>
      </View>
    );
  }

  const progressPercent = ((habit.completedCheckpoint ?? 0) / 6) * 100;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.scrollContent}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>← Kembali</Text>
      </Pressable>

      <View style={styles.headerCard}>
        <Text style={styles.habitName}>{habit.name}</Text>
        <View style={[styles.typeBadge, { backgroundColor: habit.type === 'timed' ? '#4C9A2A' : '#2563EB' }]}>
          <Text style={styles.badgeText}>{habit.type?.toUpperCase()}</Text>
        </View>
      </View>

      {habit.type === 'timed' && (
        <View style={styles.timedSection}>
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Waktu Tersisa</Text>
            <Text style={styles.timer}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </Text>
            <Text style={styles.durationText}>Target: {habit.duration} menit</Text>
          </View>

          {!running && !habit.completed && (
            <Pressable style={styles.startButton} onPress={startTimer}>
              <Text style={styles.startButtonText}>Mulai Timer</Text>
            </Pressable>
          )}

          {running && (
            <View style={styles.runningCard}>
              <Text style={styles.runningText}>Timer berjalan...</Text>
            </View>
          )}

          {habit.completed && (
            <View style={styles.completedCard}>
              <Text style={styles.completedTitle}>Selesai!</Text>
              <Text style={styles.completedSubtitle}>Kerja bagus! Kamu telah menyelesaikan habit ini.</Text>
            </View>
          )}
        </View>
      )}

      {habit.type === 'progress' && (
        <View style={styles.progressSection}>
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>Progres</Text>
            <Text style={styles.progressValue}>{habit.completedCheckpoint ?? 0} / 6</Text>

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>

            <View style={styles.targetInfo}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Target Harian:</Text>
                <Text style={styles.infoValue}>{habit.target}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Checkpoint:</Text>
                <Text style={styles.infoValue}>{habit.checkpointTarget}</Text>
              </View>
            </View>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.question}>
              Apakah kamu sudah menyelesaikan {habit.checkpointTarget}?
            </Text>

            {!habit.completed && (
              <View style={styles.buttonRow}>
                <Pressable style={[styles.actionButton, styles.yesButton]} onPress={confirmCheckpoint}>
                  <Text style={styles.buttonText}>Ya</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.noButton]} onPress={rejectCheckpoint}>
                  <Text style={styles.buttonText}>Tidak</Text>
                </Pressable>
              </View>
            )}

            {habit.completed && (
              <View style={styles.completedCard}>
                <Text style={styles.completedTitle}>Selesai!</Text>
                <Text style={styles.completedSubtitle}>Kamu telah mencapai semua 6 checkpoint.</Text>
              </View>
            )}
          </View>
        </View>
      )}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 16
  },
  backButton: {
    marginBottom: 16
  },
  backText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600'
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
  }
});
