import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, borders } from '../theme';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Quiz'>;

interface Question {
  id: number;
  text: string;
  hint: string;
  answers: { label: string; icon: string }[];
  correctIndex: number;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: 'What part of the plant takes in water from the soil?',
    hint: 'Hint: Look at the picture of roots above!',
    answers: [
      { label: 'Roots', icon: 'leaf' },
      { label: 'Stem', icon: 'resize' },
      { label: 'Leaves', icon: 'leaf' },
      { label: 'Flower', icon: 'flower' },
    ],
    correctIndex: 0,
  },
  {
    id: 2,
    text: 'What do the leaves of a plant do?',
    hint: 'Hint: Think about what leaves need from the sun!',
    answers: [
      { label: 'Hold water', icon: 'water' },
      { label: 'Make food', icon: 'sunny' },
      { label: 'Grow seeds', icon: 'ellipse' },
      { label: 'Drink water', icon: 'water' },
    ],
    correctIndex: 1,
  },
  {
    id: 3,
    text: 'Why is the stem important for a plant?',
    hint: 'Hint: The stem connects different parts!',
    answers: [
      { label: 'Makes food', icon: 'sunny' },
      { label: 'Drinks water', icon: 'water' },
      { label: 'Carries nutrients', icon: 'swap-vertical' },
      { label: 'Grows flowers', icon: 'flower' },
    ],
    correctIndex: 2,
  },
];

export default function QuizScreen() {
  const navigation = useNavigation<Nav>();
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(QUESTIONS.length).fill(null)
  );

  const question = QUESTIONS[currentQ];
  const total = QUESTIONS.length;

  const handleSelect = (index: number) => {
    setSelected(index);
    const newAnswers = [...answers];
    newAnswers[currentQ] = index;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQ < total - 1) {
      setCurrentQ(currentQ + 1);
      setSelected(answers[currentQ + 1]);
    } else {
      // Navigate to results with answers
      navigation.navigate('Results');
    }
  };

  const handlePrev = () => {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
      setSelected(answers[currentQ - 1]);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={18} color={colors.surface} />
          </View>
          <Text style={styles.headerTitle}>My Worksheet</Text>
        </View>
        <View style={styles.counter}>
          <Ionicons name="star" size={16} color={colors.warningText} />
          <Text style={styles.counterText}>
            {currentQ + 1} / {total}
          </Text>
        </View>
      </View>

      {/* Question Card */}
      <View style={styles.questionCard}>
        <View style={styles.questionNumberCircle}>
          <Text style={styles.questionNumber}>{question.id}</Text>
        </View>
        <Text style={styles.questionText}>{question.text}</Text>

        {/* Hint */}
        <View style={styles.hintBanner}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.warningText} />
          <Text style={styles.hintText}>{question.hint}</Text>
        </View>
      </View>

      {/* Answer label */}
      <Text style={styles.answerLabel}>Tap your answer</Text>

      {/* Answer Grid */}
      <View style={styles.answerGrid}>
        {question.answers.map((answer, index) => (
          <Pressable
            key={answer.label}
            style={[
              styles.answerCard,
              selected === index && styles.answerCardSelected,
            ]}
            onPress={() => handleSelect(index)}
          >
            <View style={styles.answerIconBox}>
              <Ionicons
                name={answer.icon as any}
                size={28}
                color={selected === index ? colors.primary : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                styles.answerText,
                selected === index && styles.answerTextSelected,
              ]}
            >
              {answer.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Pagination */}
      <View style={styles.pagination}>
        <Pressable
          style={[styles.navBtn, currentQ === 0 && styles.navBtnDisabled]}
          onPress={handlePrev}
          disabled={currentQ === 0}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={currentQ === 0 ? colors.surfaceMuted : colors.textSecondary}
          />
        </Pressable>

        <View style={styles.dots}>
          {QUESTIONS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentQ && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable style={styles.navBtnNext} onPress={handleNext}>
          <Ionicons name="chevron-forward" size={22} color={colors.surface} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.pagePadding,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.circle,
    backgroundColor: '#F5C542',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.navTitle,
    color: colors.textPrimary,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  counterText: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },

  // Question Card
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.pagePadding,
    marginTop: 8,
    gap: 14,
  },
  questionNumberCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.circle,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNumber: {
    ...typography.cardTitle,
    color: colors.surface,
  },
  questionText: {
    ...typography.questionBody,
    color: colors.textPrimary,
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warning,
    borderRadius: radii.chip,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hintText: {
    ...typography.bodySmall,
    color: colors.warningText,
    flex: 1,
  },

  // Answer section
  answerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 24,
    marginBottom: 12,
  },
  answerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.cardGap,
  },
  answerCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.answerCard,
    borderWidth: 2,
    borderColor: colors.surfaceMuted,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  answerCardSelected: {
    ...borders.activeSelected,
    backgroundColor: colors.primaryLight,
  },
  answerIconBox: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: {
    ...typography.button,
    color: colors.textPrimary,
  },
  answerTextSelected: {
    color: colors.primary,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 16,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  navBtnNext: {
    width: 48,
    height: 48,
    borderRadius: radii.circle,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
});
