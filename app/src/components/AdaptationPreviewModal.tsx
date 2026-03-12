import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';

type AdaptationType = 'simplify' | 'visuals' | 'summarize';

type Adaptation = {
  action: AdaptationType;
  original: string;
  result: string;
  keywords?: string[];
  visuals?: string[];
  bullets?: string[];
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
  simplify: { label: 'Simplified', icon: 'text', color: colors.primary },
  visuals: { label: 'Visuals', icon: 'image', color: '#8B5CF6' },
  summarize: { label: 'Summary', icon: 'list', color: '#10B981' },
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
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
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
              <Text style={styles.resultText}>{adaptation.result}</Text>
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

            {/* Bullets */}
            {adaptation.bullets && adaptation.bullets.length > 0 && (
              <View style={styles.bulletList}>
                {adaptation.bullets.map((b) => (
                  <View key={b} style={styles.bulletRow}>
                    <Text style={[styles.bulletDot, { color: meta.color }]}>•</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Visuals */}
            {adaptation.visuals && adaptation.visuals.length > 0 && (
              <View style={styles.visualsList}>
                {adaptation.visuals.map((v) => (
                  <View key={v} style={styles.visualItem}>
                    <Text style={styles.visualText}>{v}</Text>
                  </View>
                ))}
              </View>
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
        </Pressable>
      </Pressable>
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
    padding: spacing.pagePadding,
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
    width: 40,
    height: 40,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: spacing.pagePadding,
  },
  label: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.innerGapSmall,
    marginTop: spacing.innerGap,
  },
  originalBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
  },
  originalText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  arrowRow: {
    alignItems: 'center',
    marginVertical: spacing.innerGap,
  },
  resultBlock: {
    borderRadius: radii.chip,
    padding: spacing.innerGap,
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
    paddingHorizontal: spacing.innerGap,
    paddingVertical: 6,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
    padding: spacing.pagePadding,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGap,
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
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGap,
    borderRadius: radii.chip,
  },
  applyBtnText: {
    ...typography.cardTitle,
    color: colors.surface,
  },
});
