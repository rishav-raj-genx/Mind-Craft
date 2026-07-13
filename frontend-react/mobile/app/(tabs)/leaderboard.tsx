import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, InteractionManager, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LOW_MEMORY_LIST_PROPS } from '@/constants/list';
import { palette, radii } from '@/constants/theme';
import { fetchLeaderboard } from '@/services/mindcraft';

type Leader = {
  uid: string;
  rank: number;
  name: string;
  tokens: number;
  department: string;
  photoUrl: string;
};

const LeaderRow = memo(function LeaderRow({ leader }: { leader: Leader }) {
  const podium = leader.rank <= 3;
  return (
    <View style={[styles.row, podium && styles.podiumRow]}>
      <Text style={[styles.rank, podium && styles.podiumRank]}>#{leader.rank}</Text>
      <Image source={{ uri: leader.photoUrl }} style={styles.avatar} cachePolicy="memory-disk" contentFit="cover" />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{leader.name}</Text>
        <Text style={styles.department} numberOfLines={1}>{leader.department}</Text>
      </View>
      <View style={styles.tokenPill}>
        <Text style={styles.tokenValue}>{leader.tokens.toLocaleString('en-IN')}</Text>
        <Text style={styles.tokenLabel}>Tokens</Text>
      </View>
    </View>
  );
});

export default function LeaderboardScreen() {
  const [leaders, setLeaders] = useState<Leader[]>([]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchLeaderboard().then(setLeaders).catch(() => setLeaders([]));
    });
    return () => task.cancel();
  }, []);

  const topThree = useMemo(() => leaders.slice(0, 3), [leaders]);
  const rest = useMemo(() => leaders.slice(3), [leaders]);
  const renderLeader = useCallback(({ item }: { item: Leader }) => <LeaderRow leader={item} />, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={rest}
        renderItem={renderLeader}
        keyExtractor={(item) => item.uid}
        ListHeaderComponent={(
          <>
            <View style={styles.header}>
              <Text style={styles.kicker}>Leaderboard</Text>
              <Text style={styles.title}>Top Mind Token earners</Text>
            </View>
            <View style={styles.podium}>
              {topThree.map((leader) => <LeaderRow key={leader.uid} leader={leader} />)}
            </View>
          </>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{leaders.length ? '' : 'No ranked learners yet.'}</Text>}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...LOW_MEMORY_LIST_PROPS}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.surface },
  content: { padding: 20, paddingBottom: 120, gap: 12 },
  header: { backgroundColor: palette.purpleSoft, borderRadius: 32, padding: 22 },
  kicker: { color: palette.purple, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: palette.ink, fontSize: 30, fontWeight: '900', marginTop: 6 },
  podium: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
  },
  podiumRow: { backgroundColor: palette.lime },
  rank: { width: 42, color: palette.muted, fontSize: 16, fontWeight: '900' },
  podiumRank: { color: palette.ink },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.peach },
  info: { flex: 1 },
  name: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  department: { color: palette.muted, fontWeight: '700', marginTop: 3 },
  tokenPill: { alignItems: 'flex-end', backgroundColor: '#FFFFFFCC', borderRadius: radii.xl, paddingHorizontal: 12, paddingVertical: 8 },
  tokenValue: { color: palette.ink, fontWeight: '900', fontSize: 16 },
  tokenLabel: { color: palette.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  empty: { color: palette.muted, textAlign: 'center', fontWeight: '800', marginTop: 36 },
});
