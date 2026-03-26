import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  LayoutChangeEvent,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList, AdaptedZone } from '../navigation/types';
import ScreenHeader from '../components/ScreenHeader';
import FloatingMarker, { MarkerData } from '../components/FloatingMarker';
import AdaptationPreviewModal from '../components/AdaptationPreviewModal';
import { processWorksheet } from '../services/adaptApi';
import type { DetectedBlock, Toggles } from '@trellis/shared';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorksheetView'>;
type Route = RouteProp<RootStackParamList, 'WorksheetView'>;

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------
type ToolbarAction = 'simplify' | 'visuals' | 'summarize';

const ACTION_META: Record<
  ToolbarAction,
  { label: string; icon: keyof typeof Ionicons.glyphMap; toastText: string }
> = {
  simplify: { label: 'Simplified', icon: 'text', toastText: 'Simplifying passage\u2026' },
  visuals: { label: 'Visuals Added', icon: 'image', toastText: 'Adding visuals\u2026' },
  summarize: { label: 'Summary', icon: 'list', toastText: 'Summarizing\u2026' },
};

// ---------------------------------------------------------------------------
// Zone type (shared between demo & real mode)
// ---------------------------------------------------------------------------
type Zone = {
  id: string;
  label: string;
  rect: { top: number; left: number; width: number; height: number };
};

// ---------------------------------------------------------------------------
// Adaptation data model
// ---------------------------------------------------------------------------
type Adaptation = {
  action: ToolbarAction;
  original: string;
  result: string;
  keywords?: string[];
  visuals?: string[];
  bullets?: string[];
  visualUrl?: string;
};

// ---------------------------------------------------------------------------
// Demo data (backward-compatible, used when no route params)
// ---------------------------------------------------------------------------
type WorksheetPage = {
  image: ReturnType<typeof require>;
  label: string;
  zones: Zone[];
};

const DEMO_PAGES: WorksheetPage[] = [
  {
    image: require('../../assets/worksheet-page-1.png'),
    label: 'Reading',
    zones: [
      { id: 'intro', label: 'Introduction', rect: { top: 5.5, left: 3, width: 94, height: 10 } },
      { id: 'funfact', label: 'Did You Know?', rect: { top: 16, left: 3, width: 94, height: 10 } },
      { id: 'accumulation', label: 'Accumulation', rect: { top: 27, left: 3, width: 46, height: 24 } },
      { id: 'evaporation', label: 'Evaporation', rect: { top: 51, left: 3, width: 46, height: 20 } },
      { id: 'condensation', label: 'Condensation', rect: { top: 71, left: 3, width: 46, height: 12 } },
      { id: 'precipitation', label: 'Precipitation', rect: { top: 27, left: 51, width: 46, height: 56 } },
    ],
  },
];

