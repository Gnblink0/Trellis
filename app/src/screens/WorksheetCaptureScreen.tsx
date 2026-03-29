import { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList } from '../navigation/types';
import WorksheetCropEditor from '../components/WorksheetCropEditor';
import { getImageSize, WORKSHEET_MERGE_MAX_WIDTH } from '../utils/worksheetImages';

// Native-only: react-native-view-shot for merging pages
let captureRef: any = null;
if (Platform.OS !== 'web') {
  try {
    captureRef = require('react-native-view-shot').captureRef;
  } catch {
    // unavailable
  }
}

const MAX_PAGES = 15;

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorksheetCapture'>;

type PageSize = { width: number; height: number };

export default function WorksheetCaptureScreen() {
  const navigation = useNavigation<Nav>();
  const [pages, setPages] = useState<string[]>([]);
  /** URI pending crop — when set, the crop editor is shown. */
  const [pendingCropUri, setPendingCropUri] = useState<string | null>(null);
  /** Merging state — page sizes resolved, merge view rendered, capturing. */
  const [isMerging, setIsMerging] = useState(false);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const mergeViewRef = useRef<View>(null);
  /** Resolves when all images in the merge view have loaded. */
  const mergeImagesReadyRef = useRef<{ loaded: number; total: number; resolve: (() => void) | null }>({
    loaded: 0, total: 0, resolve: null,
  });

  const remainingSlots = MAX_PAGES - pages.length;

  const addFromCamera = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Camera capture requires the app on a tablet or phone.');
      return;
    }
    if (remainingSlots <= 0) {
      Alert.alert('Page limit', `You can add up to ${MAX_PAGES} pages.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission', 'Camera access is needed to photograph worksheets.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPendingCropUri(result.assets[0].uri);
  };

  const addFromLibrary = async () => {
    if (remainingSlots <= 0) {
      Alert.alert('Page limit', `You can add up to ${MAX_PAGES} pages.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPendingCropUri(result.assets[0].uri);
  };

  const removePage = (index: number) => {
    setPages((p) => p.filter((_, i) => i !== index));
  };

  const handleContinue = async () => {
    if (pages.length === 0) return;

    // Single page — navigate directly
    if (pages.length === 1) {
      navigation.navigate('Process', { imageUri: pages[0] });
      return;
    }

    // Multiple pages — merge into one tall image
    if (!captureRef) {
      // Fallback: just send first page if view-shot unavailable
      navigation.navigate('Process', { imageUri: pages[0] });
      return;
    }

    setIsMerging(true);
    try {
      // Resolve all image sizes
      const sizes = await Promise.all(pages.map((uri) => getImageSize(uri)));

      // Prepare promise that resolves when all <Image> onLoad fire
      const allLoaded = new Promise<void>((resolve) => {
        mergeImagesReadyRef.current = { loaded: 0, total: pages.length, resolve };
      });

      setPageSizes(sizes);

      // Wait for every image in the merge view to finish loading
      await allLoaded;

      // One extra frame to ensure pixels are flushed to the native view
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const uri = await captureRef(mergeViewRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
      });
      navigation.navigate('Process', { imageUri: uri });
    } catch (e) {
      console.error('[WorksheetCapture] merge failed:', e);
      Alert.alert('Merge Error', 'Could not merge pages. Using first page only.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Process', { imageUri: pages[0] }),
        },
      ]);
    } finally {
      setIsMerging(false);
      setPageSizes([]);
      mergeImagesReadyRef.current = { loaded: 0, total: 0, resolve: null };
    }
  };

  // ── Crop editor is shown as a full-screen overlay ──
  if (pendingCropUri) {
    return (
      <WorksheetCropEditor
        uri={pendingCropUri}
        onConfirm={(croppedUri) => {
          setPages((p) => [...p, croppedUri]);
          setPendingCropUri(null);
        }}
        onSkipFullImage={() => {
          setPages((p) => [...p, pendingCropUri]);
          setPendingCropUri(null);
        }}
        onCancel={() => {
          setPendingCropUri(null);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={spacing.innerGapSmall}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Worksheet pages</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.lead}>
        Add one or more pages. You can crop each page after picking it.
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.actionCard, (remainingSlots <= 0 || isMerging) && styles.actionCardDisabled]}
          onPress={addFromCamera}
          disabled={remainingSlots <= 0 || isMerging}
        >
          <Ionicons name="camera" size={28} color={colors.surface} />
          <Text style={styles.actionCardText}>Take photo</Text>
        </Pressable>
        <Pressable
          style={[styles.actionOutline, (remainingSlots <= 0 || isMerging) && styles.actionCardDisabled]}
          onPress={addFromLibrary}
          disabled={remainingSlots <= 0 || isMerging}
        >
          <Ionicons name="images-outline" size={22} color={colors.primary} />
          <Text style={styles.actionOutlineText}>Choose from library</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>
        Pages ({pages.length}/{MAX_PAGES})
      </Text>

      <FlatList
        data={pages}
        keyExtractor={(item, index) => `${item}-${index}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>No pages yet. Use the buttons above.</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.pageRow}>
            <Image source={{ uri: item }} style={styles.thumb} resizeMode="cover" />
            <Text style={styles.pageLabel}>Page {index + 1}</Text>
            <Pressable
              onPress={() => removePage(index)}
              hitSlop={spacing.innerGapSmall}
              accessibilityLabel="Remove page"
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </Pressable>
          </View>
        )}
      />

      {isMerging ? (
        <View style={styles.mergingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.mergingText}>Merging {pages.length} pages...</Text>
        </View>
      ) : (
        <Pressable
          style={[styles.continueBtn, pages.length === 0 && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={pages.length === 0}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.surface} />
        </Pressable>
      )}

      {/* Hidden merge view — stacks all pages vertically for capture */}
      {isMerging && pageSizes.length === pages.length && (
        <View
          ref={mergeViewRef}
          collapsable={false}
          style={styles.mergeView}
        >
          {pages.map((uri, i) => {
            const aspect = pageSizes[i].width / pageSizes[i].height;
            return (
              <Image
                key={`merge-${i}`}
                source={{ uri }}
                style={{
                  width: WORKSHEET_MERGE_MAX_WIDTH,
                  height: WORKSHEET_MERGE_MAX_WIDTH / aspect,
                }}
                resizeMode="contain"
                onLoad={() => {
                  const ref = mergeImagesReadyRef.current;
                  ref.loaded += 1;
                  if (ref.loaded >= ref.total && ref.resolve) {
                    ref.resolve();
                    ref.resolve = null;
                  }
                }}
              />
            );
          })}
        </View>
      )}
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
  lead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    paddingHorizontal: spacing.pagePadding,
    marginBottom: spacing.innerGap,
  },
  actions: {
    paddingHorizontal: spacing.pagePadding,
    gap: spacing.innerGapSmall,
    marginBottom: spacing.innerGap,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    backgroundColor: colors.primary,
    borderRadius: radii.answerCard,
    paddingVertical: spacing.innerGap,
    ...shadows.fab,
  },
  actionCardDisabled: { opacity: 0.45 },
  actionCardText: { ...typography.button, color: colors.surface },
  actionOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
  },
  actionOutlineText: { ...typography.bodySmall, color: colors.primary },
  sectionLabel: {
    ...typography.sectionLabel,
    color: colors.textSecondary,
    paddingHorizontal: spacing.pagePadding,
    marginBottom: spacing.innerGapSmall,
  },
  listContent: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sectionGapBottom,
    gap: spacing.cardGap,
  },
  empty: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGap,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGapSmall,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.thumbnail,
    backgroundColor: colors.surfaceMuted,
  },
  pageLabel: { ...typography.cardTitle, color: colors.textPrimary, flex: 1 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.sectionGapBottom,
    paddingVertical: spacing.innerGap,
    borderRadius: radii.circle,
    backgroundColor: colors.primary,
    ...shadows.fab,
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { ...typography.button, color: colors.surface },

  // Merging
  mergingContainer: {
    alignItems: 'center',
    gap: spacing.innerGap,
    marginBottom: spacing.sectionGapBottom,
    paddingVertical: spacing.innerGap,
  },
  mergingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Off-screen view for capturing merged pages
  mergeView: {
    position: 'absolute',
    top: 0,
    left: -9999,
    width: WORKSHEET_MERGE_MAX_WIDTH,
    backgroundColor: colors.surface,
  },
});
