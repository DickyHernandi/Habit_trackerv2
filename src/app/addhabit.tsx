import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { db } from '../services/firebase';
import {
    getProgressCheckpointDelayMs,
    getProgressReminderWindowMs,
    scheduleProgressHabitNotifications
} from '../services/notificationService';

export default function AddHabitScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState<'timed' | 'progress'>('timed');
  const [duration, setDuration] = useState('');
  const [target, setTarget] = useState('');
  const router = useRouter();

  async function saveHabit() {
    if (!name.trim()) {
      Alert.alert('Oops', 'Please enter a habit name');
      return;
    }

    if (type === 'timed' && !duration.trim()) {
      Alert.alert('Oops', 'Please enter duration in minutes');
      return;
    }

    if (type === 'progress' && !target.trim()) {
      Alert.alert('Oops', 'Please enter a daily target');
      return;
    }

    try {
      const createdAtMs = Date.now();
      const checkpointTarget = type === 'progress' ? Number(target) / 5 : null;
      const progressStartAt = type === 'progress' ? createdAtMs + getProgressCheckpointDelayMs() : null;

      const habitRef = await addDoc(collection(db, 'habits'), {
        name,
        type,
        duration: type === 'timed' ? Number(duration) : null,
        target: type === 'progress' ? Number(target) : null,
        checkpointTarget,
        completedCheckpoint: 0,
        totalCheckpoint: type === 'progress' ? 5 : null,
        completed: false,
        failed: false,
        checkpointStatus: type === 'progress' ? 'pending' : null,
        createdAt: new Date(createdAtMs),
        notificationIds: [],
        checkpointAvailableAt: progressStartAt,
        checkpointReminderDeadlineAt: type === 'progress' && progressStartAt !== null ? progressStartAt + getProgressReminderWindowMs() : null
      });

      if (type === 'progress' && progressStartAt) {
        try {
          await scheduleProgressHabitNotifications(habitRef.id, name, checkpointTarget ?? 0, progressStartAt);
        } catch (notificationError) {
          console.warn('Unable to schedule progress habit notification', notificationError);
        }
      }

      Alert.alert('Success', 'Habit berhasil dibuat');
      router.back();
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Unable to save habit. Please try again.');
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create New Habit</Text>
      <Text style={styles.subtitle}>Set up a habit and keep your momentum going.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Habit Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter habit name"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        <Text style={styles.label}>Habit Type</Text>
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
            <Text style={styles.label}>Duration (minutes)</Text>
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
            <Text style={styles.label}>Daily Target</Text>
            <TextInput
              keyboardType="numeric"
              value={target}
              onChangeText={setTarget}
              placeholder="Target amount"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          </>
        )}

        <Pressable style={styles.submitButton} onPress={saveHabit}>
          <Text style={styles.submitButtonText}>Save Habit</Text>
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