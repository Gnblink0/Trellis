import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { localImageToDataUri } from '../utils/imageDataUri';
import { scanImageOcr, regenerateAdaptation } from '../services/adaptApi';
import type { OcrScanResponse, SnippetMode } from '@trellis/shared';
import WorksheetPageMerge from '../components/WorksheetPageMerge';
import {
  registerWorksheetUse,
  updateRecentTitle,
  getRecentWorksheetById,
} from '../services/recentWorksheets';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OcrLiveText'>;
type R = RouteProp<RootStackParamList, 'OcrLiveText'>;

type PageState = {
  uri: string;
  ocr: OcrScanResponse | null;
  loading: boolean;
  error: string | null;
};

function OcrPageView({
  uri,
  ocr,
  displayW,
  range,
  onWordPress,
  onWordLongPress,
}: {
  uri: string;
  ocr: OcrScanResponse;
  displayW: number;
  range: { a: number; b: number } | null;
  onWordPress: (wordIndex: number) => void;
  /** Long-press a word to start a new selection from that word (OCR is word-by-word only). */
  onWordLongPress: (wordIndex: number) => void;
}) {
  const aspect = ocr.imageWidth / ocr.imageHeight;

  const selected = (i: number) =>
    range !== null && i >= Math.min(range.a, range.b) && i <= Math.max(range.a, range.b);

  return (
    <View style={[styles.pageFrame, { width: displayW, aspectRatio: aspect }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      <View style={[StyleSheet.absoluteFill, styles.wordLayer]} pointerEvents="box-none">
        {ocr.words.map((w, i) => (
          <Pressable
            key={`w-${i}`}
            hitSlop={spacing.innerGapSmall}
            onPress={() => onWordPress(i)}
            onLongPress={() => onWordLongPress(i)}
            style={[
              styles.wordHit,
              {
                left: `${w.bbox.left * 100}%`,
                top: `${w.bbox.top * 100}%`,
                width: `${w.bbox.width * 100}%`,
                height: `${w.bbox.height * 100}%`,
              },
            ]}
          >
            {selected(i) ? (
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wordHighlight]} />
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function OcrLiveTextScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { width: windowW } = useWindowDimensions();
  const { pageUris, worksheetId: worksheetIdParam } = route.params;

  const displayW = windowW - spacing.pagePadding * 2;

  /** Normalized URIs (first page may be copied into app storage for recents). Null until ready. */
  const [screenPageUris, setScreenPageUris] = useState<string[] | null>(() =>
    Platform.OS === 'web' ? pageUris : null
  );
  const [worksheetId, setWorksheetId] = useState<string | null>(() => worksheetIdParam ?? null);
  const [worksheetTitle, setWorksheetTitle] = useState('Worksheet');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const [pages, setPages] = useState<PageState[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  /** Per-page selected word index range (inclusive). */
  const [ranges, setRanges] = useState<Record<number, { a: number; b: number } | null>>({});
  const [busy, setBusy] = useState<SnippetMode | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultTitle, setResultTitle] = useState('');
  const [resultBody, setResultBody] = useState<string | null>(null);
  const [resultImageUri, setResultImageUri] = useState<string | null>(null);
  const [mergeUris, setMergeUris] = useState<string[] | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      Alert.alert('OCR', 'Live Text scanning runs on device with the backend server.');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;
    void (async () => {
      if (worksheetIdParam) {
        const w = await getRecentWorksheetById(worksheetIdParam);
        if (!cancelled && w) setWorksheetTitle(w.title);
        if (!cancelled) setScreenPageUris(pageUris);
        return;
      }
      try {
        const { uri, id } = await registerWorksheetUse(pageUris[0]);
        if (cancelled) return;
        if (id) {
          setWorksheetId(id);
          const w = await getRecentWorksheetById(id);
          if (!cancelled && w) setWorksheetTitle(w.title);
        }
        const merged = pageUris.length === 1 ? [uri] : [uri, ...pageUris.slice(1)];
        if (!cancelled) setScreenPageUris(merged);
      } catch {
        if (!cancelled) setScreenPageUris(pageUris);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageUris, worksheetIdParam]);

  useEffect(() => {
    if (!screenPageUris) return;

    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        screenPageUris.map(async (uri) => {
          try {
            const dataUri = await localImageToDataUri(uri);
            const res = await scanImageOcr(dataUri);
            if (!res.ok) {
              return { uri, ocr: null, loading: false, error: res.error.message } as PageState;
            }
            return { uri, ocr: res.data, loading: false, error: null } as PageState;
          } catch (e) {
            return {
              uri,
              ocr: null,
              loading: false,
              error: e instanceof Error ? e.message : 'OCR failed',
            } as PageState;
          }
        })
      );
      if (!cancelled) setPages(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [screenPageUris]);

  const current = pages[pageIndex];
  const currentRange = ranges[pageIndex] ?? null;

  const selectedText = useMemo(() => {
    if (!current?.ocr || !currentRange) return '';
    const { a, b } = currentRange;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return current.ocr.words
      .slice(lo, hi + 1)
      .map((w) => w.text)
      .join(' ')
      .trim();
  }, [current, currentRange]);

  const clearSelection = useCallback(() => {
    setRanges((prev) => ({ ...prev, [pageIndex]: null }));
  }, [pageIndex]);

  const runSnippet = async (mode: SnippetMode) => {
    const text = selectedText.trim();
    if (text.length < 1) {
      Alert.alert('Nothing selected', 'Tap words on the page to select a phrase (like Live Text).');
      return;
    }

    setBusy(mode);
    try {
      const res = await regenerateAdaptation({
        target: { type: 'snippet' },
        context: {
          originalText: text,
          mode,
          simplifyLevel: mode === 'simplify' ? 'G2' : undefined,
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

  const goAiAdapt = () => {
    const uris = screenPageUris ?? pageUris;
    if (uris.length === 1) {
      navigation.navigate('Process', { imageUri: uris[0] });
      return;
    }
    setMergeUris([...uris]);
  };

  const openRename = () => {
    setRenameDraft(worksheetTitle);
    setRenameOpen(true);
  };

  const saveRename = async () => {
    if (!worksheetId) return;
    const trimmed = renameDraft.trim().slice(0, 120);
    try {
      await updateRecentTitle(worksheetId, trimmed || 'Worksheet');
      setWorksheetTitle(trimmed || 'Worksheet');
      setRenameOpen(false);
    } catch {
      Alert.alert('Could not save', 'Try again.');
    }
  };

  const onMergeDone = useCallback(
    (mergedUri: string) => {
      setMergeUris(null);
      navigation.navigate('Process', { imageUri: mergedUri });
    },
    [navigation]
  );

  const onMergeError = useCallback((err: unknown) => {
    setMergeUris(null);
    Alert.alert('Merge failed', err instanceof Error ? err.message : 'Could not combine pages.');
  }, []);

  const loadingAny = pages.some((p) => p.loading);
  const allFailed = pages.length > 0 && pages.every((p) => !p.loading && (!p.ocr || p.error));
  const persistLoading = screenPageUris === null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={spacing.innerGapSmall}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Live Text</Text>
        <Pressable
          onPress={goAiAdapt}
          style={styles.headerAi}
          hitSlop={spacing.innerGapSmall}
          disabled={persistLoading}
        >
          <Text style={[styles.headerAiText, persistLoading && styles.headerAiDisabled]}>AI adapt</Text>
        </Pressable>
      </View>

      {worksheetId && Platform.OS !== 'web' ? (
        <Pressable
          style={styles.nameRow}
          onPress={openRename}
          accessibilityLabel="Rename worksheet"
          disabled={persistLoading}
        >
          <Ionicons name="create-outline" size={18} color={colors.primary} />
          <Text style={styles.nameRowText} numberOfLines={1}>
            {worksheetTitle}
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.lead}>
        Text is detected as word boxes (like system Live Text), so you select whole words in order—not
        arbitrary letters. Tap to extend the range; long-press a word to start over from there. Then use
        Simplify, Visual, or Summary. Swipe sideways for more pages.
      </Text>

      {persistLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingLabel}>Preparing worksheet…</Text>
        </View>
      ) : loadingAny ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingLabel}>Scanning pages…</Text>
        </View>
      ) : allFailed ? (
        <Text style={styles.errorText}>Could not read text. Check that the server is running and try again.</Text>
      ) : (
        <FlatList
          data={pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `${item.uri}-${index}`}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const i = Math.round(x / windowW);
            setPageIndex(Math.max(0, Math.min(i, pages.length - 1)));
          }}
          renderItem={({ item, index }) => (
            <ScrollView
              style={{ width: windowW }}
              contentContainerStyle={styles.pageScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.pageBadge}>
                Page {index + 1} of {pages.length}
              </Text>
              {item.error ? (
                <Text style={styles.errorText}>{item.error}</Text>
              ) : item.ocr && item.ocr.words.length === 0 ? (
                <Text style={styles.errorText}>No text detected on this page.</Text>
              ) : item.ocr ? (
                <OcrPageView
                  uri={item.uri}
                  ocr={item.ocr}
                  displayW={displayW}
                  range={ranges[index] ?? null}
                  onWordPress={(wi) => {
                    setPageIndex(index);
                    setRanges((prev) => {
                      const cur = prev[index];
                      if (!cur) {
                        return { ...prev, [index]: { a: wi, b: wi } };
                      }
                      return {
                        ...prev,
                        [index]: {
                          a: Math.min(cur.a, cur.b, wi),
                          b: Math.max(cur.a, cur.b, wi),
                        },
                      };
                    });
                  }}
                  onWordLongPress={(wi) => {
                    setPageIndex(index);
                    setRanges((prev) => ({ ...prev, [index]: { a: wi, b: wi } }));
                  }}
                />
              ) : null}
            </ScrollView>
          )}
        />
      )}

      {selectedText.length > 0 && (
        <View style={styles.toolbar}>
          <Pressable onPress={clearSelection} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
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

      {mergeUris ? (
        <>
          <View style={styles.mergeOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.mergeLabel}>Preparing pages…</Text>
          </View>
          <WorksheetPageMerge pageUris={mergeUris} onDone={onMergeDone} onError={onMergeError} />
        </>
      ) : null}

      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.renameKb}
        >
          <View style={styles.modalScrim}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameOpen(false)} />
            <View style={styles.renameCard}>
              <Text style={styles.modalTitle}>Worksheet name</Text>
              <Text style={styles.renameHint}>This name appears in Recent worksheets on the home screen.</Text>
              <TextInput
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder="e.g. Unit 3 fractions"
                placeholderTextColor={colors.textSecondary}
                maxLength={120}
                autoFocus
                style={styles.renameInput}
                returnKeyType="done"
                onSubmitEditing={() => void saveRename()}
              />
              <View style={styles.renameActions}>
                <Pressable style={styles.renameCancel} onPress={() => setRenameOpen(false)}>
                  <Text style={styles.renameCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.renameSave} onPress={() => void saveRename()}>
                  <Text style={styles.renameSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  headerTitle: { ...typography.title, color: colors.textPrimary, flex: 1, textAlign: 'center' },
  headerAi: { paddingVertical: spacing.innerGapSmall, paddingHorizontal: spacing.innerGapSmall },
  headerAiText: { ...typography.bodySmall, color: colors.primary },
  headerAiDisabled: { opacity: 0.45 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.innerGapSmall,
  },
  nameRowText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
  lead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingHorizontal: spacing.pagePadding,
    marginBottom: spacing.innerGap,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.innerGap },
  loadingLabel: { ...typography.body, color: colors.textSecondary },
  errorText: { ...typography.bodySmall, color: colors.error, paddingHorizontal: spacing.pagePadding },
  pageScroll: {
    paddingBottom: spacing.sectionGapBottom,
    alignItems: 'center',
  },
  pageBadge: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.innerGapSmall,
  },
  pageFrame: {
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  wordLayer: { zIndex: 2 },
  wordHit: {
    position: 'absolute',
  },
  /** Semi-transparent marker yellow so underlying OCR text stays readable. */
  wordHighlight: {
    backgroundColor: colors.selectionHighlight,
    opacity: 0.42,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGap,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  clearBtn: {
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
  },
  clearBtnText: { ...typography.bodySmall, color: colors.textSecondary },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    borderRadius: radii.secondaryButton,
    backgroundColor: colors.primary,
    minHeight: 44,
  },
  toolBtnDisabled: { opacity: 0.7 },
  toolBtnText: { ...typography.caption, color: colors.surface },
  mergeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    gap: spacing.innerGap,
  },
  mergeLabel: { ...typography.body, color: colors.surface },
  renameKb: { flex: 1 },
  modalScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    padding: spacing.pagePadding,
  },
  renameCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    gap: spacing.innerGap,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  renameHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  renameInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.card,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    backgroundColor: colors.surfaceMuted,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.innerGap,
    marginTop: spacing.innerGapSmall,
  },
  renameCancel: {
    paddingVertical: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
  },
  renameCancelText: { ...typography.bodySmall, color: colors.textSecondary },
  renameSave: {
    paddingVertical: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    borderRadius: radii.secondaryButton,
    backgroundColor: colors.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  renameSaveText: { ...typography.bodySmall, color: colors.surface },
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
