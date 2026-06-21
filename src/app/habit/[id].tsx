import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressHabitDetail } from '../../components/progress-habit-detail';
import { TimedHabitDetail } from '../../components/timed-habit-detail';
import { db } from '../../services/firebase';

export default function HabitDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [habit, setHabit] = useState<any>(null);

  useEffect(() => {
    let isActive = true;

    async function loadHabit() {
      const habitId = Array.isArray(id) ? id[0] : String(id);
      const snapshot = await getDoc(doc(db, 'habits', habitId));

      if (!isActive || !snapshot.exists()) {
        return;
      }

      setHabit({ id: snapshot.id, ...snapshot.data() });
    }

    void loadHabit();

    return () => {
      isActive = false;
    };
  }, [id]);

  if (!habit) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Memuat detail habit...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Kembali</Text>
      </Pressable>

      {habit.type === 'timed' ? (
        <TimedHabitDetail habit={habit} />
      ) : (
        <ProgressHabitDetail habit={habit} setHabit={setHabit} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F5F7FA'
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
    paddingTop: 20,
    paddingHorizontal: 20
  },
  backText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600'
  }
});