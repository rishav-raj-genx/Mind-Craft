import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGlobalAlert } from '@/components/GlobalAlertProvider';
import { palette, radii } from '@/constants/theme';
import { fallbackProfile, fetchProfileSummary, type ProfileSummary } from '@/services/mindcraft';

export default function HomeScreen() {
  const { showAlert } = useGlobalAlert();
  const [profile, setProfile] = useState<ProfileSummary>(fallbackProfile);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchProfileSummary()
        .then((summary) => {
          if (isMounted) setProfile(summary);
        })
        .catch(() => {
          if (isMounted) {
            setProfile(fallbackProfile);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    });

    return () => {
      isMounted = false;
      task.cancel();
    };
  }, []);

  const stats = useMemo(() => [
    { label: 'Mind Tokens', value: profile.tokens.toLocaleString('en-IN'), tint: palette.lime },
    { label: 'Study Streak', value: `${profile.streakDays} days`, tint: palette.peach },
    { label: 'Doubts Solved', value: String(profile.doubtsSolved), tint: palette.purpleSoft },
  ], [profile.doubtsSolved, profile.streakDays, profile.tokens]);

  const handleStartToday = useCallback(() => {
    showAlert({ type: 'success', title: 'Ready', message: 'Open Find, Forum, or Profile from the tabs to continue.' });
  }, [showAlert]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Mindcraft</Text>
          <Text style={styles.title}>Peer tutoring that feels like a study circle.</Text>
          <Text style={styles.subtitle}>Find mates, ask doubts, keep streaks alive, and earn tokens.</Text>
          <TouchableOpacity onPress={handleStartToday} style={styles.heroButton} activeOpacity={0.82}>
            <Text style={styles.heroButtonText}>{isLoading ? 'Syncing...' : 'Start today'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((item) => (
            <View key={item.label} style={[styles.statCard, { backgroundColor: item.tint }]}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today’s Plan</Text>
          <View style={styles.planCard}>
            <View style={styles.planDot} />
            <View style={styles.planTextWrap}>
              <Text style={styles.planTitle}>Revise DSA base cases</Text>
              <Text style={styles.planMeta}>25 min focus sprint with Rishav</Text>
            </View>
          </View>
          <View style={styles.planCard}>
            <View style={[styles.planDot, { backgroundColor: palette.purple }]} />
            <View style={styles.planTextWrap}>
              <Text style={styles.planTitle}>Answer one forum doubt</Text>
              <Text style={styles.planMeta}>Earn tokens by helping a peer</Text>
            </View>
          </View>
        </View>
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
    gap: 20,
  },
  hero: {
    backgroundColor: palette.ink,
    borderRadius: 32,
    padding: 24,
    minHeight: 260,
    justifyContent: 'flex-end',
  },
  kicker: {
    color: palette.lime,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 14,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  subtitle: {
    color: '#D8D0E3',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 12,
  },
  heroButton: {
    alignSelf: 'flex-start',
    marginTop: 20,
    backgroundColor: palette.lime,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  heroButtonText: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 15,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    borderRadius: radii.xl,
    padding: 18,
  },
  statValue: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  planDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.limeDeep,
  },
  planTextWrap: {
    flex: 1,
  },
  planTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  planMeta: {
    color: palette.muted,
    marginTop: 4,
    fontSize: 13,
  },
});
