import { db } from '@/services/firebase';
import { CURRENT_USER_ID } from '@/services/userService';
import { Link } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

export default function AchievementsScreen() {
  const [achievements, setAchievements] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', CURRENT_USER_ID), snapshot => {
      const data = snapshot.data();
      setAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Achievements</Text>
          <Text style={styles.subtitle}>Your earned milestones and progress badges.</Text>
        </View>
        <Link href="/profile" asChild>
          <Pressable style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={achievements}
        keyExtractor={item => item}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.achievementCard}>
            <Text style={styles.achievementTitle}>{item}</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No achievements unlocked yet.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    padding: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827'
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 15,
    marginTop: 6,
    maxWidth: '70%'
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#2563EB',
    borderRadius: 14
  },
  backText: {
    color: 'white',
    fontWeight: '700'
  },
  list: {
    paddingBottom: 40
  },
  achievementCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#6B7280'
  }
});
