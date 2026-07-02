import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../services/firebase';
import { checkHabitCountAchievements } from '../services/gamificationService';
import { getCurrentUserId } from '../services/userService';

const TOTAL_PROGRESS_CHECKPOINTS = 5;

// Layar ini digunakan untuk membuat habit baru, baik jenis timed maupun progress.
export default function AddHabitScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState<'timed' | 'progress'>('timed');
  const [duration, setDuration] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const router = useRouter();

  // Fungsi ini mengumpulkan input pengguna, menyimpan habit ke Firestore, lalu memberi feedback hasil penyimpanan.
  async function saveHabit() {
    if (!name.trim()) {
      Alert.alert('Kesalahan', 'Silakan masukkan nama habit');
      return;
    }

    if (type === 'timed' && !duration.trim()) {
      Alert.alert('Kesalahan', 'Silakan masukkan durasi dalam menit');
      return;
    }

    if (type === 'progress' && !target.trim()) {
      Alert.alert('Kesalahan', 'Silakan masukkan target harian');
      return;
    }

    if (type === 'progress' && !unit.trim()) {
      Alert.alert('Kesalahan', 'Silakan masukkan satuan target');
      return;
    }

    try {
      const createdAtMs = Date.now();
      const userId = getCurrentUserId();
      const checkpointTarget = type === 'progress' ? Number(target) / TOTAL_PROGRESS_CHECKPOINTS : null;

      const habitRef = await addDoc(collection(db, 'habits'), {
        userId,
        name,
        type,
        duration: type === 'timed' ? Number(duration) : null,
        target: type === 'progress' ? Number(target) : null,
        unit: type === 'progress' ? unit.trim() : null,
        checkpointTarget,
        completedCheckpoint: 0,
        attemptedCheckpoints: 0,
        totalCheckpoint: type === 'progress' ? TOTAL_PROGRESS_CHECKPOINTS : null,
        completed: false,
        failed: false,
        checkpointStatus: type === 'progress' ? 'pending' : null,
        createdAt: new Date(createdAtMs),
        notificationIds: [],
        checkpointAvailableAt: null,
        checkpointReminderDeadlineAt: null,
        completedAt: null,
        failedAt: null
      });

      await checkHabitCountAchievements(userId, 1, type);

      Alert.alert('Berhasil', 'Habit berhasil dibuat');
      router.back();
    } catch (error) {
      console.log(error);
      Alert.alert('Kesalahan', 'Gagal menyimpan habit. Silakan coba lagi.');
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Buat Habit Baru</Text>
      <Text style={styles.subtitle}>Atur kebiasaan dan pertahankan momentummu.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nama Habit</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Masukkan nama habit"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        <Text style={styles.label}>Jenis Habit</Text>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setType('timed')}
            style={[styles.toggleButton, type === 'timed' && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, type === 'timed' && styles.toggleTextActive]}>Timed</Text>
          </Pressable>
          <Pressable
            onPress={() => setType('progress')}
            style={[styles.toggleButton, type === 'progress' && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, type === 'progress' && styles.toggleTextActive]}>Progress</Text>
          </Pressable>
        </View>

        {type === 'timed' ? (
          <>
            <Text style={styles.label}>Durasi (menit)</Text>
            <TextInput
              keyboardType="numeric"
              value={duration}
              onChangeText={setDuration}
              placeholder="30"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Target Harian</Text>
            <TextInput
              keyboardType="numeric"
              value={target}
              onChangeText={setTarget}
              placeholder="Masukkan target"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
            <Text style={styles.label}>Satuan Target</Text>
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="contoh: halaman, km, kali"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          </>
        )}

        <Pressable style={styles.submitButton} onPress={saveHabit}>
          <Text style={styles.submitButtonText}>Simpan Habit</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F3F6FB'
  },
  content: {
    padding: 24,
    paddingBottom: 40
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
    marginBottom: 24
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4
  },
  label: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20
  },
  toggleButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  toggleButtonActive: {
    backgroundColor: '#2563EB'
  },
  toggleText: {
    color: '#4B5563',
    fontWeight: '700'
  },
  toggleTextActive: {
    color: 'white'
  },
  submitButton: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700'
  }
});