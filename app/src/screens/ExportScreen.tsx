import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import { RootStackParamList, AdaptationSummary } from '../navigation/types';
import ScreenHeader from '../components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Export'>;
type Route = RouteProp<RootStackParamList, 'Export'>;

const ACTION_META: Record<
  AdaptationSummary['action'],
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  simplify: { label: 'Simplified', icon: 'text', color: colors.actionSimplify },
  visuals: { label: 'Visuals', icon: 'image', color: colors.actionVisuals },
  summarize: { label: 'Summary', icon: 'list', color: colors.actionSummarize },
};

export default function ExportScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const title = route.params?.title ?? 'Worksheet';
  const adaptations = route.params?.adaptations ?? [];
  const count = adaptations.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Export" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>
            {count > 0 ? 'Adaptations Ready' : 'No Adaptations Yet'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {count > 0
              ? `${count} section${count > 1 ? 's' : ''} adapted for "${title}". Choose how to export.`
              : `Go back and adapt some sections of "${title}" first.`}
          </Text>
        </View>

        {/* Adaptations summary card */}
        {count > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Adapted Sections</Text>

            {adaptations.map((item, index) => {
              const meta = ACTION_META[item.action];
              return (
                <View key={item.zoneId}>
                  <View style={styles.resultRow}>
                    <View
                      style={[styles.resultIcon, { backgroundColor: `${meta.color}18` }]}
                    >
                      <Ionicons name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View style={styles.resultContent}>
                      <Text style={styles.resultZone}>{item.zoneLabel}</Text>
                      <Text style={styles.resultType}>{meta.label}</Text>
                    </View>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  {index < adaptations.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Preview card — one example */}
        {count > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Preview</Text>
            <View style={styles.previewBlock}>
              <Text style={styles.previewLabel}>Original</Text>
              <Text style={styles.previewText}>{adaptations[0].original}</Text>
            </View>
            <View style={styles.arrowRow}>
              <Ionicons name="arrow-down" size={18} color={colors.primary} />
            </View>
            <View style={styles.previewBlockResult}>
              <Text style={styles.previewLabel}>
                {ACTION_META[adaptations[0].action].label}
              </Text>
              <Text style={styles.previewTextResult}>{adaptations[0].result}</Text>
            </View>
            {count > 1 && (
              <Text style={styles.moreText}>
                + {count - 1} more section{count > 2 ? 's' : ''}
              </Text>
            )}
          </View>
        )}

        {/* Export actions */}
        <Pressable style={styles.ctaButton}>
          <Ionicons name="share-outline" size={22} color={colors.surface} />
          <Text style={styles.ctaText}>Share Adapted Worksheet</Text>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable style={styles.secondaryBtn}>
            <Ionicons
              name="document-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.secondaryBtnText}>Save PDF</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.popToTop()}
          >
            <Ionicons
              name="refresh"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.secondaryBtnText}>Re-adapt</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={styles.backBtnText}>Back to Worksheet</Text>
        </Pressable>
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
    gap: spacing.innerGapSmall,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: radii.circle,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.innerGapSmall,
  },
  heroTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 480,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.pagePadding,
    marginBottom: spacing.innerGap,
  },
  cardLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    marginBottom: spacing.innerGap,
  },

  // Result rows
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGap,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
    gap: 2,
  },
  resultZone: {
    ...typography.resultItem,
    color: colors.textPrimary,
  },
  resultType: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceMuted,
  },

  // Preview
  previewBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
  },
  previewBlockResult: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
  },
  previewLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.innerGapSmall,
  },
  previewText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  previewTextResult: {
    ...typography.body,
    color: colors.textPrimary,
  },
  arrowRow: {
    alignItems: 'center',
    paddingVertical: spacing.innerGapSmall,
  },
  moreText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.innerGap,
  },

  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.card,
    paddingVertical: spacing.innerGap,
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGap,
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
    paddingVertical: spacing.innerGap,
    gap: spacing.innerGapSmall,
  },
  secondaryBtnText: {
    ...typography.cardTitle,
    color: colors.textSecondary,
  },

  // Back
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    marginTop: spacing.sectionGapTop,
    paddingVertical: spacing.innerGap,
  },
  backBtnText: {
    ...typography.cardTitle,
    color: colors.textSecondary,
  },
});
