import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radii } from '@/constants/theme';
import { fallbackDoubts, fetchDoubts, type Doubt } from '@/services/mindcraft';

export default function ForumScreen() {
  const [doubts, setDoubts] = useState<Doubt[]>(fallbackDoubts);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchDoubts()
      .then((items) => {
        if (isMounted) setDoubts(items.length ? items : fallbackDoubts);
      })
      .catch(() => {
        if (isMounted) setDoubts(fallbackDoubts);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Doubt Forum</Text>
          <Text style={styles.title}>Ask fast. Learn together.</Text>
          <Text style={styles.status}>{isLoading ? 'Loading latest doubts...' : `${doubts.length} doubts loaded`}</Text>
        </View>

        <TouchableOpacity style={styles.askButton} activeOpacity={0.82}>
          <Text style={styles.askButtonText}>Post a doubt</Text>
        </TouchableOpacity>

        {doubts.map((doubt) => (
          <View key={doubt.id} style={styles.doubtCard}>
            <Text style={styles.tag}>{doubt.tag}</Text>
            <Text style={styles.doubtTitle}>{doubt.title}</Text>
            <View style={styles.aiAssist}>
              <Text style={styles.aiLabel}>AI Assist</Text>
              <Text style={styles.aiHint}>{doubt.hint}</Text>
            </View>
            <TouchableOpacity style={styles.answerButton} activeOpacity={0.82}>
              <Text style={styles.answerText}>Answer</Text>
            </TouchableOpacity>
          </View>
        ))}
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
    gap: 16,
  },
  header: {
    backgroundColor: palette.purpleSoft,
    borderRadius: 32,
    padding: 22,
  },
  kicker: {
    color: palette.purple,
    fontWeight: '900',
    fontSize: 14,
  },
  title: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 30,
    marginTop: 8,
  },
  status: {
    color: palette.muted,
    fontWeight: '800',
    marginTop: 8,
  },
  askButton: {
    backgroundColor: palette.lime,
    borderRadius: radii.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  askButtonText: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 16,
  },
  doubtCard: {
    backgroundColor: palette.card,
    borderRadius: radii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.line,
  },
  tag: {
    alignSelf: 'flex-start',
    color: palette.purple,
    backgroundColor: palette.purpleSoft,
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontWeight: '900',
  },
  doubtTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 14,
  },
  aiAssist: {
    backgroundColor: palette.cyanSoft,
    borderRadius: radii.xl,
    padding: 14,
    marginTop: 14,
  },
  aiLabel: {
    color: '#007C96',
    fontWeight: '900',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  aiHint: {
    color: palette.ink,
    marginTop: 6,
    lineHeight: 20,
  },
  answerButton: {
    alignSelf: 'flex-start',
    marginTop: 14,
    backgroundColor: palette.peach,
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  answerText: {
    color: palette.ink,
    fontWeight: '900',
  },
});
