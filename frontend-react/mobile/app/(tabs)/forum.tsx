import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radii } from '@/constants/theme';

const doubts = [
  { id: '1', tag: '#DSA', title: 'What is a base case?', hint: 'Think of the smallest input where recursion can stop.' },
  { id: '2', tag: '#WebDev', title: 'What is closure in JS?', hint: 'A function remembers variables from its outer scope.' },
  { id: '3', tag: '#Math', title: 'How do limits work?', hint: 'Watch what value the function approaches, not always reaches.' },
];

export default function ForumScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Doubt Forum</Text>
          <Text style={styles.title}>Ask fast. Learn together.</Text>
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