const DEMO_RESULTS: Record<string, Record<ToolbarAction, Adaptation>> = {
  intro: {
    simplify: { action: 'simplify', original: 'The Earth always has the same amount of water. This water moves through stages, called the water cycle.', result: 'Earth always has the same water. Water moves in a cycle. The Sun helps the water cycle happen.', keywords: ['water', 'cycle', 'Sun', 'Earth'] },
    visuals: { action: 'visuals', original: 'The Earth always has the same amount of water...', result: 'Added visual supports for the introduction.', visuals: ['Earth with water arrows', 'Sun driving the cycle'] },
    summarize: { action: 'summarize', original: 'The Earth always has the same amount of water...', result: 'Key points:', bullets: ['Earth\'s water amount stays the same', 'Water moves in a cycle', 'Sun powers the cycle'] },
  },
  funfact: {
    simplify: { action: 'simplify', original: 'The water you drink today could have been used in a dinosaur\'s bath!', result: 'The water you drink might be the same water dinosaurs used!', keywords: ['water', 'dinosaurs'] },
    visuals: { action: 'visuals', original: 'The water you drink today could have been used in a dinosaur\'s bath!', result: 'Added fun visual for the fact.', visuals: ['Dinosaur with water droplets'] },
    summarize: { action: 'summarize', original: 'The water you drink today could have been used in a dinosaur\'s bath!', result: 'Fun fact:', bullets: ['Water gets reused over millions of years'] },
  },
  accumulation: {
    simplify: { action: 'simplify', original: 'Accumulation is water stored in rivers, lakes, oceans, and in the soil.', result: 'Water collects in rivers, lakes, and oceans. Most water is in oceans. Water in the ground helps plants grow.', keywords: ['rivers', 'lakes', 'oceans', 'groundwater'] },
    visuals: { action: 'visuals', original: 'Accumulation is water stored in rivers, lakes, oceans...', result: 'Added labeled water storage diagram.', visuals: ['Ocean', 'Lake & river', 'Groundwater arrows'] },
    summarize: { action: 'summarize', original: 'Accumulation is water stored in rivers, lakes, oceans...', result: 'Key points about accumulation:', bullets: ['Water stored in rivers, lakes, oceans, soil', 'Oceans hold the most', 'Groundwater feeds plant roots'] },
  },
  evaporation: {
    simplify: { action: 'simplify', original: 'Evaporation happens when the Sun heats up water and turns it into water vapour.', result: 'The Sun heats water and turns it into a gas called water vapour.', keywords: ['Sun', 'heat', 'vapour', 'transpiration'] },
    visuals: { action: 'visuals', original: 'Evaporation happens when the Sun heats up water...', result: 'Added evaporation process visuals.', visuals: ['Heat arrows', 'Transpiration from leaves'] },
    summarize: { action: 'summarize', original: 'Evaporation happens when the Sun heats up water...', result: 'Key points about evaporation:', bullets: ['Sun heats water to gas', 'Water vapour rises into air', 'Plants release water too (transpiration)'] },
  },
  condensation: {
    simplify: { action: 'simplify', original: 'When water vapour is in the air, it cools and turns back to a liquid.', result: 'Water vapour cools down and becomes liquid again. This makes clouds!', keywords: ['cool', 'liquid', 'clouds'] },
    visuals: { action: 'visuals', original: 'When water vapour is in the air, it cools...', result: 'Added condensation diagram.', visuals: ['Cloud formation stages', 'Droplet close-up'] },
    summarize: { action: 'summarize', original: 'When water vapour is in the air, it cools...', result: 'Key points about condensation:', bullets: ['Vapour cools to liquid', 'Forms clouds', 'Water always in air'] },
  },
  precipitation: {
    simplify: { action: 'simplify', original: 'When more water joins the clouds, they get heavy. The water falls back to Earth.', result: 'Clouds get heavy with water and it falls down. This is called precipitation.', keywords: ['rain', 'hail', 'sleet', 'snow'] },
    visuals: { action: 'visuals', original: 'When more water joins the clouds, they get heavy...', result: 'Added precipitation type illustrations.', visuals: ['Rain', 'Snow & hail', 'Water reaching plants'] },
    summarize: { action: 'summarize', original: 'When more water joins the clouds, they get heavy...', result: 'Key points about precipitation:', bullets: ['Heavy clouds release water', '4 types: rain, hail, sleet, snow', 'Gives water to plants & animals'] },
  },
};

