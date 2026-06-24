import { db } from '@/services/firebase';
import { useAuthStore } from '@/store/useAuthStore';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { AppState, FlatList, StyleSheet, Text, View } from 'react-native';

export default function HistoryScreen() {
  const [history, setHistory] = useState<any[]>([]);
  const userId = useAuthStore(state => state.userId);
  const unsubRef = useRef<(() => void) | null>(null);

  // Set up history listener
  useEffect(() => {
    if (!userId) {
      console.log('[HistoryScreen] No userId available, clearing history');
      setHistory([]);
      return;
    }

    console.log('[HistoryScreen] Setting up history listener for userId:', userId);

    const q = query(
      collection(db, 'history'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const data = (snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[]).sort((a, b) => {
          const aTime = a.completedAt ? (typeof a.completedAt.toDate === 'function' ? a.completedAt.toDate().getTime() : new Date(a.completedAt).getTime()) : 0;
          const bTime = b.completedAt ? (typeof b.completedAt.toDate === 'function' ? b.completedAt.toDate().getTime() : new Date(b.completedAt).getTime()) : 0;
          return bTime - aTime;
        });
        console.log('[HistoryScreen] Loaded history entries:', data.length);
        setHistory(data);
      },
      error => {
        console.error('[HistoryScreen] Failed to load history:', error.message, error.code);
        setHistory([]);
      }
    );

    unsubRef.current = unsubscribe;
    return () => {
      console.log('[HistoryScreen] Unsubscribing from history listener');
      unsubscribe();
    };
  }, [userId]);

  // Listen for app state changes to ensure history data stays fresh
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: string) => {
      console.log('[HistoryScreen] App state changed to:', state);
      if (state === 'active' && userId && unsubRef.current) {
        console.log('[HistoryScreen] App came to foreground, history listener should be active');
      }
    });

    return () => subscription.remove();
  }, [userId]);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Riwayat Penyelesaian</Text>

      <FlatList
        data={history}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const completedAt = item.completedAt;
          const completedAtText = completedAt
            ? typeof completedAt.toDate === 'function'
              ? completedAt.toDate().toLocaleString()
              : new Date(completedAt).toLocaleString()
            : '';
          const isFailed = item.status === 'failed';

          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.habitName}>{item.habitName}</Text>
                <Text style={[styles.points, isFailed && styles.pointsFailed]}>
                  {isFailed ? '0 poin' : `+${item.points ?? 0} poin`}
                </Text>
              </View>
              <Text style={styles.meta}>{item.habitType}</Text>
              <Text style={[styles.meta, isFailed && styles.metaFailed]}>
                {isFailed ? 'Gagal' : 'Selesai'}
              </Text>
              <Text style={styles.meta}>{completedAtText}</Text>
            </View>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Belum ada riwayat. Selesaikan kebiasaan untuk melihatnya di sini</Text>
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
    fontSize: 15,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 20
  },
  list: {
    paddingBottom: 40
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  habitName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8
  },
  points: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB'
  },
  pointsFailed: {
    color: '#DC2626'
  },
  meta: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2
  },
  metaFailed: {
    color: '#DC2626',
    fontWeight: '700'
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center'
  },
  emptyText: {
    color: '#6B7280'
  }
});
