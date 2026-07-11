import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radii } from '@/constants/theme';

const badges = ['Weekly Warrior', 'Session Pro', 'Problem Solver'];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>M</Text>
          </View>
          <Text style={styles.name}>Mindcraft Learner</Text>
          <Text style={styles.meta}>CSE • Year 1 • 7 day streak</Text>
        </View>

        <View style={styles.walletRow}>
          <View style={[styles.walletCard, { backgroundColor: palette.lime }]}>
            <Text style={styles.walletValue}>1,240</Text>
            <Text style={styles.walletLabel}>Mind Tokens</Text>
          </View>
          <View style={[styles.walletCard, { backgroundColor: palette.peach }]}>
            <Text style={styles.walletValue}>7</Text>
            <Text style={styles.walletLabel}>Streak Days</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          {badges.map((badge) => (
            <TouchableOpacity key={badge} style={styles.badgeCard} activeOpacity={0.82}>
              <Text style={styles.badgeIcon}>★</Text>
              <Text style={styles.badgeText}>{badge}</Text>
            </TouchableOpacity>
          ))}
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
    gap: 18,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
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
  section: {
    backgroundColor: palette.ink,
    borderRadius: 32,
    padding: 18,
    gap: 12,
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
