import { View, Text, Image, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';

type AdaptationType = 'simplify' | 'visuals' | 'summarize';

type Adaptation = {
  action: AdaptationType;
  state?: 'loading' | 'ready' | 'reviewed' | 'error';
  original: string;
  result: string;
  keywords?: string[];
  visuals?: string[];
  bullets?: string[];
  visualUrl?: string;
};

type Props = {
  visible: boolean;
  zoneLabel: string;
  adaptation: Adaptation | null;
  onApply: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
};

const ACTION_META: Record<
  AdaptationType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  simplify: { label: 'Simplified', icon: 'text', color: colors.actionSimplify },
  visuals: { label: 'Visuals', icon: 'image', color: colors.actionVisuals },
  summarize: { label: 'Summary', icon: 'list', color: colors.actionSummarize },
};

export default function AdaptationPreviewModal({
  visible,
  zoneLabel,
  adaptation,
  onApply,
  onRegenerate,
  onCancel,
}: Props) {
  if (!adaptation) return null;

  const meta = ACTION_META[adaptation.action];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        {/* Background dismiss layer — sits behind the modal */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name={meta.icon} size={20} color={meta.color} />
              <Text style={styles.title}>{zoneLabel}</Text>
            </View>
            <Pressable onPress={onCancel} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Original</Text>
            <View style={styles.originalBlock}>
              <Text style={styles.originalText}>{adaptation.original}</Text>
            </View>

            <View style={styles.arrowRow}>
              <Ionicons name="arrow-down" size={20} color={meta.color} />
            </View>

            <Text style={styles.label}>{meta.label}</Text>
            <View style={[styles.resultBlock, { backgroundColor: `${meta.color}20` }]}>
              {/* For summary: show bullets inside the block; otherwise show result text */}
              {adaptation.bullets && adaptation.bullets.length > 0 ? (
                <View style={styles.bulletList}>
                  {adaptation.bullets.map((b) => (
                    <View key={b} style={styles.bulletRow}>
                      <Text style={[styles.bulletDot, { color: meta.color }]}>•</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.resultText}>{adaptation.result}</Text>
              )}
            </View>

            {/* Keywords */}
            {adaptation.keywords && adaptation.keywords.length > 0 && (
              <>
                <Text style={styles.label}>Key Words</Text>
                <View style={styles.keywordsRow}>
                  {adaptation.keywords.map((w) => (
                    <View key={w} style={[styles.keywordChip, { backgroundColor: `${meta.color}20` }]}>
                      <Text style={[styles.keywordText, { color: meta.color }]}>{w}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Generated image (visuals action) */}
            {adaptation.visualUrl ? (
              <Image
                source={{ uri: adaptation.visualUrl }}
                style={styles.visualImage}
                resizeMode="contain"
              />
            ) : (
              /* Fallback: show visual hint text only when no image was generated */
              adaptation.visuals && adaptation.visuals.length > 0 ? (
                <View style={styles.visualsList}>
                  {adaptation.visuals.map((v) => (
                    <View key={v} style={styles.visualItem}>
                      <Text style={styles.visualText}>{v}</Text>
                    </View>
                  ))}
                </View>
              ) : null
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.regenerateBtn} onPress={onRegenerate}>
              <Ionicons name="refresh" size={20} color={colors.textSecondary} />
              <Text style={styles.regenerateBtnText}>Regenerate</Text>
            </Pressable>

            <Pressable style={[styles.applyBtn, { backgroundColor: meta.color }]} onPress={onApply}>
              <Ionicons name="checkmark" size={20} color={colors.surface} />
              <Text style={styles.applyBtnText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.pagePadding,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...shadows.modalSheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    flex: 1,
  },
  title: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
  },
  label: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.innerGapSmall,
  },
  originalBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGapSmall,
  },
  originalText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  arrowRow: {
    alignItems: 'center',
    marginVertical: 6,
  },
  resultBlock: {
    borderRadius: radii.chip,
    padding: spacing.innerGapSmall,
  },
  resultText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  keywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGapSmall,
  },
  keywordChip: {
    borderRadius: radii.circle,
    paddingHorizontal: spacing.innerGapSmall,
    paddingVertical: 4,
  },
  keywordText: {
    ...typography.caption,
  },
  bulletList: {
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGapSmall,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
  },
  bulletDot: {
    ...typography.body,
  },
  bulletText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  visualsList: {
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGapSmall,
  },
  visualItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
    alignItems: 'center',
  },
  visualText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  visualImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.chip,
    marginTop: spacing.innerGap,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceMuted,
  },
  regenerateBtnText: {
    ...typography.cardTitle,
    color: colors.textSecondary,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    borderRadius: radii.chip,
  },
  applyBtnText: {
    ...typography.cardTitle,
    color: colors.surface,
  },
});
