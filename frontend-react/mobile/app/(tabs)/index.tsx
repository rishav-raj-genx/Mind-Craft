import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image as RNImage, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { useGlobalAlert } from '@/components/GlobalAlertProvider';
import { palette, radii } from '@/constants/theme';
import { fetchProfileSummary, fetchMates, fetchTrendingTopics, type ProfileSummary, type Mate, fallbackProfile } from '@/services/mindcraft';

export default function HomeScreen() {
  const { showAlert } = useGlobalAlert();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileSummary>(fallbackProfile);
  const [topMates, setTopMates] = useState<Mate[]>([]);
  const [trending, setTrending] = useState<{tag: string, count: number}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      Promise.all([
        fetchProfileSummary(),
        fetchMates(),
        fetchTrendingTopics(),
      ]).then(([summary, mates, topics]) => {
        if (isMounted) {
          setProfile(summary);
          setTopMates(mates.slice(0, 3));
          setTrending(topics);
        }
      }).catch(() => {
        if (isMounted) setProfile(fallbackProfile);
      }).finally(() => {
        if (isMounted) setIsLoading(false);
      });
    });

    return () => {
      isMounted = false;
      task.cancel();
    };
  }, []);

  const handleStartToday = useCallback(() => {
    router.push('/(tabs)/forum');
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Welcome Hero */}
        <View style={styles.hero}>
          <Text style={styles.kicker}>Welcome Back, {profile.name.split(' ')[0]}!</Text>
          <Text style={styles.title}>Ready to crush some concepts today?</Text>
          
          <View style={styles.heroPillContainer}>
            <TouchableOpacity style={styles.heroPill} activeOpacity={0.8} onPress={() => showAlert({ type: 'success', title: 'Streak', message: `You are on a ${profile.streakDays} day streak!`})}>
              <Text style={styles.heroPillIcon}>🔥</Text>
              <Text style={styles.heroPillText}>{profile.streakDays} Day Streak</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.heroPill, styles.heroPillSecondary]} activeOpacity={0.8} onPress={() => showAlert({ type: 'success', title: 'Badges', message: `You have ${profile.badges.length} badges!`})}>
              <Text style={styles.heroPillIcon}>🏆</Text>
              <Text style={[styles.heroPillText, {color: palette.purple}]}>{profile.badges.length} Badges</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Recommended Mates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Recommended Mates</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/find')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {isLoading ? (
            <ActivityIndicator size="small" color={palette.lime} />
          ) : topMates.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matesList}>
              {topMates.map((mate) => (
                <TouchableOpacity key={mate.id} style={styles.mateCard} activeOpacity={0.82} onPress={() => showAlert({ type: 'info', title: 'Match', message: mate.matchReason })}>
                  <Image source={{ uri: mate.photoUrl }} style={styles.mateAvatar} contentFit="cover" />
                  <Text style={styles.mateName} numberOfLines={1}>{mate.name}</Text>
                  <Text style={styles.mateSkill} numberOfLines={1}>{mate.skill}</Text>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>★ {4.8}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
             <Text style={styles.emptyText}>No matches found yet.</Text>
          )}
        </View>

        {/* Trending Topics */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Topics</Text>
          </View>
          
          <View style={styles.trendingGrid}>
            {trending.length > 0 ? trending.map((topic, i) => (
              <TouchableOpacity key={topic.tag} style={styles.trendingPill} activeOpacity={0.8} onPress={() => router.push('/(tabs)/forum')}>
                <Text style={styles.trendingTag}>{topic.tag.replace('#', '')}</Text>
                <Text style={styles.trendingCount}>({topic.count})</Text>
              </TouchableOpacity>
            )) : (
              ['DSA', 'WebDev', 'Math', 'Physics'].map((t) => (
                <TouchableOpacity key={t} style={styles.trendingPill} activeOpacity={0.8} onPress={() => router.push('/(tabs)/forum')}>
                  <Text style={styles.trendingTag}>{t}</Text>
                  <Text style={styles.trendingCount}>(0)</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* Post Doubt CTA */}
        <TouchableOpacity style={styles.ctaButton} onPress={handleStartToday} activeOpacity={0.82}>
          <Text style={styles.ctaButtonText}>+ Post a Doubt</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 24,
  },
  hero: {
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: palette.line,
  },
  kicker: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  title: {
    color: palette.muted,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
  },
  heroPillContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF4E6',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  heroPillSecondary: {
    backgroundColor: palette.purpleSoft,
    borderColor: '#E6DDF2',
  },
  heroPillIcon: {
    fontSize: 16,
  },
  heroPillText: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  viewAllText: {
    color: palette.limeDeep,
    fontWeight: '800',
    fontSize: 14,
  },
  matesList: {
    gap: 12,
    paddingRight: 20,
  },
  mateCard: {
    width: 140,
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
  },
  mateAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: palette.purple,
  },
  mateName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  mateSkill: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  ratingBadge: {
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  ratingText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    color: palette.muted,
    fontStyle: 'italic',
    fontSize: 14,
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  trendingTag: {
    color: palette.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  trendingCount: {
    color: palette.muted,
    fontWeight: '600',
    fontSize: 13,
  },
  ctaButton: {
    backgroundColor: palette.purpleSoft,
    borderWidth: 1,
    borderColor: '#E6DDF2',
    borderRadius: radii.xl,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  ctaButtonText: {
    color: palette.purple,
    fontWeight: '900',
    fontSize: 16,
  },
});
