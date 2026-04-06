import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  LayoutChangeEvent,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList, AdaptedZone } from '../navigation/types';
import ScreenHeader from '../components/ScreenHeader';
import DrawingCanvas from '../components/DrawingCanvas';
import type { DrawingTool, DrawingData } from '../components/DrawingCanvas';
import DrawingToolbar from '../components/DrawingToolbar';
import FloatingMarker, { MarkerData } from '../components/FloatingMarker';
import { consumeStudentViewData } from '../services/studentViewStore';
import { saveSession, loadSession, deleteSession } from '../services/worksheetSessionStore';
import { deleteWorksheet } from '../services/recentWorksheets';

// Native-only imports (captureRef, Sharing)
let captureRef: any = null;
let Sharing: any = null;
if (Platform.OS !== 'web') {
  try {
    captureRef = require('react-native-view-shot').captureRef;
  } catch {
    // react-native-view-shot unavailable — export disabled
  }
  try {
    Sharing = require('expo-sharing');
  } catch {
    // expo-sharing unavailable
  }
}


// ---------------------------------------------------------------------------
// Pages (same images as teacher view)
// ---------------------------------------------------------------------------
type PageDef = {
  image: ReturnType<typeof require>;
  label: string;
  /** Zones where students can type answers (question pages) */
  inputZones?: {
    id: string;
    placeholder: string;
    rect: { top: number; left: number; width: number; height: number };
    multiline?: boolean;
  }[];
};

const PAGES: PageDef[] = [
  { image: require('../../assets/worksheet-page-1.png'), label: 'Reading' },
  { image: require('../../assets/worksheet-page-2.png'), label: 'Answers' },
  {
    image: require('../../assets/worksheet-page-3.png'),
    label: 'Questions',
    inputZones: [
      { id: 'a3_1', placeholder: '1.', rect: { top: 51, left: 8, width: 60, height: 3 } },
      { id: 'a3_2', placeholder: '2.', rect: { top: 55, left: 8, width: 60, height: 3 } },
      { id: 'a3_3', placeholder: '3.', rect: { top: 59, left: 8, width: 60, height: 3 } },
      { id: 'a3_4', placeholder: '4.', rect: { top: 63, left: 8, width: 60, height: 3 } },
      { id: 'a4', placeholder: 'Answer Q4...', rect: { top: 70, left: 5, width: 88, height: 4 }, multiline: true },
      { id: 'a5', placeholder: 'Answer Q5...', rect: { top: 77, left: 5, width: 88, height: 6 }, multiline: true },
      { id: 'a6', placeholder: 'Answer Q6...', rect: { top: 87, left: 5, width: 88, height: 6 }, multiline: true },
    ],
  },
];

const DEMO_IMAGE_ASPECT = 595 / 842; // fallback for bundled demo worksheet

// ---------------------------------------------------------------------------
// Main student screen
// ---------------------------------------------------------------------------
type Nav = NativeStackNavigationProp<RootStackParamList, 'StudentView'>;

