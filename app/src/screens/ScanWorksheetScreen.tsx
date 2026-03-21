import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { regenerateAdaptation } from '../services/adaptApi';
import type { SnippetMode } from '@trellis/shared';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ScanWorksheet'>;
type R = RouteProp<RootStackParamList, 'ScanWorksheet'>;

export default function ScanWorksheetScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { blocks, meta, imageUri } = route.params;

  const scanText = useMemo(
    () =>
      blocks
        .map((b) => `[${b.label}]\n${b.originalText}`)
        .join('\n\n'),
    [blocks]
  );

  const [selectedText, setSelectedText] = useState('');
  const [busy, setBusy] = useState<SnippetMode | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultTitle, setResultTitle] = useState('');
  const [resultBody, setResultBody] = useState<string | null>(null);
  const [resultImageUri, setResultImageUri] = useState<string | null>(null);

  const simplifyLevel =
    meta.simplifyLevel === 'G1' || meta.simplifyLevel === 'G2' ? meta.simplifyLevel : 'G2';

  const handleSelectionChange = useCallback(
    (e: { nativeEvent: { selection: { start: number; end: number } } }) => {
      const { start, end } = e.nativeEvent.selection;
      if (end > start) {
        const raw = scanText.slice(start, end);
        setSelectedText(raw.trim());
      } else {
        setSelectedText('');
      }
    },
    [scanText]
  );

  const runSnippet = async (mode: SnippetMode) => {
    const text = selectedText.trim();
    if (text.length < 1) {
      Alert.alert('Nothing selected', 'Select a word or phrase in the text below first.');
      return;
    }

    setBusy(mode);
    try {
      const res = await regenerateAdaptation({
        target: { type: 'snippet' },
        context: {
          originalText: text,
          mode,
          simplifyLevel: mode === 'simplify' ? simplifyLevel : undefined,
          summaryMaxSentences: mode === 'summary' ? 3 : undefined,
          language: 'en',
        },
      });

      if (!res.ok) {
        Alert.alert('Request failed', res.error.message);
        return;
      }

      const { result } = res.data;

      if (mode === 'summary' && result.sentences?.length) {
        setResultTitle('Summary');
        setResultBody(result.sentences.join('\n\n'));
        setResultImageUri(null);
      } else if (mode === 'visual') {
        setResultTitle('Visual');
        setResultBody(result.visualHint ?? null);
        setResultImageUri(result.visualUrl ?? null);
      } else {
        setResultTitle('Simplified');
        const parts: string[] = [];
        if (result.simplifiedText) parts.push(result.simplifiedText);
        if (result.keywords?.length) parts.push(`Keywords: ${result.keywords.join(', ')}`);
        if (result.visualHint) parts.push(`Visual idea: ${result.visualHint}`);
        setResultBody(parts.join('\n\n'));
        setResultImageUri(result.visualUrl ?? null);
      }

      setResultOpen(true);
    } catch {
      Alert.alert('Error', 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const textInputProps =
    Platform.OS === 'ios'
      ? ({ readOnly: true } as const)
      : ({ editable: false } as const);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={spacing.innerGapSmall}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Scan & select</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        <Text style={styles.hint}>
          Text below is extracted from your worksheet. Long-press a word, then drag the handles to select
          a phrase. Use the toolbar for Simplify, Visual, or Summary.
        </Text>

        <TextInput
          value={scanText}
          multiline
          scrollEnabled
          textAlignVertical="top"
          {...textInputProps}
          selectTextOnFocus={false}
          style={styles.textArea}
          onSelectionChange={handleSelectionChange}
        />

        {selectedText.length > 0 ? (
          <Text style={styles.selectionMeta}>
            Selected ({selectedText.length} chars): “{selectedText.length > 120 ? `${selectedText.slice(0, 120)}…` : selectedText}”
          </Text>
        ) : null}
      </ScrollView>

      {selectedText.length > 0 && (
        <View style={styles.toolbar}>
          <Pressable
            style={[styles.toolBtn, busy && styles.toolBtnDisabled]}
            onPress={() => void runSnippet('simplify')}
            disabled={busy !== null}
          >
            {busy === 'simplify' ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Ionicons name="text-outline" size={20} color={colors.surface} />
            )}
            <Text style={styles.toolBtnText}>Simplify</Text>
          </Pressable>
          <Pressable
            style={[styles.toolBtn, busy && styles.toolBtnDisabled]}
            onPress={() => void runSnippet('visual')}
            disabled={busy !== null}
          >
            {busy === 'visual' ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Ionicons name="image-outline" size={20} color={colors.surface} />
            )}
            <Text style={styles.toolBtnText}>Visual</Text>
          </Pressable>
          <Pressable
            style={[styles.toolBtn, busy && styles.toolBtnDisabled]}
            onPress={() => void runSnippet('summary')}
            disabled={busy !== null}
          >
            {busy === 'summary' ? (
              <ActivityIndicator color={colors.surface} size="small" />
            ) : (
              <Ionicons name="list-outline" size={20} color={colors.surface} />
            )}
            <Text style={styles.toolBtnText}>Summary</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={resultOpen} transparent animationType="fade" onRequestClose={() => setResultOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{resultTitle}</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {resultBody ? <Text style={styles.modalBody}>{resultBody}</Text> : null}
              {resultImageUri ? (
                <Image source={{ uri: resultImageUri }} style={styles.modalImage} resizeMode="contain" />
              ) : null}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setResultOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.title, color: colors.textPrimary },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sectionGapBottom,
    gap: spacing.innerGap,
  },
  preview: {
    width: '100%',
    height: spacing.sectionGapTop * 3,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceMuted,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  textArea: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: spacing.sectionGapTop * 6,
    padding: spacing.innerGap,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
  },
  selectionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGap,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    ...shadows.fab,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
    borderRadius: radii.secondaryButton,
    backgroundColor: colors.primary,
    minHeight: 48,
  },
  toolBtnDisabled: { opacity: 0.7 },
  toolBtnText: { ...typography.cardTitle, color: colors.surface },
  modalScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    padding: spacing.pagePadding,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    maxHeight: '85%',
    gap: spacing.innerGap,
  },
  modalTitle: { ...typography.cardTitle, color: colors.textPrimary },
  modalScroll: { maxHeight: 360 },
  modalBody: { ...typography.body, color: colors.textPrimary },
  modalImage: {
    width: '100%',
    height: 220,
    marginTop: spacing.innerGapSmall,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceMuted,
  },
  modalClose: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
  },
  modalCloseText: { ...typography.bodySmall, color: colors.primary },
});
