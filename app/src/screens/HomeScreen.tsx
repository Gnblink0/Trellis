import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="leaf" size={24} color={colors.surface} />
          </View>
          <Text style={styles.appName}>Trellis</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Snap a Worksheet</Text>
          <Text style={styles.heroSubtitle}>
            Take a photo of any worksheet or textbook page to create an adapted
            version in seconds.
          </Text>
        </View>

        {/* Camera CTA */}
        <Pressable
          style={styles.cameraCta}
          onPress={() => navigation.navigate('WorksheetView')}
        >
          <View style={styles.cameraIconCircle}>
            <Ionicons name="camera" size={32} color={colors.surface} />
          </View>
          <Text style={styles.cameraLabel}>Tap to take a photo</Text>
        </Pressable>

        {/* Recent Worksheets */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recent Worksheets</Text>
          <View style={styles.recentList}>
            {MOCK_RECENT.map((item) => (
              <Pressable key={item.id} style={styles.recentCard}>
                <View style={styles.thumbnail}>
                  <Ionicons
                    name="document-text"
                    size={24}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.recentInfo}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.recentMeta}>{item.meta}</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const MOCK_RECENT = [
  { id: '1', title: 'Parts of a Plant', meta: 'Gr. 2 · Adapted 2 hrs ago' },
  { id: '2', title: 'Water Cycle', meta: 'Gr. 3 · Adapted yesterday' },
  { id: '3', title: 'Solar System', meta: 'Gr. 4 · Adapted 3 days ago' },
];

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: radii.chip,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...typography.title,
    color: colors.textPrimary,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.sectionGapTop,
    paddingBottom: spacing.sectionGapBottom,
    gap: 16,
  },
  heroTitle: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 480,
  },

  // Camera CTA
  cameraCta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.answerCard,
    height: 200,
    gap: spacing.innerGapSmall,
    borderWidth: 2,
    borderColor: colors.surfaceMuted,
    borderStyle: 'dashed',
  },
  cameraIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.circle,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  // Section
  section: {
    marginTop: spacing.sectionGapTop,
    gap: spacing.innerGap,
  },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
  },

  // Recent list
  recentList: {
    gap: spacing.cardGap,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    gap: spacing.innerGap,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: radii.thumbnail,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentInfo: {
    flex: 1,
    gap: 4,
  },
  recentTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  recentMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
