import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

type AchievementItem = {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  badgeLabel: string;
};

const achievementCatalog: AchievementItem[] = [
  {
    id: 'First Habit',
    title: 'First Habit',
    description: 'Create your first habit.',
    difficulty: 'easy',
    badgeLabel: 'Starter'
  },
  {
    id: 'First Completion',
    title: 'First Completion',
    description: 'Complete your first habit.',
    difficulty: 'easy',
    badgeLabel: 'Beginner'
  },
  {
    id: 'Checkpoint Beginner',
    title: 'Checkpoint Beginner',
    description: 'Complete the first progress checkpoint.',
    difficulty: 'easy',
    badgeLabel: 'Checkpoint'
  },
  {
    id: 'Timer Starter',
    title: 'Timer Starter',
    description: 'Finish your first timed habit.',
    difficulty: 'easy',
    badgeLabel: 'Timer'
  },
  {
    id: 'Consistency Kickoff',
    title: 'Consistency Kickoff',
    description: 'Complete a habit 3 days in a row.',
    difficulty: 'easy',
    badgeLabel: 'Streak'
  },
  {
    id: 'Habit Builder',
    title: 'Habit Builder',
    description: 'Create 5 habits.',
    difficulty: 'medium',
    badgeLabel: 'Builder'
  },
  {
    id: 'Checkpoint Challenger',
    title: 'Checkpoint Challenger',
    description: 'Complete 5 progress checkpoints.',
    difficulty: 'medium',
    badgeLabel: 'Challenger'
  },
  {
    id: 'Timer Pro',
    title: 'Timer Pro',
    description: 'Complete 3 timed habits.',
    difficulty: 'medium',
    badgeLabel: 'Pro'
  },
  {
    id: 'Week of Wins',
    title: 'Week of Wins',
    description: 'Complete habits for 7 days in a row.',
    difficulty: 'medium',
    badgeLabel: 'Winner'
  },
  {
    id: 'History Hunter',
    title: 'History Hunter',
    description: 'Reach 10 history entries.',
    difficulty: 'medium',
    badgeLabel: 'Historian'
  },
  {
    id: 'Habit Master',
    title: 'Habit Master',
    description: 'Complete 20 habits.',
    difficulty: 'hard',
    badgeLabel: 'Master'
  },
  {
    id: 'Checkpoint Champion',
    title: 'Checkpoint Champion',
    description: 'Complete 20 progress checkpoints.',
    difficulty: 'hard',
    badgeLabel: 'Champion'
  },
  {
    id: 'Streak Legend',
    title: 'Streak Legend',
    description: 'Maintain a 14-day streak.',
    difficulty: 'hard',
    badgeLabel: 'Legend'
  },
  {
    id: 'Badge Collector',
    title: 'Badge Collector',
    description: 'Unlock 10 achievements.',
    difficulty: 'hard',
    badgeLabel: 'Collector'
  },
  {
    id: 'Ultimate Tracker',
    title: 'Ultimate Tracker',
    description: 'Earn 100 points from habits.',
    difficulty: 'hard',
    badgeLabel: 'Ultimate'
  }
];

export default function AchievementsScreen() {
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const userId = useAuthStore(state => state.userId);

  useEffect(() => {
    if (!userId) {
      setEarnedAchievements([]);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', userId), snapshot => {
      const data = snapshot.data();
      setEarnedAchievements(Array.isArray(data?.achievements) ? data.achievements : []);
    });

    return () => unsubscribe();
  }, [userId]);

  const achievements = useMemo(() => achievementCatalog, []);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Achievements</Text>
        <Text style={styles.subtitle}>Track badges, difficulty levels, and earned milestones.</Text>
      </View>

      <FlatList
        data={achievements}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const unlocked = earnedAchievements.includes(item.id);

          return (
            <View style={[styles.card, unlocked && styles.cardUnlocked]}>
              <View style={[styles.badgePlaceholder, unlocked && styles.badgeUnlocked]}>
                <Text style={styles.badgePlaceholderText}>{item.badgeLabel}</Text>
              </View>
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.achievementTitle}>{item.title}</Text>
                  <View style={[styles.difficultyBadge, styles[`difficulty_${item.difficulty}`]]}>
                    <Text style={styles.difficultyText}>{item.difficulty.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={[styles.statusText, unlocked ? styles.unlockedText : styles.lockedText]}>
                  {unlocked ? 'Unlocked' : 'Locked'}
                </Text>
              </View>
            </View>
          );
        }}
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
    marginBottom: 20
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827'
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 15,
    marginTop: 8
  },
  list: {
    paddingBottom: 40
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  cardUnlocked: {
    borderColor: '#4C9A2A',
    borderWidth: 1
  },
  badgePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeUnlocked: {
    backgroundColor: '#D1FAE5'
  },
  badgePlaceholderText: {
    textAlign: 'center',
    color: '#374151',
    fontWeight: '700'
  },
  cardContent: {
    flex: 1
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 10
  },
  difficultyBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  difficulty_easy: {
    backgroundColor: '#D1FAE5'
  },
  difficulty_medium: {
    backgroundColor: '#FEF3C7'
  },
  difficulty_hard: {
    backgroundColor: '#FEE2E2'
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827'
  },
  description: {
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 10
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700'
  },
  unlockedText: {
    color: '#166534'
  },
  lockedText: {
    color: '#6B7280'
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#6B7280'
  }
});
