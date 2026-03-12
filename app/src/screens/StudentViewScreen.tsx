import { useState, useRef } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList, AdaptedZone } from '../navigation/types';
import ScreenHeader from '../components/ScreenHeader';
import DrawingCanvas, { DrawingTool, DrawingData } from '../components/DrawingCanvas';
import DrawingToolbar from '../components/DrawingToolbar';
import FloatingMarker, { MarkerData } from '../components/FloatingMarker';

// Native-only imports (ViewShot, MediaLibrary, Sharing)
let ViewShot: any = View; // fallback to View on web
let MediaLibrary: any = null;
let Sharing: any = null;
if (Platform.OS !== 'web') {
  ViewShot = require('react-native-view-shot').default;
  MediaLibrary = require('expo-media-library');
  Sharing = require('expo-sharing');
}

type Route = RouteProp<RootStackParamList, 'StudentView'>;

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

const IMAGE_ASPECT = 595 / 842;

// ---------------------------------------------------------------------------
// Main student screen
// ---------------------------------------------------------------------------
export default function StudentViewScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();

  const title = route.params?.title ?? 'Worksheet';
  const adaptations = route.params?.adaptations ?? [];

  const [pageIndex, setPageIndex] = useState(0);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Drawing state
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pen');
  const [drawingColor, setDrawingColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [drawingData, setDrawingData] = useState<DrawingData>({ paths: [], shapes: [], texts: [] });
  const [drawingHistory, setDrawingHistory] = useState<DrawingData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState(false); // render all pages for capture

  const viewShotRef = useRef<any>(null);
  const currentPage = PAGES[pageIndex];

  const goToPage = (idx: number) => {
    setPageIndex(idx);
  };

  const handleImageLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setImageSize({ width, height: width / IMAGE_ASPECT });
  };

  // Zone data from WorksheetViewScreen
  const ZONE_POSITIONS: Record<string, { top: number; left: number; width: number; height: number }> = {
    intro: { top: 5.5, left: 3, width: 94, height: 10 },
    funfact: { top: 16, left: 3, width: 94, height: 10 },
    accumulation: { top: 27, left: 3, width: 46, height: 24 },
    evaporation: { top: 51, left: 3, width: 46, height: 20 },
    condensation: { top: 71, left: 3, width: 46, height: 12 },
    precipitation: { top: 27, left: 51, width: 46, height: 56 },
  };

  // Convert adaptations to markers with proper positions
  const markers: MarkerData[] =
    pageIndex === 0
      ? adaptations.map((a, index) => {
          const zoneRect = ZONE_POSITIONS[a.zoneId];
          const basePosition = zoneRect
            ? {
                x: zoneRect.left + zoneRect.width / 2,
                y: zoneRect.top + zoneRect.height / 2,
              }
            : { x: 50, y: 20 + index * 15 };

          // Offset slightly for multiple markers on same zone
          const sameZoneIndex = adaptations
            .slice(0, index)
            .filter((prev) => prev.zoneId === a.zoneId).length;

          return {
            id: `${a.zoneId}-${a.action}`,
            type: a.action,
            label: a.zoneLabel,
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

  const handleExport = () => {
    setIsExporting(true);
    setExportMode(true); // render all pages, then capture in effect
  };

  // Capture after all pages render in export mode
  const handleExportCapture = async () => {
    if (!exportMode || !isExporting) return;

    // Small delay to let all images render
    await new Promise((r) => setTimeout(r, 500));

    try {
      if (Platform.OS === 'web') {
        const { toPng } = await import('html-to-image');
        let domNode: HTMLElement | null = null;
        const ref = viewShotRef.current;
        if (ref instanceof HTMLElement) {
          domNode = ref;
        } else if (ref?.getNode) {
          domNode = ref.getNode();
        }
        if (!domNode) {
          domNode = document.querySelector('[data-testid="worksheet-capture"]') as HTMLElement;
        }
        if (domNode) {
          const dataUrl = await toPng(domNode, { quality: 1.0, pixelRatio: 2 });
          const link = document.createElement('a');
          link.download = `${title.replace(/\s+/g, '_')}_worksheet.png`;
          link.href = dataUrl;
          link.click();
        }
      } else {
        // Native: capture with ViewShot and save to Photos
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant permission to save images to your library.');
          return;
        }
        if (viewShotRef.current?.capture) {
          const uri = await viewShotRef.current.capture();
          const asset = await MediaLibrary.createAssetAsync(uri);
          await MediaLibrary.createAlbumAsync('Trellis', asset, false);
          Alert.alert('Success!', 'Worksheet exported to your Photos library.', [
            {
              text: 'Share',
              onPress: async () => {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(uri);
                }
              },
            },
            { text: 'OK' },
          ]);
        }
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert('Export failed', 'Could not export the worksheet. Please try again.');
    } finally {
      setExportMode(false);
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={title} />

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
          {/* Page nav */}
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

          <ScrollView
            style={styles.worksheetScroll}
            contentContainerStyle={styles.worksheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1.0 }}
              testID="worksheet-capture"
              onLayout={exportMode ? () => handleExportCapture() : undefined}
            >
              {exportMode ? (
                /* Export mode: render ALL pages stacked */
                PAGES.map((page, pi) => (
                  <View key={pi} style={styles.imageWrapper}>
                    <Image
                      source={page.image}
                      style={styles.worksheetImage}
                      resizeMode="contain"
                    />
                  </View>
                ))
              ) : (
                /* Normal mode: single page with interactivity */
                <View style={styles.imageWrapper} onLayout={handleImageLayout}>
                  <Image
                    source={currentPage.image}
                    style={[
                      styles.worksheetImage,
                      imageSize.height > 0 && { height: imageSize.height },
                    ]}
                    resizeMode="contain"
                  />

                  {/* Floating markers for adaptations */}
                  {imageSize.width > 0 &&
                    markers.map((marker) => (
                      <FloatingMarker
                        key={marker.id}
                        marker={marker}
                        worksheetWidth={imageSize.width}
                        worksheetHeight={imageSize.height}
                      />
                    ))}

                  {/* Input zones for question pages */}
                  {imageSize.width > 0 &&
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
                      onDrawingChange={handleDrawingChange}
                      initialData={drawingData}
                    />
                  )}
                </View>
              )}
            </ViewShot>
          </ScrollView>
        </View>
      </View>

      {/* Drawing toolbar */}
      <View style={styles.drawingToolbarContainer}>
        <DrawingToolbar
          tool={drawingTool}
          color={drawingColor}
          strokeWidth={strokeWidth}
          onToolChange={setDrawingTool}
          onColorChange={setDrawingColor}
          onStrokeWidthChange={setStrokeWidth}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < drawingHistory.length - 1}
        />
      </View>

      {/* Export button */}
      <Pressable
        style={styles.fab}
        onPress={handleExport}
      >
        <Ionicons name={isExporting ? 'hourglass' : 'download-outline'} size={20} color={colors.surface} />
        <Text style={styles.fabText}>{isExporting ? 'Exporting...' : 'Export Worksheet'}</Text>
      </Pressable>
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
  worksheetScrollContent: { paddingBottom: 100 },
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

  // FAB (unified with EA view)
  fab: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
    zIndex: 999,
    ...shadows.fab,
  },
  fabText: { ...typography.cardTitle, color: colors.surface },
});
