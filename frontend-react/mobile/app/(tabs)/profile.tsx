import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, InteractionManager, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { useGlobalAlert } from '@/components/GlobalAlertProvider';
import { LOW_MEMORY_LIST_PROPS } from '@/constants/list';
import { palette, radii } from '@/constants/theme';
import { fallbackProfile, fetchProfileSummary, type ProfileSummary } from '@/services/mindcraft';
import { useAuth } from '@/context/AuthContext';

const BadgeCard = memo(function BadgeCard({ badge, onPress }: { badge: string; onPress: (badge: string) => void }) {
  return (
    <TouchableOpacity onPress={() => onPress(badge)} style={styles.badgeCard} activeOpacity={0.82}>
      <Text style={styles.badgeIcon}>★</Text>
      <Text style={styles.badgeText}>{badge}</Text>
    </TouchableOpacity>
  );
});

export default function ProfileScreen() {
  const { showAlert } = useGlobalAlert();
  const { logout } = useAuth();
  const router = useRouter();
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
          if (isMounted) setProfile(fallbackProfile);
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

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (e) {
      showAlert({ type: 'error', title: 'Logout Failed', message: 'Could not log out.' });
    }
  };

  const badges = useMemo(() => profile.badges, [profile.badges]);
  const keyExtractor = useCallback((badge: string) => badge, []);
  const handleBadgePress = useCallback((badge: string) => {
    showAlert({ type: 'success', title: 'Badge', message: badge });
  }, [showAlert]);
  const renderBadge = useCallback(({ item }: { item: string }) => (
    <BadgeCard badge={item} onPress={handleBadgePress} />
  ), [handleBadgePress]);

  const header = useMemo(() => (
    <>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileCard}>
        {isLoading ? (
          <ActivityIndicator size="large" color={palette.purple} style={{ marginVertical: 32 }} />
        ) : (
          <>
            <Image
              source={{ uri: profile.photoUrl }}
              style={styles.avatar}
              cachePolicy="memory-disk"
              contentFit="cover"
              transition={120}
            />
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.meta}>{profile.meta}</Text>
          </>
        )}
      </View>

      <View style={styles.walletRow}>
        <View style={[styles.walletCard, { backgroundColor: palette.lime }]}>
          <Text style={styles.walletValue}>{profile.tokens.toLocaleString('en-IN')}</Text>
          <Text style={styles.walletLabel}>Mind Tokens</Text>
        </View>
        <View style={[styles.walletCard, { backgroundColor: palette.peach }]}>
          <Text style={styles.walletValue}>{profile.streakDays}</Text>
          <Text style={styles.walletLabel}>Streak Days</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Badges</Text>
      </View>
    </>
  ), [profile, isLoading]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={badges}
        renderItem={renderBadge}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...LOW_MEMORY_LIST_PROPS}
      />
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
    gap: 18,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: palette.ink,
  },
  logoutButton: {
    backgroundColor: '#FFE9E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  logoutText: {
    color: '#E44D35',
    fontWeight: '800',
    fontSize: 14,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 36,
    padding: 26,
    borderWidth: 1,
    borderColor: palette.line,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.purple,
  },
  name: {
    color: palette.ink,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 16,
  },
  meta: {
    color: palette.muted,
    marginTop: 6,
    fontWeight: '700',
  },
  walletRow: {
    flexDirection: 'row',
    gap: 12,
  },
  walletCard: {
    flex: 1,
    borderRadius: radii.xl,
    padding: 18,
  },
  walletValue: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '900',
  },
  walletLabel: {
    color: palette.muted,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionHeader: {
    backgroundColor: palette.ink,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 18,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#302842',
    borderRadius: radii.xl,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 12,
  },
  badgeIcon: {
    color: palette.lime,
    fontSize: 22,
    fontWeight: '900',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
});