export default function StudentViewScreen() {
  const navigation = useNavigation<Nav>();

  // Read large data from module store (avoids React Navigation param serialisation crash)
  const [storeData] = useState(() => consumeStudentViewData());
  const title = storeData?.title ?? 'Worksheet';
  const adaptations = storeData?.adaptations ?? [];
  const imageUri = storeData?.imageUri;
  const worksheetId = storeData?.worksheetId;

  const [pageIndex, setPageIndex] = useState(0);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  // null = not yet resolved (real mode); number = ready
  const [imageAspect, setImageAspect] = useState<number | null>(imageUri ? null : DEMO_IMAGE_ASPECT);
  const [containerWidth, setContainerWidth] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Resolve real image aspect ratio (blocks rendering until ready)
  useEffect(() => {
    if (!imageUri) { setImageAspect(DEMO_IMAGE_ASPECT); return; }
    Image.getSize(
      imageUri,
      (w, h) => setImageAspect(w > 0 && h > 0 ? w / h : DEMO_IMAGE_ASPECT),
      () => setImageAspect(DEMO_IMAGE_ASPECT),
    );
  }, [imageUri]);

  // Drawing state
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pen');
  const [drawingColor, setDrawingColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [drawingData, setDrawingData] = useState<DrawingData>({ paths: [], shapes: [], texts: [] });
  const [drawingHistory, setDrawingHistory] = useState<DrawingData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExporting, setIsExporting] = useState(false);
  const [hideMarkersForExport, setHideMarkersForExport] = useState(false);

  const [drawingActive, setDrawingActive] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  // Restore previous drawing data from persisted session
  useEffect(() => {
    if (!worksheetId) return;
    let cancelled = false;
    void loadSession(worksheetId).then((session) => {
      if (cancelled || !session) return;
      const d = session.drawingData;
      if (d && (d.paths.length > 0 || d.shapes.length > 0 || d.texts.length > 0)) {
        setDrawingData(d);
        setDrawingHistory([d]);
        setHistoryIndex(0);
      }
    });
    return () => { cancelled = true; };
  }, [worksheetId]);

  // Debounce auto-save drawings to session store
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!worksheetId) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSession({
        worksheetId,
        updatedAt: Date.now(),
        title,
        imageUri,
        adaptations,
        drawingData,
      });
    }, 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [drawingData, worksheetId]);

  const captureViewRef = useRef<View>(null);
  const currentPage = PAGES[pageIndex];

  const goToPage = (idx: number) => {
    setPageIndex(idx);
  };

  const handleImageLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // (Re)calculate image dimensions when container width or aspect ratio is known
  useEffect(() => {
    if (containerWidth > 0 && imageAspect != null && imageAspect > 0) {
      setImageSize({ width: containerWidth, height: containerWidth / imageAspect });
    }
  }, [imageAspect, containerWidth]);

  // Zone data from WorksheetViewScreen
  const ZONE_POSITIONS: Record<string, { top: number; left: number; width: number; height: number }> = {
    intro: { top: 5.5, left: 3, width: 94, height: 10 },
    funfact: { top: 16, left: 3, width: 94, height: 10 },
    accumulation: { top: 27, left: 3, width: 46, height: 24 },
    evaporation: { top: 51, left: 3, width: 46, height: 20 },
    condensation: { top: 71, left: 3, width: 46, height: 12 },
    precipitation: { top: 27, left: 51, width: 46, height: 56 },
  };

  // Convert adaptations to markers — position at zone center (same as WorksheetViewScreen)
  const markers: MarkerData[] =
    pageIndex === 0
      ? adaptations.map((a, index) => {
          const zoneRect = a.rect ?? ZONE_POSITIONS[a.zoneId];

          const basePosition = zoneRect
            ? {
                x: zoneRect.left + zoneRect.width / 2,
                y: zoneRect.top + zoneRect.height / 2,
              }
            : {
                x: 50,
                y: Math.round((index + 0.5) * (100 / adaptations.length)),
              };

          // Offset slightly for multiple markers on same zone
          const sameZoneIndex = adaptations.slice(0, index)
            .filter((prev) => prev.zoneId === a.zoneId).length;

          return {
            id: `${a.zoneId}-${a.action}`,
            type: a.action,
            label: a.zoneLabel,
            state: 'reviewed' as const,
            position: {
              x: basePosition.x + sameZoneIndex * 3,
              y: basePosition.y + sameZoneIndex * 3,
            },
            content: {
              original: a.original,
              result: a.result,
              keywords: a.keywords,
              bullets: a.bullets,
              visuals: a.visuals,
              visualUrl: a.visualUrl,
            },
          };
        })
      : [];

  // Drawing controls
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setDrawingData(drawingHistory[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < drawingHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setDrawingData(drawingHistory[newIndex]);
    }
  };

  const handleClear = () => {
    const emptyData: DrawingData = { paths: [], shapes: [], texts: [] };
    setDrawingData(emptyData);
    setDrawingHistory([emptyData]);
    setHistoryIndex(0);
  };

  const handleDrawingChange = (data: DrawingData) => {
    setDrawingData(data);
    const newHistory = drawingHistory.slice(0, historyIndex + 1);
    newHistory.push(data);
    setDrawingHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    if (!worksheetId) {
      // No session to persist (web or no worksheetId) — just go home
      navigation.popToTop();
      return;
    }
    setIsSaving(true);
    try {
      await saveSession({
        worksheetId,
        updatedAt: Date.now(),
        title,
        imageUri,
        adaptations,
        drawingData,
      });
      navigation.popToTop();
    } catch (e) {
      console.error('[StudentViewScreen] handleSave', e);
      if (Platform.OS === 'web') {
        window.alert('Failed to save. Please try again.');
      } else {
        Alert.alert('Save Failed', 'Could not save your work. Please try again.', [{ text: 'OK' }]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      if (Platform.OS === 'web') {
        const { toPng } = await import('html-to-image');
        const domNode = document.querySelector('[data-testid="worksheet-capture"]') as HTMLElement;
        if (domNode) {
          const dataUrl = await toPng(domNode, { quality: 1.0, pixelRatio: 2 });
          const link = document.createElement('a');
          link.download = `${title.replace(/\s+/g, '_')}_worksheet.png`;
          link.href = dataUrl;
          link.click();
        }
      } else if (captureRef && captureViewRef.current) {
        // Hide markers before capture, wait a frame for re-render
        setHideMarkersForExport(true);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const uri = await captureRef(captureViewRef, { format: 'png', quality: 1.0 });
        setHideMarkersForExport(false);
        if (Sharing && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Export Worksheet',
          });
        } else {
          Alert.alert('Export unavailable', 'Sharing is not available on this device.');
        }
      } else {
        Alert.alert('Export unavailable', 'Export libraries not available in this environment.');
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Export failed', 'Could not export the worksheet. Please try again.');
    } finally {
      setHideMarkersForExport(false);
      setIsExporting(false);
    }
  };

  const handleMenuPress = () => {
    Alert.alert(
      'Worksheet Options',
      undefined,
      [
        {
          text: 'Delete Worksheet',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Worksheet',
              'Are you sure you want to delete this worksheet? This action cannot be undone.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    if (worksheetId) {
                      await deleteSession(worksheetId);
                      await deleteWorksheet(worksheetId);
                    }
                    navigation.goBack();
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={title} onMenuPress={handleMenuPress} />

      {/* Student mode banner */}
      <View style={styles.banner}>
        <Ionicons name="school" size={16} color={colors.primary} />
        <Text style={styles.bannerText}>Student Mode</Text>
        {adaptations.length > 0 && (
          <Text style={styles.bannerHint}>
            Tap green badges for hints • Use toolbar to annotate
          </Text>
        )}
      </View>

      <View style={styles.content}>
        {/* Worksheet area */}
        <View style={styles.worksheetArea}>
          {/* Page nav — only shown for legacy mock worksheets */}
          {!imageUri && (
          <View style={styles.pageNav}>
            <Pressable
              onPress={() => goToPage(pageIndex - 1)}
              style={[styles.pageNavBtn, pageIndex === 0 && styles.pageNavBtnDisabled]}
              disabled={pageIndex === 0}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={pageIndex === 0 ? colors.surfaceMuted : colors.textSecondary}
              />
            </Pressable>
            <View style={styles.pageIndicator}>
              {PAGES.map((_p, i) => (
                <Pressable key={i} onPress={() => goToPage(i)} style={styles.pageDotWrap}>
                  {/* Dot */}
                  <View style={[styles.pageDot, i === pageIndex && styles.pageDotActive]} />
                  {/* Dash connector (except after last dot) */}
                  {i < PAGES.length - 1 && (
                    <View style={[styles.pageDash, i < pageIndex && styles.pageDashDone]} />
                  )}
                </Pressable>
              ))}
              <Text style={styles.pageLabel}>{pageIndex + 1} / {PAGES.length}</Text>
            </View>
            <Pressable
              onPress={() => goToPage(pageIndex + 1)}
              style={[
                styles.pageNavBtn,
                pageIndex === PAGES.length - 1 && styles.pageNavBtnDisabled,
              ]}
              disabled={pageIndex === PAGES.length - 1}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={pageIndex === PAGES.length - 1 ? colors.surfaceMuted : colors.textSecondary}
              />
            </Pressable>
          </View>
          )}

          <ScrollView
            style={styles.worksheetScroll}
            contentContainerStyle={styles.worksheetScrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!drawingActive}
            minimumZoomScale={1}
            maximumZoomScale={3}
            bouncesZoom={true}
            pinchGestureEnabled={!drawingActive}
            onScroll={(e) => {
              const scale = e.nativeEvent.zoomScale;
              if (scale !== undefined && scale !== zoomScale) {
                setZoomScale(scale);
              }
            }}
            scrollEventThrottle={16}
          >
            <View
              ref={captureViewRef}
              collapsable={false}
              testID="worksheet-capture"
              style={styles.imageWrapper}
              onLayout={handleImageLayout}
            >
              <Image
                source={imageUri ? { uri: imageUri } : currentPage.image}
                style={[
                  styles.worksheetImage,
                  imageSize.height > 0 && { height: imageSize.height },
                ]}
                resizeMode="contain"
              />

              {/* Floating markers for adaptations (hidden during export) */}
              {imageSize.width > 0 && !hideMarkersForExport &&
                markers.map((marker) => (
                  <FloatingMarker
                    key={marker.id}
                    marker={marker}
                    worksheetWidth={imageSize.width}
                    worksheetHeight={imageSize.height}
                  />
                ))}

              {/* Input zones — only for legacy mock worksheets */}
              {!imageUri && imageSize.width > 0 &&
                currentPage.inputZones?.map((zone) => (
                  <TextInput
                    key={zone.id}
                    style={[
                      styles.inputOverlay,
                      {
                        top: `${zone.rect.top}%`,
                        left: `${zone.rect.left}%`,
                        width: `${zone.rect.width}%`,
                        height: `${zone.rect.height}%`,
                      },
                    ]}
                    placeholder={zone.placeholder}
                    placeholderTextColor={colors.textSecondary}
                    value={answers[zone.id] ?? ''}
                    onChangeText={(text) =>
                      setAnswers((prev) => ({ ...prev, [zone.id]: text }))
                    }
                    multiline={zone.multiline}
                  />
                ))}

              {/* Drawing canvas overlay */}
              {imageSize.width > 0 && (
                <DrawingCanvas
                  width={imageSize.width}
                  height={imageSize.height}
                  tool={drawingTool}
                  color={drawingColor}
                  strokeWidth={strokeWidth}
                  enabled={drawingActive}
                  onDrawingChange={handleDrawingChange}
                  initialData={drawingData}
                />
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Drawing toolbar — left side */}
      <View style={styles.drawingToolbarContainer}>
        <DrawingToolbar
          tool={drawingTool}
          color={drawingColor}
          strokeWidth={strokeWidth}
          onToolChange={(t) => {
            setDrawingTool(t);
            setDrawingActive(true); // auto-enable drawing when tool is selected
          }}
          onColorChange={setDrawingColor}
          onStrokeWidthChange={setStrokeWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < drawingHistory.length - 1}
        />
      </View>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {/* Draw/Scroll mode toggle */}
        <Pressable
          style={[styles.modeToggle, drawingActive && styles.modeToggleActive]}
          onPress={() => setDrawingActive((v) => !v)}
        >
          <Ionicons
            name={drawingActive ? 'create' : 'hand-left'}
            size={20}
            color={drawingActive ? colors.surface : colors.textSecondary}
          />
          <Text
            style={[styles.modeToggleText, drawingActive && styles.modeToggleTextActive]}
          >
            {drawingActive ? 'Draw' : 'Scroll'}
          </Text>
        </Pressable>

        <View style={styles.bottomBarActions}>
          {/* Save button */}
          <Pressable
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Ionicons
              name={isSaving ? 'hourglass' : 'save-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={styles.saveBtnText}>
              {isSaving ? 'Saving...' : 'Save & Exit'}
            </Text>
          </Pressable>

          {/* Export button */}
          <Pressable
            style={styles.fab}
            onPress={handleExport}
            disabled={isExporting}
          >
            <Ionicons
              name={isExporting ? 'hourglass' : 'download-outline'}
              size={20}
              color={colors.surface}
            />
            <Text style={styles.fabText}>
              {isExporting ? 'Exporting...' : 'Export'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, flexDirection: 'row' },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
    backgroundColor: colors.primaryLight,
  },
  bannerText: {
    ...typography.cardTitle,
    color: colors.primary,
  },
  bannerHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.innerGap,
  },

  // Worksheet
  worksheetArea: { flex: 1, paddingHorizontal: spacing.pagePadding },
  worksheetScroll: { flex: 1 },
  worksheetScrollContent: { paddingBottom: spacing.pagePadding },
  imageWrapper: { position: 'relative' },
  worksheetImage: { width: '100%', borderRadius: radii.chip },

  // Page nav
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGap,
  },
  pageNavBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNavBtnDisabled: { opacity: 0.4 },
  pageIndicator: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  pageDotWrap: { flexDirection: 'row', alignItems: 'center' },
  pageDot: {
    width: 10,
    height: 10,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
  },
  pageDotActive: { backgroundColor: colors.primary, width: 12, height: 12 },
  pageDash: {
    width: 24,
    height: 2,
    backgroundColor: colors.surfaceMuted,
  },
  pageDashDone: { backgroundColor: colors.primary },
  pageLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.innerGapSmall,
  },

  // Input overlays (for students to type answers)
  inputOverlay: {
    position: 'absolute',
    backgroundColor: '#FFFFFF99',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    ...typography.bodySmall,
    color: colors.textPrimary,
  },

  // Drawing toolbar
  drawingToolbarContainer: {
    position: 'absolute',
    top: 80,
    left: spacing.pagePadding,
  },

  // Bottom action bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  bottomBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
  },
  modeToggleActive: {
    backgroundColor: colors.primary,
  },
  modeToggleText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modeToggleTextActive: {
    color: colors.surface,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
  },
  saveBtnText: {
    ...typography.cardTitle,
    color: colors.primary,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
  },
  fabText: { ...typography.cardTitle, color: colors.surface },
});
