import { db } from '@/services/firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

export default function LeaderboardScreen() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('points', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(data);
    });

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Leaderboard</Text>
      <Text style={styles.subtitle}>Lihat peringkat habit builder terbaik.</Text>

      <FlatList
        data={users}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.userRow}>
            <View style={styles.userInfo}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.username}>{item.username ?? 'Anonim'}</Text>
              <View style={styles.userMeta}>
                <Text style={[styles.metaText, styles.metaTextSpacer]}>Lvl {item.level ?? 1}</Text>
                <Text style={styles.metaText}>🔥 {item.streak ?? 0}</Text>
              </View>
            </View>
            <Text style={styles.points}>{item.points ?? 0} poin</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Belum ada pengguna yang ditemukan.</Text>
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827'
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 20
  },
  list: {
    paddingBottom: 40
  },
  userRow: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  userInfo: {
    flex: 1,
    marginRight: 12
  },
  userMeta: {
    flexDirection: 'row',
    marginTop: 6
  },
  metaText: {
    color: '#6B7280',
    fontSize: 13
  },
  metaTextSpacer: {
    marginRight: 16
  },
  rank: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4
  },
  username: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827'
  },
  points: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563EB'
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#6B7280'
  }
});
