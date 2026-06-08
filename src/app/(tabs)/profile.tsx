import { Link } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/useAuthStore';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const { clearAuth, userId } = useAuthStore();

  useEffect(() => {
    if (!userId) {
      setUser(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', userId), snapshot => {
      setUser(snapshot.data());
    });

    return () => unsub();
  }, [userId]);

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          clearAuth();
        }
      }
    ]);
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.profileCard}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{user.username?.[0] ?? 'U'}</Text>
        </View>

        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.role}>{user.role ?? 'Habit Builder'}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{user.level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{user.points}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{user.streak ?? 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>

        <View style={styles.badgeBar}>
          <View style={[styles.badge, styles.badgePrimary]}>
            <Text style={styles.badgeText}>Daily Focus</Text>
          </View>
          <View style={[styles.badge, styles.badgeSecondary]}>
            <Text style={styles.badgeText}>Streak Keeper</Text>
          </View>
        </View>

        <Link href="/achievements" asChild>
          <Pressable style={styles.achievementsButton}>
            <Text style={styles.achievementsButtonText}>View achievements</Text>
          </Pressable>
        </Link>

        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>Achievements</Text>
          {Array.isArray(user.achievements) && user.achievements.length > 0 ? (
            <View style={styles.achievementList}>
              {user.achievements.map((achievement: string) => (
                <View key={achievement} style={styles.achievementBadge}>
                  <Text style={styles.achievementText}>{achievement}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noAchievements}>No achievements yet. Keep completing habits!</Text>
          )}
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    padding: 24
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
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18
  },
  avatarInitial: {
    color: 'white',
    fontSize: 32,
    fontWeight: '800'
  },
  username: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827'
  },
  role: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 15
  },
  statsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24
  },
  statBlock: {
    flex: 1,
    alignItems: 'center'
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827'
  },
  statLabel: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 14
  },
  badgeBar: {
    width: '100%',
    marginTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  badge: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginHorizontal: 4
  },
  achievementsSection: {
    width: '100%',
    marginTop: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12
  },
  achievementList: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  achievementBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    marginBottom: 10
  },
  achievementText: {
    color: '#2563EB',
    fontWeight: '700'
  },
  noAchievements: {
    color: '#6B7280',
    fontSize: 14
  },
  achievementsButton: {
    width: '100%',
    marginTop: 16,
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center'
  },
  achievementsButtonText: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  badgePrimary: {
    backgroundColor: '#EEF2FF'
  },
  badgeSecondary: {
    backgroundColor: '#ECFDF5'
  },
  badgeText: {
    color: '#111827',
    fontWeight: '700'
  },
  logoutButton: {
    width: '100%',
    marginTop: 24,
    backgroundColor: '#EF4444',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center'
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16
  }
});
