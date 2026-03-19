import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { regenerateAdaptation } from '../services/adaptApi';
import type { AdaptedBlock, SummaryResult } from '@trellis/shared';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Review'>;
type Route = RouteProp<RootStackParamList, 'Review'>;

export default function ReviewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { response, imageUri } = route.params;

  const [blocks, setBlocks] = useState<AdaptedBlock[]>(response.blocks);
  const [summary, setSummary] = useState<SummaryResult | null>(response.summary);
  const [acceptedBlocks, setAcceptedBlocks] = useState<Set<string>>(new Set());
  const [acceptedSummary, setAcceptedSummary] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const allAccepted =
    blocks.every((b) => acceptedBlocks.has(b.blockId)) &&
    (!summary || acceptedSummary);

  const handleAcceptBlock = useCallback((blockId: string) => {
    setAcceptedBlocks((prev) => new Set(prev).add(blockId));
  }, []);

  const handleRegenerateBlock = useCallback(
    async (block: AdaptedBlock) => {
      setRegeneratingId(block.blockId);
      try {
        const result = await regenerateAdaptation({
          target: { type: 'block', blockId: block.blockId },
          context: {
            originalText: block.originalText,
            simplifyLevel: response.meta.simplifyLevel === 'G1' || response.meta.simplifyLevel === 'G2'
              ? response.meta.simplifyLevel
              : undefined,
            language: 'en',
          },
        });

        if (!result.ok) {
          Alert.alert('Regeneration Failed', result.error.message);
          return;
        }

        setBlocks((prev) =>
          prev.map((b) =>
            b.blockId === block.blockId
              ? {
                  ...b,
                  simplifiedText: result.data.result.simplifiedText ?? b.simplifiedText,
                  keywords: result.data.result.keywords ?? b.keywords,
                  visualHint: result.data.result.visualHint ?? b.visualHint,
                  visualUrl: result.data.result.visualUrl ?? b.visualUrl,
                }
              : b
          )
        );
        // Remove from accepted so EA reviews the new version
        setAcceptedBlocks((prev) => {
          const next = new Set(prev);
          next.delete(block.blockId);
          return next;
        });
      } catch {
        Alert.alert('Error', 'Failed to regenerate. Please try again.');
      } finally {
        setRegeneratingId(null);
      }
    },
    [response.meta.simplifyLevel]
  );

  const handleRegenerateSummary = useCallback(async () => {
    setRegeneratingId('summary');
    try {
      const fullText = blocks.map((b) => b.originalText).join('\n\n');
      const result = await regenerateAdaptation({
        target: { type: 'summary' },
        context: {
          originalText: fullText,
          summaryMaxSentences: 5,
          language: 'en',
        },
      });

      if (!result.ok) {
        Alert.alert('Regeneration Failed', result.error.message);
        return;
      }

      if (result.data.result.sentences) {
        setSummary({
          sentences: result.data.result.sentences,
          warnings: [],
        });
        setAcceptedSummary(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to regenerate summary. Please try again.');
    } finally {
      setRegeneratingId(null);
    }
  }, [blocks]);

  const handleAcceptAll = () => {
    // Log data for Task 7/8 verification
    console.log('[ReviewScreen] Handoff data:', { blocks, summary });

    // For now, navigate to StudentView with adapted data mapped to legacy format
    const adaptations = blocks.map((b) => ({
      zoneId: b.blockId,
      zoneLabel: b.label,
      action: 'simplify' as const,
      original: b.originalText,
      result: b.simplifiedText ?? b.originalText,
      keywords: b.keywords,
      visualUrl: b.visualUrl ?? undefined,
    }));

    navigation.navigate('StudentView', {
      title: 'Adapted Worksheet',
      adaptations,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Review Adaptations</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Original image reference */}
        <Pressable style={styles.imagePreview}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          <Text style={styles.imageLabel}>Original Worksheet</Text>
        </Pressable>

        {/* Latency info */}
        <Text style={styles.metaText}>
          Processed in {(response.meta.latencyMs.total / 1000).toFixed(1)}s
          {response.meta.simplifyLevel ? ` · ${response.meta.simplifyLevel}` : ''}
        </Text>

        {/* Summary card */}
        {summary && (
          <View style={[styles.card, acceptedSummary && styles.cardAccepted]}>
            <View style={styles.cardHeader}>
              <Ionicons name="list" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Summary</Text>
              {acceptedSummary && (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              )}
            </View>
            {summary.sentences.map((s, i) => (
              <Text key={i} style={styles.summaryItem}>
                {i + 1}. {s}
              </Text>
            ))}
            <View style={styles.cardActions}>
              <Pressable
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => setAcceptedSummary(true)}
                disabled={acceptedSummary}
              >
                <Ionicons name="checkmark" size={16} color={colors.surface} />
                <Text style={styles.actionBtnText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.regenBtn]}
                onPress={handleRegenerateSummary}
                disabled={regeneratingId === 'summary'}
              >
                {regeneratingId === 'summary' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                )}
                <Text style={styles.regenBtnText}>Regenerate</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Text block cards */}
        {blocks.map((block) => {
          const isAccepted = acceptedBlocks.has(block.blockId);
          const isRegenerating = regeneratingId === block.blockId;

          return (
            <View key={block.blockId} style={[styles.card, isAccepted && styles.cardAccepted]}>
              <View style={styles.cardHeader}>
                <Ionicons name="text" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>{block.label}</Text>
                {isAccepted && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                )}
              </View>

              {/* Original text */}
              <Text style={styles.sectionLabel}>Original</Text>
              <Text style={styles.originalText}>{block.originalText}</Text>

              {/* Simplified text */}
              {block.simplifiedText && (
                <>
                  <Text style={styles.sectionLabel}>Simplified</Text>
                  <Text style={styles.simplifiedText}>{block.simplifiedText}</Text>
                </>
              )}

              {/* Keywords */}
              {block.keywords.length > 0 && (
                <View style={styles.keywordRow}>
                  {block.keywords.map((kw, i) => (
                    <View key={i} style={styles.keyword}>
                      <Text style={styles.keywordText}>{kw}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Visual Support Image */}
              {block.visualHint && (
                <>
                  <Text style={styles.sectionLabel}>Visual Support</Text>
                  {block.visualUrl ? (
                    <Image
                      source={{ uri: block.visualUrl }}
                      style={styles.visualImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.visualFallback}>
                      <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                      <Text style={styles.visualFallbackText}>
                        Image unavailable: {block.visualHint}
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Actions */}
              <View style={styles.cardActions}>
                <Pressable
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => handleAcceptBlock(block.blockId)}
                  disabled={isAccepted}
                >
                  <Ionicons name="checkmark" size={16} color={colors.surface} />
                  <Text style={styles.actionBtnText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.regenBtn]}
                  onPress={() => handleRegenerateBlock(block)}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="refresh" size={16} color={colors.primary} />
                  )}
                  <Text style={styles.regenBtnText}>Regenerate</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Accept All FAB */}
      <Pressable
        style={[styles.fab, !allAccepted && styles.fabSecondary]}
        onPress={handleAcceptAll}
      >
        <Ionicons name="school" size={20} color={colors.surface} />
        <Text style={styles.fabText}>
          {allAccepted ? 'Hand to Student' : 'Accept All & Hand Off'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.title, color: colors.textPrimary },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: 100,
    gap: spacing.cardGap,
  },

  // Image preview
  imagePreview: {
    alignItems: 'center',
    gap: spacing.innerGapSmall,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceMuted,
  },
  imageLabel: { ...typography.caption, color: colors.textSecondary },

  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    gap: spacing.innerGapSmall,
  },
  cardAccepted: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
  },
  cardTitle: { ...typography.cardTitle, color: colors.textPrimary, flex: 1 },

  sectionLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    marginTop: spacing.innerGapSmall,
  },
  originalText: { ...typography.bodySmall, color: colors.textSecondary },
  simplifiedText: { ...typography.body, color: colors.textPrimary },

  // Summary
  summaryItem: { ...typography.body, color: colors.textPrimary },

  // Keywords
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGapSmall,
  },
  keyword: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.innerGapSmall,
    paddingVertical: 4,
  },
  keywordText: { ...typography.caption, color: colors.primary },

  // Visual support image
  visualImage: {
    width: '100%',
    height: 200,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.innerGapSmall,
  },
  visualFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.innerGap,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.card,
    gap: spacing.innerGapSmall,
  },
  visualFallbackText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Card actions
  cardActions: {
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGapSmall,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    borderRadius: radii.secondaryButton,
  },
  acceptBtn: { backgroundColor: colors.primary },
  actionBtnText: { ...typography.caption, color: colors.surface },
  regenBtn: {
    backgroundColor: colors.primaryLight,
  },
  regenBtnText: { ...typography.caption, color: colors.primary },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    backgroundColor: colors.primary,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall + 2,
    ...shadows.fab,
  },
  fabSecondary: {
    opacity: 0.9,
  },
  fabText: { ...typography.cardTitle, color: colors.surface },
});
