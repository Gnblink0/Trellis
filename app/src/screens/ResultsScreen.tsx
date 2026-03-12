import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { RootStackParamList } from '../navigation/types';
import ScreenHeader from '../components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Results'>;

interface ResultItem {
  question: string;
  answer: string;
  correct: boolean;
}

const MOCK_RESULTS: ResultItem[] = [
  { question: 'Q1: Parts that take in water', answer: 'Roots', correct: true },
  { question: 'Q2: Job of the leaves', answer: 'Leaves', correct: true },
  { question: 'Q3: Why stem is important', answer: 'Flower', correct: false },
];

export default function ResultsScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Complete" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>All Done!</Text>
          <Text style={styles.heroSubtitle}>
            The student completed all 3 questions. Send the results to the
            teacher.
          </Text>
        </View>

        {/* Results Card */}
        <View style={styles.resultsCard}>
          <Text style={styles.resultsLabel}>Results</Text>

          {MOCK_RESULTS.map((item, index) => (
            <View key={index}>
              <View style={styles.resultRow}>
                <View
                  style={[
                    styles.resultIcon,
                    !item.correct && styles.resultIconError,
                  ]}
                >
                  <Ionicons
                    name={item.correct ? 'checkmark' : 'alert'}
                    size={18}
                    color={item.correct ? colors.primary : colors.error}
                  />
                </View>
                <Text style={styles.resultQuestion}>{item.question}</Text>
                <Text
                  style={[
                    styles.resultAnswer,
                    !item.correct && styles.resultAnswerError,
                  ]}
                >
                  {item.answer}
                </Text>
              </View>
              {index < MOCK_RESULTS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Actions */}
        <Pressable style={styles.ctaButton} onPress={() => navigation.navigate('Export')}>
          <Ionicons name="share-outline" size={22} color={colors.surface} />
          <Text style={styles.ctaText}>Send to Teacher</Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable style={styles.secondaryBtn}>
            <Ionicons name="document-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.secondaryBtnText}>Save PDF</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.popToTop()}
          >
            <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            <Text style={styles.secondaryBtnText}>Re-adapt</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: 40,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.sectionGapTop,
    paddingBottom: spacing.sectionGapBottom,
    gap: 12,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: radii.circle,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 400,
  },

  // Results card
  resultsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.pagePadding,
    marginBottom: spacing.sectionGapBottom,
  },
  resultsLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconError: {
    backgroundColor: '#FEE8E0',
  },
  resultQuestion: {
    ...typography.resultItem,
    color: colors.textPrimary,
    flex: 1,
  },
  resultAnswer: {
    ...typography.resultAnswer,
    color: colors.primary,
  },
  resultAnswerError: {
    color: colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceMuted,
  },

  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    paddingVertical: 18,
    gap: spacing.innerGapSmall,
  },
  ctaText: {
    ...typography.button,
    color: colors.surface,
  },

  // Secondary actions
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.cardGap,
    marginTop: spacing.cardGap,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    paddingVertical: 16,
    gap: 8,
  },
  secondaryBtnText: {
    ...typography.cardTitle,
    color: colors.textSecondary,
  },
});