// ---------------------------------------------------------------------------
// Helpers: convert DetectedBlock[] to Zone[]
// ---------------------------------------------------------------------------
function blocksToZones(blocks: DetectedBlock[]): Zone[] {
  return blocks.map((b) => ({
    id: b.blockId,
    label: b.label,
    rect: b.rect,
  }));
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const IMAGE_ASPECT = 595 / 842;

export default function WorksheetViewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  // Determine mode: real API vs demo
  const params = route.params;
  const isRealMode = !!params?.blocks;

  // Build zones & image source from params or demo data
  const zones: Zone[] = isRealMode
    ? blocksToZones(params!.blocks)
    : DEMO_PAGES[0].zones;

  const imageSource = isRealMode
    ? { uri: params!.imageUri }
    : DEMO_PAGES[0].image;

  const worksheetTitle = isRealMode ? 'Worksheet' : 'The Water Cycle';

  // Keep a lookup from blockId -> DetectedBlock for original text
  const blockLookup = isRealMode
    ? Object.fromEntries(params!.blocks.map((b) => [b.blockId, b]))
    : null;

  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<ToolbarAction>('simplify');
  const [showToolbar, setShowToolbar] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [adaptedZones, setAdaptedZones] = useState<Record<string, Record<ToolbarAction, Adaptation>>>({});
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [previewAdaptation, setPreviewAdaptation] = useState<Adaptation | null>(null);

  const toolbarAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(toolbarAnim, {
      toValue: showToolbar ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [showToolbar]);

  const handleImageLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setImageSize({ width, height: width / IMAGE_ASPECT });
  };

  const handleZoneTap = (id: string) => {
    if (selectedZone === id) {
      setShowToolbar(!showToolbar);
    } else {
      setSelectedZone(id);
      setShowToolbar(true);
    }
  };

  const handleAction = async (action: ToolbarAction) => {
    if (!selectedZone) return;

    setCurrentAction(action);
    setShowToolbar(false);
    setIsProcessing(true);

    // Show toast
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    try {
      let adaptation: Adaptation | null = null;

      if (isRealMode) {
        // Build toggles for this specific action
        const actionToggles: Toggles = {
          simplifyLevel: action === 'simplify' ? (params!.toggles.simplifyLevel ?? 'G1') : null,
          visualSupport: action === 'visuals',
          summarize: action === 'summarize',
        };

        // Pass original text so server prompt can match the exact block
        const originalText = blockLookup?.[selectedZone]?.originalText ?? '';
        const result = await processWorksheet({
          imageBase64: params!.imageBase64,
          toggles: actionToggles,
          selectedBlockIds: [selectedZone],
          selectedBlockTexts: { [selectedZone]: originalText },
          options: { summaryMaxSentences: 5, language: 'en' },
        });

        // Hide toast
        Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();

        if (!result.ok) {
          const msg = result.error.message;
          if (Platform.OS === 'web') {
            window.alert('Adaptation Failed\n' + msg);
          } else {
            Alert.alert('Adaptation Failed', msg, [{ text: 'OK' }]);
          }
          setIsProcessing(false);
          return;
        }

        // Convert API response to Adaptation format
        const block = result.data.blocks.find((b) => b.blockId === selectedZone);
        const summary = result.data.summary;

        if (action === 'simplify' && block) {
          adaptation = {
            action: 'simplify',
            original: originalText,
            result: block.simplifiedText ?? originalText,
            keywords: block.keywords,
            visualUrl: block.visualUrl ?? undefined,
          };
        } else if (action === 'visuals' && block) {
          adaptation = {
            action: 'visuals',
            original: originalText,
            result: block.visualHint ?? 'Visual support added.',
            visuals: block.visualHint ? [block.visualHint] : [],
            visualUrl: block.visualUrl ?? undefined,
          };
        } else if (action === 'summarize' && summary) {
          adaptation = {
            action: 'summarize',
            original: originalText,
            result: 'Summary:',
            bullets: summary.sentences,
          };
        }
      } else {
        // Demo mode: use mock results with a short delay
        await new Promise((r) => setTimeout(r, 1400));
        Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();

        adaptation =
          DEMO_RESULTS[selectedZone]?.[action] ?? null;
      }

      setIsProcessing(false);

      if (adaptation) {
        setPreviewAdaptation(adaptation);
        setShowPreview(true);
      }
    } catch (err) {
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      setIsProcessing(false);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      if (Platform.OS === 'web') {
        window.alert('Error\n' + msg);
      } else {
        Alert.alert('Error', msg, [{ text: 'OK' }]);
      }
    }
  };

  const handleApplyAdaptation = () => {
    if (selectedZone && previewAdaptation) {
      setAdaptedZones((prev) => ({
        ...prev,
        [selectedZone]: {
          ...(prev[selectedZone] || {}),
          [currentAction]: previewAdaptation,
        },
      }));
    }
    setShowPreview(false);
    setPreviewAdaptation(null);
    setShowToolbar(true);
  };

  const handleRegenerateAdaptation = () => {
    setShowPreview(false);
    setPreviewAdaptation(null);
    // Re-trigger the same action
    handleAction(currentAction);
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewAdaptation(null);
    setShowToolbar(true);
  };

  // Convert adaptedZones to markers
  const markers: MarkerData[] = Object.entries(adaptedZones)
    .flatMap(([zoneId, adaptations]) => {
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return [];

      return Object.values(adaptations).map((adaptation, index) => ({
        id: `${zoneId}-${adaptation.action}`,
        type: adaptation.action,
        label: zone.label,
        position: {
          x: zone.rect.left + zone.rect.width / 2 + (index * 3),
          y: zone.rect.top + zone.rect.height / 2 + (index * 3),
        },
        content: {
          original: adaptation.original,
          result: adaptation.result,
          keywords: adaptation.keywords,
          bullets: adaptation.bullets,
          visuals: adaptation.visuals,
        },
      }));
    });

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={worksheetTitle} />

      <View style={styles.content}>
        <View style={styles.worksheetArea}>
          <ScrollView
            style={styles.worksheetScroll}
            contentContainerStyle={styles.worksheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageWrapper} onLayout={handleImageLayout}>
              <Image
                source={imageSource}
                style={[
                  styles.worksheetImage,
                  imageSize.height > 0 && { height: imageSize.height },
                ]}
                resizeMode="contain"
              />

              {/* Tappable overlay zones */}
              {imageSize.width > 0 &&
                zones.map((zone) => {
                  const isSelected = selectedZone === zone.id;
                  return (
                    <Pressable
                      key={zone.id}
                      style={[
                        styles.zone,
                        {
                          top: `${zone.rect.top}%`,
                          left: `${zone.rect.left}%`,
                          width: `${zone.rect.width}%`,
                          height: `${zone.rect.height}%`,
                        },
                        isSelected && styles.zoneSelected,
                      ]}
                      onPress={() => handleZoneTap(zone.id)}
                    />
                  );
                })}

              {/* Floating markers for adapted zones */}
              {imageSize.width > 0 &&
                markers.map((marker) => (
                  <FloatingMarker
                    key={marker.id}
                    marker={marker}
                    worksheetWidth={imageSize.width}
                    worksheetHeight={imageSize.height}
                  />
                ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Floating action toolbar for zone adaptations */}
      <Animated.View
        style={[
          styles.actionToolbar,
          {
            opacity: toolbarAnim,
            transform: [
              { translateY: toolbarAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              { scale: toolbarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          },
        ]}
        pointerEvents={showToolbar ? 'auto' : 'none'}
      >
        <Pressable
          style={[
            styles.actionToolbarItem,
            selectedZone && adaptedZones[selectedZone]?.simplify && styles.actionToolbarItemDisabled
          ]}
          onPress={() => handleAction('simplify')}
          disabled={isProcessing || !!(selectedZone && adaptedZones[selectedZone]?.simplify)}
        >
          <Ionicons name="text" size={20} color={colors.surface} />
          <Text style={styles.actionToolbarLabel}>Simplify</Text>
          {selectedZone && adaptedZones[selectedZone]?.simplify && (
            <Ionicons name="checkmark-circle" size={16} color={colors.surface} />
          )}
        </Pressable>
        <View style={styles.actionToolbarDivider} />
        <Pressable
          style={[
            styles.actionToolbarItem,
            selectedZone && adaptedZones[selectedZone]?.visuals && styles.actionToolbarItemDisabled
          ]}
          onPress={() => handleAction('visuals')}
          disabled={isProcessing || !!(selectedZone && adaptedZones[selectedZone]?.visuals)}
        >
          <Ionicons name="image" size={20} color={colors.surface} />
          <Text style={styles.actionToolbarLabel}>Add Visuals</Text>
          {selectedZone && adaptedZones[selectedZone]?.visuals && (
            <Ionicons name="checkmark-circle" size={16} color={colors.surface} />
          )}
        </Pressable>
        <View style={styles.actionToolbarDivider} />
        <Pressable
          style={[
            styles.actionToolbarItem,
            selectedZone && adaptedZones[selectedZone]?.summarize && styles.actionToolbarItemDisabled
          ]}
          onPress={() => handleAction('summarize')}
          disabled={isProcessing || !!(selectedZone && adaptedZones[selectedZone]?.summarize)}
        >
          <Ionicons name="list" size={20} color={colors.surface} />
          <Text style={styles.actionToolbarLabel}>Summarize</Text>
          {selectedZone && adaptedZones[selectedZone]?.summarize && (
            <Ionicons name="checkmark-circle" size={16} color={colors.surface} />
          )}
        </Pressable>
      </Animated.View>

      {/* Processing toast */}
      <Animated.View style={[styles.toast, { opacity: toastAnim }]} pointerEvents="none">
        {isProcessing ? (
          <ActivityIndicator size="small" color={colors.surface} />
        ) : (
          <Ionicons name="hourglass" size={16} color={colors.surface} />
        )}
        <Text style={styles.toastText}>{ACTION_META[currentAction].toastText}</Text>
      </Animated.View>

      {/* Bottom hint bar */}
      <View style={styles.hintBar}>
        <Ionicons name="finger-print" size={16} color={colors.textSecondary} />
        <Text style={styles.hintText}>
          Tap zones to adapt \u2022 Tap markers to view details
        </Text>
      </View>

      {/* Bottom action button */}
      <Pressable
        style={styles.fab}
        onPress={() => {
          if (Object.keys(adaptedZones).length === 0) {
            if (Platform.OS === 'web') {
              window.alert('Please adapt at least one section before handing to student.');
            } else {
              Alert.alert('No Adaptations', 'Please adapt at least one section before handing to student.', [{ text: 'OK' }]);
            }
            return;
          }

          const zoneLabelMap: Record<string, string> = {};
          zones.forEach((z) => { zoneLabelMap[z.id] = z.label; });

          const adapted: AdaptedZone[] = Object.entries(adaptedZones).flatMap(
            ([zoneId, adaptations]) =>
              Object.values(adaptations).map((adapt) => ({
                zoneId,
                zoneLabel: zoneLabelMap[zoneId] ?? zoneId,
                action: adapt.action,
                original: adapt.original,
                result: adapt.result,
                keywords: adapt.keywords,
                bullets: adapt.bullets,
                visuals: adapt.visuals,
                visualUrl: adapt.visualUrl,
              })),
          );

          navigation.navigate('StudentView', {
            title: worksheetTitle,
            adaptations: adapted,
            imageUri: isRealMode ? params!.imageUri : undefined,
          });
        }}
      >
        <Ionicons name="school" size={20} color={colors.surface} />
        <Text style={styles.fabText}>Hand to Student</Text>
      </Pressable>

      {/* Preview Modal */}
      <AdaptationPreviewModal
        visible={showPreview}
        zoneLabel={
          selectedZone
            ? zones.find((z) => z.id === selectedZone)?.label ?? selectedZone
            : ''
        }
        adaptation={previewAdaptation}
        onApply={handleApplyAdaptation}
        onRegenerate={handleRegenerateAdaptation}
        onCancel={handleCancelPreview}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, flexDirection: 'row' },

  // Worksheet image area
  worksheetArea: {
    flex: 1,
    paddingHorizontal: spacing.pagePadding,
  },

  worksheetScroll: { flex: 1 },
  worksheetScrollContent: { paddingBottom: 100 },
  imageWrapper: { position: 'relative' },
  worksheetImage: {
    width: '100%',
    borderRadius: radii.chip,
  },

  // Overlay zones
  zone: {
    position: 'absolute',
    borderRadius: radii.chip,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  zoneSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}20`,
  },

  // Action toolbar (for zone adaptations)
  actionToolbar: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.toolbarBg,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    ...shadows.floatingToolbar,
  },
  actionToolbarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
  },
  actionToolbarItemDisabled: {
    opacity: 0.5,
  },
  actionToolbarLabel: { ...typography.bodySmall, color: colors.surface },
  actionToolbarDivider: { width: 1, height: 20, backgroundColor: '#FFFFFF33' },

  // Toast
  toast: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.toolbarBg,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
    ...shadows.floatingToolbar,
  },
  toastText: { ...typography.bodySmall, color: colors.surface },

  // Hint bar
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
    backgroundColor: colors.surfaceMuted,
  },
  hintText: { ...typography.caption, color: colors.textSecondary },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
    ...shadows.fab,
  },
  fabText: { ...typography.cardTitle, color: colors.surface },
});
