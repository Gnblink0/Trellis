import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { processWorksheet, scanImageOcr } from '../services/adaptApi';
import { setStudentViewData } from '../services/studentViewStore';
import type { DetectedBlock, Toggles, OcrScanResponse } from '@trellis/shared';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorksheetView'>;
type Route = RouteProp<RootStackParamList, 'WorksheetView'>;

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------
type ToolbarAction = 'simplify' | 'visuals' | 'summarize';

const ACTION_META: Record<
  ToolbarAction,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  simplify: { label: 'Simplified', icon: 'text' },
  visuals: { label: 'Visuals Added', icon: 'image' },
  summarize: { label: 'Summary', icon: 'list' },
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
// Adaptation data model — now includes state
// ---------------------------------------------------------------------------
type Adaptation = {
  action: ToolbarAction;
  state: 'loading' | 'ready' | 'reviewed' | 'error';
  original: string;
  result: string;
  keywords?: string[];
  visuals?: string[];
  bullets?: string[];
  visualUrl?: string;
  errorMessage?: string;
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

const DEMO_RESULTS: Record<string, Record<ToolbarAction, Omit<Adaptation, 'state'>>> = {
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
// Helper: find which zone the selected OCR words overlap with most
// ---------------------------------------------------------------------------
function findZoneForSelection(
  words: { bbox: { left: number; top: number; width: number; height: number } }[],
  lo: number,
  hi: number,
  zones: Zone[],
): string | null {
  const slice = words.slice(lo, hi + 1);
  if (slice.length === 0) return null;
  let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
  for (const w of slice) {
    minL = Math.min(minL, w.bbox.left * 100);
    minT = Math.min(minT, w.bbox.top * 100);
    maxR = Math.max(maxR, (w.bbox.left + w.bbox.width) * 100);
    maxB = Math.max(maxB, (w.bbox.top + w.bbox.height) * 100);
  }
  let bestId: string | null = null;
  let bestArea = 0;
  for (const z of zones) {
    const oL = Math.max(minL, z.rect.left);
    const oT = Math.max(minT, z.rect.top);
    const oR = Math.min(maxR, z.rect.left + z.rect.width);
    const oB = Math.min(maxB, z.rect.top + z.rect.height);
    if (oL < oR && oT < oB) {
      const area = (oR - oL) * (oB - oT);
      if (area > bestArea) { bestArea = area; bestId = z.id; }
    }
  }
  return bestId;
}

// ---------------------------------------------------------------------------
// Word overlay sub-component (real mode: OCR word-level selection)
// ---------------------------------------------------------------------------
function WordOverlay({
  ocr,
  range,
  onWordPress,
  onWordLongPress,
}: {
  ocr: OcrScanResponse;
  range: { a: number; b: number } | null;
  onWordPress: (i: number) => void;
  onWordLongPress: (i: number) => void;
}) {
  const selected = (i: number) =>
    range !== null && i >= Math.min(range.a, range.b) && i <= Math.max(range.a, range.b);

  return (
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
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const DEMO_IMAGE_ASPECT = 595 / 842;

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
  const [showToolbar, setShowToolbar] = useState(false);
  const [adaptedZones, setAdaptedZones] = useState<Record<string, Partial<Record<ToolbarAction, Adaptation>>>>({});

  // Track which marker opened the preview modal
  const [previewMarkerId, setPreviewMarkerId] = useState<{ zoneId: string; action: ToolbarAction } | null>(null);

  // Unmount guard for async callbacks
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // ── Image sizing (nullable aspect prevents Infinity height crash) ──
  const [imageAspect, setImageAspect] = useState<number | null>(isRealMode ? null : DEMO_IMAGE_ASPECT);
  const [containerWidth, setContainerWidth] = useState(0);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!isRealMode) { setImageAspect(DEMO_IMAGE_ASPECT); return; }
    Image.getSize(
      params!.imageUri,
      (w, h) => setImageAspect(w > 0 && h > 0 ? w / h : DEMO_IMAGE_ASPECT),
      () => setImageAspect(DEMO_IMAGE_ASPECT),
    );
  }, [isRealMode, params]);

  const handleImageLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  useEffect(() => {
    if (containerWidth > 0 && imageAspect != null && imageAspect > 0) {
      setImageSize({ width: containerWidth, height: containerWidth / imageAspect });
    }
  }, [imageAspect, containerWidth]);

  // Preview modal state — derived from previewMarkerId
  const showPreview = previewMarkerId !== null;
  const previewAdaptation = useMemo(() => {
    if (!previewMarkerId) return null;
    return adaptedZones[previewMarkerId.zoneId]?.[previewMarkerId.action] ?? null;
  }, [previewMarkerId, adaptedZones]);

  const toolbarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(toolbarAnim, {
      toValue: showToolbar ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [showToolbar]);

  // ── OCR state (real mode: scan for word-level selection) ──
  const [ocrData, setOcrData] = useState<OcrScanResponse | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  useEffect(() => {
    if (!isRealMode) return;
    let cancelled = false;
    setOcrLoading(true);
    void (async () => {
      const res = await scanImageOcr(params!.imageBase64);
      if (cancelled) return;
      if (res.ok) setOcrData(res.data);
      setOcrLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isRealMode, params]);

  // ── Word selection (real mode only) ──
  const [wordRange, setWordRange] = useState<{ a: number; b: number } | null>(null);

  const selectedText = useMemo(() => {
    if (!ocrData || !wordRange) return '';
    const lo = Math.min(wordRange.a, wordRange.b);
    const hi = Math.max(wordRange.a, wordRange.b);
    return ocrData.words.slice(lo, hi + 1).map((w) => w.text).join(' ').trim();
  }, [ocrData, wordRange]);

  const handleWordPress = useCallback((i: number) => {
    setWordRange((prev) => {
      if (!prev) return { a: i, b: i };
      return { a: Math.min(prev.a, prev.b, i), b: Math.max(prev.a, prev.b, i) };
    });
  }, []);

  const handleWordLongPress = useCallback((i: number) => {
    setWordRange({ a: i, b: i });
  }, []);

  const clearWordSelection = useCallback(() => {
    setWordRange(null);
    setSelectedZone(null);
    setShowToolbar(false);
  }, []);

  // Auto-detect zone from word selection (real mode)
  useEffect(() => {
    if (!isRealMode || !ocrData || !wordRange) return;
    const lo = Math.min(wordRange.a, wordRange.b);
    const hi = Math.max(wordRange.a, wordRange.b);
    const zoneId = findZoneForSelection(ocrData.words, lo, hi, zones);
    if (zoneId) {
      setSelectedZone(zoneId);
      setShowToolbar(true);
    } else if (zones.length > 0) {
      // Fallback: use first zone if no overlap found
      setSelectedZone(zones[0].id);
      setShowToolbar(true);
    }
  }, [wordRange, ocrData, zones, isRealMode]);

  const handleZoneTap = (id: string) => {
    if (selectedZone === id) {
      setShowToolbar(!showToolbar);
    } else {
      setSelectedZone(id);
      setShowToolbar(true);
    }
  };

  // ── Fire-and-forget adaptation request ──
  const fireAdaptationRequest = useCallback((
    zoneId: string,
    action: ToolbarAction,
    originalText: string,
  ) => {
    if (isRealMode) {
      const actionToggles: Toggles = {
        simplifyLevel: action === 'simplify' ? (params!.toggles.simplifyLevel ?? 'G1') : null,
        visualSupport: action === 'visuals',
        summarize: action === 'summarize',
      };

      processWorksheet({
        imageBase64: params!.imageBase64,
        toggles: actionToggles,
        selectedBlockIds: [zoneId],
        selectedBlockTexts: { [zoneId]: originalText },
        options: { summaryMaxSentences: 5, language: 'en' },
      }).then((result) => {
        if (!mountedRef.current) return;

        if (result.ok === false) {
          // Error: remove the loading marker (re-enable button)
          setAdaptedZones((prev) => {
            const zoneAdapts = { ...(prev[zoneId] || {}) };
            delete zoneAdapts[action];
            if (Object.keys(zoneAdapts).length === 0) {
              const { [zoneId]: _, ...rest } = prev;
              return rest;
            }
            return { ...prev, [zoneId]: zoneAdapts };
          });
          const msg = result.error.message;
          if (Platform.OS === 'web') {
            window.alert('Adaptation Failed\n' + msg);
          } else {
            Alert.alert('Adaptation Failed', msg, [{ text: 'OK' }]);
          }
          return;
        }

        // Success: update marker to "ready"
        const block = result.data.blocks.find((b) => b.blockId === zoneId);
        const summary = result.data.summary;

        let readyData: Partial<Adaptation> = {};
        if (action === 'simplify' && block) {
          readyData = {
            result: block.simplifiedText ?? originalText,
            keywords: block.keywords,
            visualUrl: block.visualUrl ?? undefined,
          };
        } else if (action === 'visuals' && block) {
          readyData = {
            result: block.visualHint ?? 'Visual support added.',
            visuals: block.visualHint ? [block.visualHint] : [],
            visualUrl: block.visualUrl ?? undefined,
          };
        } else if (action === 'summarize' && summary) {
          readyData = {
            result: 'Summary:',
            bullets: summary.sentences,
          };
        }

        setAdaptedZones((prev) => ({
          ...prev,
          [zoneId]: {
            ...(prev[zoneId] || {}),
            [action]: {
              ...(prev[zoneId]?.[action]),
              ...readyData,
              state: 'ready',
            },
          },
        }));
      }).catch((err) => {
        if (!mountedRef.current) return;
        // Error: remove the loading marker
        setAdaptedZones((prev) => {
          const zoneAdapts = { ...(prev[zoneId] || {}) };
          delete zoneAdapts[action];
          if (Object.keys(zoneAdapts).length === 0) {
            const { [zoneId]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [zoneId]: zoneAdapts };
        });
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
        if (Platform.OS === 'web') {
          window.alert('Error\n' + msg);
        } else {
          Alert.alert('Error', msg, [{ text: 'OK' }]);
        }
      });
    } else {
      // Demo mode: simulate delay then mark ready
      const delay = 1400 + Math.random() * 1000;
      setTimeout(() => {
        if (!mountedRef.current) return;
        const demoResult = DEMO_RESULTS[zoneId]?.[action];
        if (demoResult) {
          setAdaptedZones((prev) => ({
            ...prev,
            [zoneId]: {
              ...(prev[zoneId] || {}),
              [action]: { ...demoResult, state: 'ready' },
            },
          }));
        } else {
          // No demo data: remove marker
          setAdaptedZones((prev) => {
            const zoneAdapts = { ...(prev[zoneId] || {}) };
            delete zoneAdapts[action];
            if (Object.keys(zoneAdapts).length === 0) {
              const { [zoneId]: _, ...rest } = prev;
              return rest;
            }
            return { ...prev, [zoneId]: zoneAdapts };
          });
        }
      }, delay);
    }
  }, [isRealMode, params]);

  const handleAction = (action: ToolbarAction) => {
    if (!selectedZone) return;

    // Capture text before closing toolbar
    const originalText = isRealMode
      ? (selectedText || (blockLookup?.[selectedZone]?.originalText ?? ''))
      : (DEMO_RESULTS[selectedZone]?.[action]?.original ?? '');

    // Immediately create a loading adaptation
    setAdaptedZones((prev) => ({
      ...prev,
      [selectedZone]: {
        ...(prev[selectedZone] || {}),
        [action]: {
          action,
          state: 'loading',
          original: originalText,
          result: '',
        } as Adaptation,
      },
    }));

    // Hide toolbar and clear word highlight so it doesn't block next selection
    setShowToolbar(false);
    setWordRange(null);

    // Fire async request (no await)
    fireAdaptationRequest(selectedZone, action, originalText);
  };

  // ── Marker press handler (opens preview for "ready" markers) ──
  const handleMarkerPress = useCallback((marker: MarkerData) => {
    if (marker.state !== 'ready') return;
    // Parse zoneId and action from marker id ("zoneId-action")
    const lastDash = marker.id.lastIndexOf('-');
    const zoneId = marker.id.slice(0, lastDash);
    const action = marker.id.slice(lastDash + 1) as ToolbarAction;
    setPreviewMarkerId({ zoneId, action });
  }, []);

  const handleApplyAdaptation = () => {
    if (!previewMarkerId) return;
    const { zoneId, action } = previewMarkerId;
    // Mark as reviewed
    setAdaptedZones((prev) => ({
      ...prev,
      [zoneId]: {
        ...(prev[zoneId] || {}),
        [action]: {
          ...(prev[zoneId]?.[action]),
          state: 'reviewed',
        },
      },
    }));
    setPreviewMarkerId(null);
    if (isRealMode) {
      clearWordSelection();
    }
  };

  const handleRegenerateAdaptation = () => {
    if (!previewMarkerId) return;
    const { zoneId, action } = previewMarkerId;
    const existing = adaptedZones[zoneId]?.[action];
    const originalText = existing?.original ?? '';

    // Reset to loading
    setAdaptedZones((prev) => ({
      ...prev,
      [zoneId]: {
        ...(prev[zoneId] || {}),
        [action]: {
          action,
          state: 'loading',
          original: originalText,
          result: '',
        } as Adaptation,
      },
    }));
    setPreviewMarkerId(null);

    // Re-fire API
    fireAdaptationRequest(zoneId, action, originalText);
  };

  const handleCancelPreview = () => {
    setPreviewMarkerId(null);
  };

  // ── Helper: get adaptation state for a zone+action ──
  const getAdaptState = (zoneId: string, action: ToolbarAction): Adaptation['state'] | null => {
    return adaptedZones[zoneId]?.[action]?.state ?? null;
  };

  // ── Toolbar button disabled logic ──
  const isButtonDisabled = (action: ToolbarAction): boolean => {
    if (!selectedZone) return true;
    const state = getAdaptState(selectedZone, action);
    // Disabled for any non-null state (loading, ready, reviewed) — only error re-enables
    return state !== null;
  };

  // ── Toolbar button status icon ──
  const renderButtonStatus = (action: ToolbarAction) => {
    if (!selectedZone) return null;
    const state = getAdaptState(selectedZone, action);
    if (state === 'loading') return <ActivityIndicator size={14} color={colors.surface} />;
    if (state === 'ready') return <Ionicons name="alert-circle" size={16} color={colors.markerNotification} />;
    if (state === 'reviewed') return <Ionicons name="checkmark-circle" size={16} color={colors.surface} />;
    return null;
  };

  // ── Count markers by state for "Hand to Student" gating ──
  const stateCounts = useMemo(() => {
    let loading = 0;
    let ready = 0;
    let reviewed = 0;
    Object.values(adaptedZones).forEach((actions) => {
      Object.values(actions).forEach((a) => {
        if (!a) return;
        if (a.state === 'loading') loading++;
        else if (a.state === 'ready') ready++;
        else if (a.state === 'reviewed') reviewed++;
      });
    });
    return { loading, ready, reviewed };
  }, [adaptedZones]);

  // Convert adaptedZones to markers — filter out error, set content null for loading
  const markers: MarkerData[] = Object.entries(adaptedZones)
    .flatMap(([zoneId, adaptations]) => {
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return [];

      return Object.values(adaptations)
        .filter((a): a is Adaptation => a != null && a.state !== 'error')
        .map((adaptation, index) => ({
          id: `${zoneId}-${adaptation.action}`,
          type: adaptation.action,
          label: zone.label,
          state: adaptation.state as MarkerData['state'],
          position: {
            x: zone.rect.left + zone.rect.width / 2 + (index * 3),
            y: zone.rect.top + zone.rect.height / 2 + (index * 3),
          },
          content: adaptation.state === 'loading'
            ? null
            : {
                original: adaptation.original,
                result: adaptation.result,
                keywords: adaptation.keywords,
                bullets: adaptation.bullets,
                visuals: adaptation.visuals,
                visualUrl: adaptation.visualUrl,
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

              {/* Real mode: OCR word overlay for text selection */}
              {isRealMode && imageSize.width > 0 && ocrData && ocrData.words.length > 0 && (
                <WordOverlay
                  ocr={ocrData}
                  range={wordRange}
                  onWordPress={handleWordPress}
                  onWordLongPress={handleWordLongPress}
                />
              )}

              {/* Real mode: OCR loading badge */}
              {isRealMode && ocrLoading && (
                <View style={styles.ocrLoadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.ocrLoadingText}>Loading text\u2026</Text>
                </View>
              )}

              {/* Demo mode: tappable overlay zones */}
              {!isRealMode && imageSize.width > 0 &&
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
                    onPress={handleMarkerPress}
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
        {isRealMode && wordRange && (
          <>
            <Pressable style={styles.actionToolbarItem} onPress={clearWordSelection}>
              <Ionicons name="close" size={18} color={colors.surface} />
              <Text style={styles.actionToolbarLabel}>Clear</Text>
            </Pressable>
            <View style={styles.actionToolbarDivider} />
          </>
        )}
        <Pressable
          style={[
            styles.actionToolbarItem,
            isButtonDisabled('simplify') && styles.actionToolbarItemDisabled,
          ]}
          onPress={() => handleAction('simplify')}
          disabled={isButtonDisabled('simplify')}
        >
          <Ionicons name="text" size={20} color={colors.surface} />
          <Text style={styles.actionToolbarLabel}>Simplify</Text>
          {renderButtonStatus('simplify')}
        </Pressable>
        <View style={styles.actionToolbarDivider} />
        <Pressable
          style={[
            styles.actionToolbarItem,
            isButtonDisabled('visuals') && styles.actionToolbarItemDisabled,
          ]}
          onPress={() => handleAction('visuals')}
          disabled={isButtonDisabled('visuals')}
        >
          <Ionicons name="image" size={20} color={colors.surface} />
          <Text style={styles.actionToolbarLabel}>Add Visuals</Text>
          {renderButtonStatus('visuals')}
        </Pressable>
        <View style={styles.actionToolbarDivider} />
        <Pressable
          style={[
            styles.actionToolbarItem,
            isButtonDisabled('summarize') && styles.actionToolbarItemDisabled,
          ]}
          onPress={() => handleAction('summarize')}
          disabled={isButtonDisabled('summarize')}
        >
          <Ionicons name="list" size={20} color={colors.surface} />
          <Text style={styles.actionToolbarLabel}>Summarize</Text>
          {renderButtonStatus('summarize')}
        </Pressable>
      </Animated.View>

      {/* Bottom hint bar */}
      <View style={styles.hintBar}>
        <Ionicons name="finger-print" size={16} color={colors.textSecondary} />
        <Text style={styles.hintText}>
          {isRealMode
            ? 'Tap words to select \u2022 Long-press to restart \u2022 Pick an action'
            : 'Tap zones to adapt \u2022 Tap markers to view details'}
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

          // Gate: still processing
          if (stateCounts.loading > 0) {
            const msg = `${stateCounts.loading} adaptation${stateCounts.loading > 1 ? 's are' : ' is'} still processing. Please wait.`;
            if (Platform.OS === 'web') {
              window.alert(msg);
            } else {
              Alert.alert('Still Processing', msg, [{ text: 'OK' }]);
            }
            return;
          }

          // Gate: needs review
          if (stateCounts.ready > 0) {
            const msg = `${stateCounts.ready} adaptation${stateCounts.ready > 1 ? 's need' : ' needs'} review. Tap the notification dots on markers to review.`;
            if (Platform.OS === 'web') {
              window.alert(msg);
            } else {
              Alert.alert('Review Needed', msg, [{ text: 'OK' }]);
            }
            return;
          }

          const zoneLabelMap: Record<string, string> = {};
          zones.forEach((z) => { zoneLabelMap[z.id] = z.label; });

          const adapted: AdaptedZone[] = Object.entries(adaptedZones).flatMap(
            ([zoneId, adaptations]) => {
              const zone = zones.find((z) => z.id === zoneId);
              return Object.values(adaptations)
                .filter((a): a is Adaptation => a != null && a.state === 'reviewed')
                .map((adapt) => ({
                  zoneId,
                  zoneLabel: zoneLabelMap[zoneId] ?? zoneId,
                  action: adapt.action,
                  original: adapt.original,
                  result: adapt.result,
                  keywords: adapt.keywords,
                  bullets: adapt.bullets,
                  visuals: adapt.visuals,
                  visualUrl: adapt.visualUrl,
                  rect: zone?.rect,
                }));
            },
          );

          // Store large data (base64 visualUrls) outside nav params to avoid serialisation crash
          setStudentViewData({
            title: worksheetTitle,
            adaptations: adapted,
            imageUri: isRealMode ? params!.imageUri : undefined,
          });
          navigation.navigate('StudentView');
        }}
      >
        <Ionicons name="school" size={20} color={colors.surface} />
        <Text style={styles.fabText}>Hand to Student</Text>
      </Pressable>

      {/* Preview Modal */}
      <AdaptationPreviewModal
        visible={showPreview}
        zoneLabel={
          previewMarkerId
            ? zones.find((z) => z.id === previewMarkerId.zoneId)?.label ?? previewMarkerId.zoneId
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

  // OCR word overlays (real mode)
  wordLayer: { zIndex: 2 },
  wordHit: { position: 'absolute' },
  wordHighlight: {
    backgroundColor: colors.selectionHighlight,
    opacity: 0.42,
  },
  ocrLoadingOverlay: {
    position: 'absolute',
    top: spacing.innerGapSmall,
    right: spacing.innerGapSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.innerGapSmall,
    paddingVertical: 2,
    opacity: 0.85,
  },
  ocrLoadingText: { ...typography.caption, color: colors.textSecondary },

  // Overlay zones (demo mode)
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
