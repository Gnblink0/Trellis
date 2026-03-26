import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList } from '../navigation/types';
import { detectWorksheet } from '../services/adaptApi';
import { registerWorksheetUse, updateRecentTitle } from '../services/recentWorksheets';
import type { SimplifyLevel } from '@trellis/shared';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Process'>;
type Route = RouteProp<RootStackParamList, 'Process'>;

const SIMPLIFY_OPTIONS: { label: string; value: SimplifyLevel }[] = [
  { label: 'Off', value: null },
  { label: 'Grade 1', value: 'G1' },
  { label: 'Grade 2', value: 'G2' },
];

const LOADING_STEPS = [
  'Scanning worksheet...',
  'Detecting text regions...',
  'Mapping content zones...',
  'Almost done...',
];

export default function ProcessScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { imageUri } = route.params;

  const [resolvedUri, setResolvedUri] = useState(imageUri);
  /** Native: wait until the image is copied into app storage before reading for upload. */
  const [persistReady, setPersistReady] = useState(Platform.OS === 'web');
  const worksheetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { uri, id } = await registerWorksheetUse(imageUri);
        if (cancelled) return;
        worksheetIdRef.current = id;
        setResolvedUri(uri);
        setPersistReady(true);
      } catch (e) {
        console.error('[ProcessScreen] registerWorksheetUse', e);
        if (!cancelled) setPersistReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUri]);

  // Toggle state
  const [visualSupport, setVisualSupport] = useState(true);
  const [simplifyLevel, setSimplifyLevel] = useState<SimplifyLevel>('G1');
  const [summarize, setSummarize] = useState(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const hasAtLeastOneToggle = visualSupport || simplifyLevel !== null || summarize;

  const handleProcess = async () => {
    if (!hasAtLeastOneToggle || !persistReady) return;

    setIsProcessing(true);
    setLoadingStep(0);

    // Simulated step progress
    const stepInterval = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 3000);

    try {
      let imageBase64: string;

      if (Platform.OS === 'web') {
        // Web: fetch the blob URI and convert to base64 via FileReader
        const response = await fetch(resolvedUri);
        const blob = await response.blob();
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result); // already "data:image/...;base64,..."
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // Native: compress then read from file system
        const manipulated = await ImageManipulator.manipulateAsync(
          resolvedUri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Check size (4MB limit)
        if (base64.length > 4 * 1024 * 1024) {
          Alert.alert(
            'Image Too Large',
            'The image is too large even after compression. Please take a closer, clearer photo.',
            [{ text: 'OK' }]
          );
          return;
        }

        imageBase64 = `data:image/jpeg;base64,${base64}`;
      }

      // 4. Call detect API
      const result = await detectWorksheet({ imageBase64 });

      if (!result.ok) {
        if (Platform.OS === 'web') {
          window.alert('Detection Failed\n' + result.error.message);
        } else {
          Alert.alert('Detection Failed', result.error.message, [{ text: 'OK' }]);
        }
        return;
      }

      const wid = worksheetIdRef.current;
      if (wid) {
        const label = result.data.blocks[0]?.label?.trim();
        await updateRecentTitle(wid, label || 'Worksheet');
      }

      // 5. Navigate to WorksheetView with detected blocks
      navigation.replace('WorksheetView', {
        blocks: result.data.blocks,
        imageUri: resolvedUri,
        imageBase64,
        toggles: { visualSupport, simplifyLevel, summarize },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      console.error('[ProcessScreen] handleProcess error:', msg, err);
      if (Platform.OS === 'web') {
        window.alert('Error\n' + msg);
      } else {
        Alert.alert('Error', msg, [{ text: 'OK' }]);
      }
    } finally {
      clearInterval(stepInterval);
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Configure Adaptation</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        {/* Image preview */}
        <View style={styles.previewSection}>
          <Image source={{ uri: resolvedUri }} style={styles.previewImage} resizeMode="contain" />
        </View>

        {/* Toggles */}
        <View style={styles.toggleSection}>
          {/* Visual Support */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="image-outline" size={22} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Visual Support</Text>
                <Text style={styles.toggleDesc}>Suggest images for concepts</Text>
              </View>
            </View>
            <Switch
              value={visualSupport}
              onValueChange={setVisualSupport}
              trackColor={{ false: colors.surfaceMuted, true: colors.primaryLight }}
              thumbColor={visualSupport ? colors.primary : colors.textSecondary}
              disabled={isProcessing || !persistReady}
            />
          </View>

          {/* Simplify Level */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="text-outline" size={22} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Simplification Level</Text>
                <Text style={styles.toggleDesc}>Rewrite at a lower reading level</Text>
              </View>
            </View>
          </View>
          <View style={styles.chipRow}>
            {SIMPLIFY_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={[
                  styles.chip,
                  simplifyLevel === opt.value && styles.chipActive,
                ]}
                onPress={() => setSimplifyLevel(opt.value)}
                disabled={isProcessing || !persistReady}
              >
                <Text
                  style={[
                    styles.chipText,
                    simplifyLevel === opt.value && styles.chipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Summarize */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="list-outline" size={22} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Summarize</Text>
                <Text style={styles.toggleDesc}>Condense into max 5 sentences</Text>
              </View>
            </View>
            <Switch
              value={summarize}
              onValueChange={setSummarize}
              trackColor={{ false: colors.surfaceMuted, true: colors.primaryLight }}
              thumbColor={summarize ? colors.primary : colors.textSecondary}
              disabled={isProcessing || !persistReady}
            />
          </View>
        </View>
      </View>

      {/* Process button / Loading */}
      {isProcessing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{LOADING_STEPS[loadingStep]}</Text>
        </View>
      ) : (
        <Pressable
          style={[
            styles.processBtn,
            (!hasAtLeastOneToggle || !persistReady) && styles.processBtnDisabled,
          ]}
          onPress={handleProcess}
          disabled={!hasAtLeastOneToggle || !persistReady}
        >
          <Ionicons name="scan" size={20} color={colors.surface} />
          <Text style={styles.processBtnText}>Detect & Adapt</Text>
        </Pressable>
      )}
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

  content: { flex: 1, paddingHorizontal: spacing.pagePadding },

  // Image preview
  previewSection: {
    alignItems: 'center',
    paddingVertical: spacing.innerGap,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: radii.card,
    backgroundColor: colors.surfaceMuted,
  },

  // Toggles
  toggleSection: {
    marginTop: spacing.innerGap,
    gap: spacing.innerGapSmall,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    flex: 1,
  },
  toggleLabel: { ...typography.cardTitle, color: colors.textPrimary },
  toggleDesc: { ...typography.caption, color: colors.textSecondary },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    marginBottom: spacing.innerGapSmall,
  },
  chip: {
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.surface,
  },

  // Process button
  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    backgroundColor: colors.primary,
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.sectionGapBottom,
    paddingVertical: spacing.innerGap,
    borderRadius: radii.circle,
    ...shadows.fab,
  },
  processBtnDisabled: {
    opacity: 0.4,
  },
  processBtnText: {
    ...typography.button,
    color: colors.surface,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    gap: spacing.innerGap,
    marginBottom: spacing.sectionGapBottom,
    paddingVertical: spacing.innerGap,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
