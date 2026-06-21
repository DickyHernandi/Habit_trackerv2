import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';

type AchievementItem = {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  badgeLabel: string;
  badgeImage: number;
};

const badgeImages = {
  firstHabit: require('@/assets/images/achievementBadge/firstHabit.png'),
  firstCompletion: require('@/assets/images/achievementBadge/firstCompletion.png'),
  checkpointBeginner: require('@/assets/images/achievementBadge/checkpointBeginner.png'),
  timerStarter: require('@/assets/images/achievementBadge/timerStarter.png'),
  consistencyKickoff: require('@/assets/images/achievementBadge/consistencyKickoff.png'),
  habitBuilder: require('@/assets/images/achievementBadge/habitBuilder.png'),
  checkpointChallenger: require('@/assets/images/achievementBadge/checkpointChallenger.png'),
  timerPro: require('@/assets/images/achievementBadge/timerPro.png'),
  weekOfWins: require('@/assets/images/achievementBadge/weekOfWins.png'),
  historyHunter: require('@/assets/images/achievementBadge/historyHunter.png'),
  habitMaster: require('@/assets/images/achievementBadge/habitMaster.png'),
  checkpointChampion: require('@/assets/images/achievementBadge/checkpointChampion.png'),
  streakLegend: require('@/assets/images/achievementBadge/streakLegend.png'),
  badgeCollector: require('@/assets/images/achievementBadge/badgeCollector.png'),
  ultimateTracker: require('@/assets/images/achievementBadge/ultimateTracker.png')
};

const achievementCatalog: AchievementItem[] = [
  {
    id: 'First Habit',
    title: 'Habit Pertama',
    description: 'Buat habit pertamamu.',
    difficulty: 'easy',
    badgeLabel: 'Pemula',
    badgeImage: badgeImages.firstHabit
  },
  {
    id: 'First Completion',
    title: 'Selesai Pertama',
    description: 'Selesaikan habit pertamamu.',
    difficulty: 'easy',
    badgeLabel: 'Pemula',
    badgeImage: badgeImages.firstCompletion
  },
  {
    id: 'Checkpoint Beginner',
    title: 'Checkpoint Pertama',
    description: 'Selesaikan checkpoint progress pertama.',
    difficulty: 'easy',
    badgeLabel: 'Checkpoint',
    badgeImage: badgeImages.checkpointBeginner
  },
  {
    id: 'Timer Starter',
    title: 'Pengguna Timer',
    description: 'Selesaikan timed habit pertamamu.',
    difficulty: 'easy',
    badgeLabel: 'Timer',
    badgeImage: badgeImages.timerStarter
  },
  {
    id: 'Consistency Kickoff',
    title: 'Konsistensi Awal',
    description: 'Selesaikan habit 3 hari berturut-turut.',
    difficulty: 'easy',
    badgeLabel: 'Streak',
    badgeImage: badgeImages.consistencyKickoff
  },
  {
    id: 'Habit Builder',
    title: 'Pembuat Habit',
    description: 'Buat 5 habit.',
    difficulty: 'medium',
    badgeLabel: 'Builder',
    badgeImage: badgeImages.habitBuilder
  },
  {
    id: 'Checkpoint Challenger',
    title: 'Tantangan Checkpoint',
    description: 'Selesaikan 5 checkpoint progress.',
    difficulty: 'medium',
    badgeLabel: 'Challenger',
    badgeImage: badgeImages.checkpointChallenger
  },
  {
    id: 'Timer Pro',
    title: 'Ahli Timer',
    description: 'Selesaikan 3 timed habit.',
    difficulty: 'medium',
    badgeLabel: 'Pro',
    badgeImage: badgeImages.timerPro
  },
  {
    id: 'Week of Wins',
    title: 'Minggu Kemenangan',
    description: 'Selesaikan habit 7 hari berturut-turut.',
    difficulty: 'medium',
    badgeLabel: 'Winner',
    badgeImage: badgeImages.weekOfWins
  },
  {
    id: 'History Hunter',
    title: 'Pemburu Riwayat',
    description: 'Capai 10 entri riwayat.',
    difficulty: 'medium',
    badgeLabel: 'Historian',
    badgeImage: badgeImages.historyHunter
  },
  {
    id: 'Habit Master',
    title: 'Master Habit',
    description: 'Selesaikan 20 habit.',
    difficulty: 'hard',
    badgeLabel: 'Master',
    badgeImage: badgeImages.habitMaster
  },
  {
    id: 'Checkpoint Champion',
    title: 'Juara Checkpoint',
    description: 'Selesaikan 20 checkpoint progress.',
    difficulty: 'hard',
    badgeLabel: 'Champion',
    badgeImage: badgeImages.checkpointChampion
  },
  {
    id: 'Streak Legend',
    title: 'Legenda Streak',
    description: 'Pertahankan streak 14 hari.',
    difficulty: 'hard',
    badgeLabel: 'Legend',
    badgeImage: badgeImages.streakLegend
  },
  {
    id: 'Badge Collector',
    title: 'Pengumpul Lencana',
    description: 'Buka 10 achievement.',
    difficulty: 'hard',
    badgeLabel: 'Collector',
    badgeImage: badgeImages.badgeCollector
  },
  {
    id: 'Ultimate Tracker',
    title: 'Pelacak Utama',
    description: 'Dapatkan 100 poin dari habit.',
    difficulty: 'hard',
    badgeLabel: 'Ultimate',
    badgeImage: badgeImages.ultimateTracker
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
        <Text style={styles.subtitle}>Lacak lencana, tingkat kesulitan, dan pencapaian.</Text>
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
                <Image source={item.badgeImage} style={styles.badgeImage} resizeMode="contain" />
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
                  {unlocked ? 'Terbuka' : 'Terkunci'}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Belum ada achievement yang terbuka.</Text>
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
  badgeImage: {
    width: 48,
    height: 48
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
