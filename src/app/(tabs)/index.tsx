import { router } from 'expo-router';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/useAuthStore';

const TYPE_COLOR: Record<string, string> = {
  timed: '#4C9A2A',
  progress: '#2563EB'
};

// Cooldown duration for progress habits (6 minutes for testing, change to 6 hours for production)
const PROGRESS_HABIT_COOLDOWN_MS = 6 * 60 * 1000; // 6 minutes for testing

export default function HomeScreen() {
  const [habits, setHabits] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const userId = useAuthStore(state => state.userId);

  useEffect(() => {
    if (!userId) {
      setHabits([]);
      return;
    }

    const q = query(
      collection(db, 'habits'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setHabits(data);
    });

    return () => unsub();
  }, [userId]);

  // Update current time for cooldown calculations
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const completedCount = useMemo(
    () => habits.filter(habit => habit.type === 'progress' && habit.completed).length,
    [habits]
  );

  const progressPercent = habits.length ? Math.round((completedCount / habits.length) * 100) : 0;

  const getHabitStatus = (habit: any) => {
    if (habit.type !== 'progress') {
      return 'Aktif';
    }

    const completedAt = Number(habit?.completedAt) || 0;
    const failedAt = Number(habit?.failedAt) || 0;
    const lastEndTime = completedAt > 0 ? completedAt : failedAt;

    if (lastEndTime > 0 && (now - lastEndTime) < PROGRESS_HABIT_COOLDOWN_MS) {
      return 'Cooldown';
    }

    return habit.completed || habit.failed ? 'Siap' : 'Aktif';
  };

  const isHabitCompleted = (habit: any) => habit.type === 'progress' && Boolean(habit.completed);

  return (
    <View style={styles.page}>
      <View style={styles.heroCard}>
        <View style={styles.heroContent}>
          <Text style={styles.title}>Perjalanan Habitmu</Text>
          <Text style={styles.subtitle}>Tetap konsisten, bangun momentum, dan lacak progres dengan mudah.</Text>
        </View>
        <Pressable style={styles.actionButton} onPress={() => router.push('/addhabit')}>
          <Text style={styles.actionButtonText}>Habit Baru</Text>
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Jumlah</Text>
          <Text style={styles.statValue}>{habits.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Selesai</Text>
          <Text style={styles.statValue}>{completedCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Progres</Text>
          <Text style={styles.statValue}>{progressPercent}%</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Habit Saya</Text>
        <Text style={styles.sectionSubtitle}>{habits.length} Habit Terpantau</Text>
      </View>

      <FlatList
        data={habits}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/habit/${item.id}`)} style={styles.habitCard}>
            <View style={styles.habitHeader}>
              <Text style={styles.habitName}>{item.name}</Text>
              <View style={[styles.typeBadge, { backgroundColor: TYPE_COLOR[item.type] ?? '#777' }]}>
                <Text style={styles.typeBadgeText}>{item.type?.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.habitText}>Dibuat: {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : ''}</Text>
            {item.duration ? <Text style={styles.habitText}>Durasi: {item.duration} menit</Text> : null}
            {item.target ? <Text style={styles.habitText}>Target: {item.target}{item.unit ? ` ${item.unit}` : ''}</Text> : null}

            <View style={styles.cardFooter}>
              <Text style={styles.completionText}>{getHabitStatus(item)}</Text>
              <Pressable onPress={() => deleteDoc(doc(db, 'habits', item.id))} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Hapus</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Belum ada habit</Text>
            <Text style={styles.emptyText}>Buat habit pertamamu dan mulai bangun konsistensi.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    padding: 20
  },
  heroCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  heroContent: {
    flex: 1,
    marginRight: 16
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 260
  },
  actionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '700'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 12,
    marginBottom: 22
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase'
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827'
  },
  sectionSubtitle: {
    color: '#6B7280'
  },
  listContent: {
    paddingBottom: 50
  },
  habitCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  habitName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 10
  },
  typeBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  typeBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700'
  },
  habitText: {
    color: '#374151',
    marginBottom: 6
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14
  },
  completionText: {
    color: '#16A34A',
    fontWeight: '700'
  },
  deleteButton: {
    backgroundColor: '#F87171',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: '700'
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center'
  }
});
