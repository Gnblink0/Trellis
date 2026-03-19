import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import type { SelectedSimplifyLevel } from '@trellis/shared';
import { colors, typography, spacing, radii, shadows } from '../theme';

type BubbleAction = 'simplify' | 'summarize' | 'visuals';

type BubbleResult =
  | { action: 'simplify'; simplifiedText: string }
  | { action: 'summarize'; sentences: string[] }
  | { action: 'visuals'; visualHint: string; visualUrl: string | null };

type Props = {
  visible: boolean;
  position: { x: number; y: number }; // top-left in the worksheet image container
  onRequestSimplify: (level: SelectedSimplifyLevel) => void;
  onRequestSummarize: () => void;
  onRequestVisuals: () => void;
  loadingActions: Partial<Record<BubbleAction, boolean>>;
  result: BubbleResult | null;
};

const SIMPLIFY_LEVELS: SelectedSimplifyLevel[] = ['G4', 'G5', 'G6', 'G7'];

export default function SelectionActionBubble({
  visible,
  position,
  onRequestSimplify,
  onRequestSummarize,
  onRequestVisuals,
  loadingActions,
  result,
}: Props) {
  const [showSimplifyPicker, setShowSimplifyPicker] = useState(false);
  const [pendingSimplifyLevel, setPendingSimplifyLevel] = useState<SelectedSimplifyLevel>('G4');
  const isLoadingSimplify = !!loadingActions.simplify;
  const isLoadingSummarize = !!loadingActions.summarize;
  const isLoadingVisuals = !!loadingActions.visuals;

  if (!visible) return null;

  return (
    <View style={[styles.container, { left: position.x, top: position.y }]}>
      <View style={styles.card}>
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, isLoadingSimplify && styles.actionBtnDisabled]}
            onPress={() => {
              setShowSimplifyPicker((v) => !v);
            }}
            disabled={isLoadingSimplify}
          >
            <Text style={styles.actionBtnText}>Simplify</Text>
            {isLoadingSimplify && <ActivityIndicator size="small" color={colors.primary} />}
          </Pressable>

          <Pressable
            style={[styles.actionBtn, isLoadingSummarize && styles.actionBtnDisabled]}
            onPress={onRequestSummarize}
            disabled={isLoadingSummarize}
          >
            <Text style={styles.actionBtnText}>Summarize</Text>
            {isLoadingSummarize && <ActivityIndicator size="small" color={colors.primary} />}
          </Pressable>

          <Pressable
            style={[styles.actionBtn, isLoadingVisuals && styles.actionBtnDisabled]}
            onPress={onRequestVisuals}
            disabled={isLoadingVisuals}
          >
            <Text style={styles.actionBtnText}>Visuals</Text>
            {isLoadingVisuals && <ActivityIndicator size="small" color={colors.primary} />}
          </Pressable>
        </View>

        {showSimplifyPicker && (
          <View style={styles.picker}>
            <Text style={styles.pickerLabel}>Pick Simplify Level</Text>
            <View style={styles.pickerChips}>
              {SIMPLIFY_LEVELS.map((lvl) => (
                <Pressable
                  key={lvl}
                  style={[
                    styles.pickerChip,
                    pendingSimplifyLevel === lvl && styles.pickerChipActive,
                  ]}
                  onPress={() => {
                    setPendingSimplifyLevel(lvl);
                    onRequestSimplify(lvl);
                    setShowSimplifyPicker(false);
                  }}
                    disabled={isLoadingSimplify}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      pendingSimplifyLevel === lvl && styles.pickerChipTextActive,
                    ]}
                  >
                    {lvl}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {result && (
          <ScrollView style={styles.resultScroll} showsVerticalScrollIndicator={false}>
            {result.action === 'simplify' && (
              <>
                <Text style={styles.resultLabel}>Simplified</Text>
                <View style={styles.resultBlock}>
                  <Text style={styles.resultText}>{result.simplifiedText}</Text>
                </View>
              </>
            )}

            {result.action === 'summarize' && (
              <>
                <Text style={styles.resultLabel}>Summary</Text>
                <View style={styles.resultBlock}>
                  {result.sentences.map((s, i) => (
                    <Text key={i} style={styles.resultSentence}>
                      {i + 1}. {s}
                    </Text>
                  ))}
                </View>
              </>
            )}

            {result.action === 'visuals' && (
              <>
                <Text style={styles.resultLabel}>Visual Support</Text>
                {result.visualUrl ? (
                  <Image source={{ uri: result.visualUrl }} style={styles.visualImage} />
                ) : (
                  <View style={styles.resultBlock}>
                    <Text style={styles.resultText}>{result.visualHint}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '85%',
    zIndex: 999,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    ...shadows.modalSheet,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.secondaryButton,
    paddingVertical: spacing.innerGapSmall,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  picker: {
    marginTop: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
  },
  pickerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pickerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.innerGapSmall,
  },
  pickerChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
  },
  pickerChipActive: {
    backgroundColor: colors.primary,
  },
  pickerChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pickerChipTextActive: {
    color: colors.surface,
  },
  resultScroll: {
    marginTop: spacing.innerGapSmall,
  },
  resultLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.innerGapSmall,
    textTransform: 'uppercase',
  },
  resultBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGapSmall,
  },
  resultText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  resultSentence: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginBottom: spacing.innerGapSmall,
  },
  visualImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.innerGapSmall,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGapSmall,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

