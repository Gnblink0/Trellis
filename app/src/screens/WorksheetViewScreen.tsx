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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList, AdaptationSummary, AdaptedZone } from '../navigation/types';
import ScreenHeader from '../components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorksheetView'>;

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------
type ToolbarAction = 'simplify' | 'visuals' | 'summarize';

const ACTION_META: Record<
  ToolbarAction,
  { label: string; icon: keyof typeof Ionicons.glyphMap; toastText: string }
> = {
  simplify: { label: 'Simplified', icon: 'text', toastText: 'Simplifying passage…' },
  visuals: { label: 'Visuals Added', icon: 'image', toastText: 'Adding visuals…' },
  summarize: { label: 'Summary', icon: 'list', toastText: 'Summarizing…' },
};

// ---------------------------------------------------------------------------
// Multi-page worksheet
// ---------------------------------------------------------------------------
type Zone = {
  id: string;
  label: string;
  rect: { top: number; left: number; width: number; height: number };
};

type WorksheetPage = {
  image: ReturnType<typeof require>;
  label: string;
  zones: Zone[];
};

const PAGES: WorksheetPage[] = [
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
  {
    image: require('../../assets/worksheet-page-2.png'),
    label: 'Answers',
    zones: [
      { id: 'q1', label: 'Q1 — Match definitions', rect: { top: 4, left: 3, width: 94, height: 28 } },
      { id: 'q2', label: 'Q2 — True statements', rect: { top: 33, left: 3, width: 94, height: 15 } },
      { id: 'q3', label: 'Q3 — Four stages', rect: { top: 49, left: 3, width: 94, height: 18 } },
      { id: 'q456', label: 'Q4–Q6 — Short answers', rect: { top: 68, left: 3, width: 94, height: 24 } },
    ],
  },
  {
    image: require('../../assets/worksheet-page-3.png'),
    label: 'Questions',
    zones: [
      { id: 'q1_blank', label: 'Q1 — Match definitions', rect: { top: 4, left: 3, width: 94, height: 28 } },
      { id: 'q2_blank', label: 'Q2 — True statements', rect: { top: 33, left: 3, width: 94, height: 13 } },
      { id: 'q3_blank', label: 'Q3 — Four stages', rect: { top: 47, left: 3, width: 94, height: 16 } },
      { id: 'q456_blank', label: 'Q4–Q6 — Short answers', rect: { top: 64, left: 3, width: 94, height: 28 } },
    ],
  },
];

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
};

// Mock results per zone per action
const MOCK_RESULTS: Record<string, Record<ToolbarAction, Adaptation>> = {
  intro: {
    simplify: {
      action: 'simplify',
      original: 'The Earth always has the same amount of water. This water moves through stages, called the water cycle. The water cycle is important to life on Earth, and the Sun plays an important role in the cycle.',
      result: 'Earth always has the same water. Water moves in a cycle. The Sun helps the water cycle happen.',
      keywords: ['water', 'cycle', 'Sun', 'Earth'],
    },
    visuals: {
      action: 'visuals',
      original: 'The Earth always has the same amount of water...',
      result: 'Added visual supports for the introduction.',
      visuals: ['🌍 Earth with water arrows', '☀️ Sun driving the cycle'],
    },
    summarize: {
      action: 'summarize',
      original: 'The Earth always has the same amount of water...',
      result: 'Key points:',
      bullets: ['Earth\'s water amount stays the same', 'Water moves in a cycle', 'Sun powers the cycle'],
    },
  },
  funfact: {
    simplify: {
      action: 'simplify',
      original: 'The water you drink today could have been used in a dinosaur\'s bath!',
      result: 'The water you drink might be the same water dinosaurs used!',
      keywords: ['water', 'dinosaurs'],
    },
    visuals: {
      action: 'visuals',
      original: 'The water you drink today could have been used in a dinosaur\'s bath!',
      result: 'Added fun visual for the fact.',
      visuals: ['🦕 Dinosaur with water droplets'],
    },
    summarize: {
      action: 'summarize',
      original: 'The water you drink today could have been used in a dinosaur\'s bath!',
      result: 'Fun fact:',
      bullets: ['Water gets reused over millions of years'],
    },
  },
  accumulation: {
    simplify: {
      action: 'simplify',
      original: 'Accumulation is water stored in rivers, lakes, oceans, and in the soil. Oceans hold most of the Earth\'s water. Groundwater is in the soil and is absorbed by roots to help plants grow.',
      result: 'Water collects in rivers, lakes, and oceans. Most water is in oceans. Water in the ground helps plants grow.',
      keywords: ['rivers', 'lakes', 'oceans', 'groundwater'],
    },
    visuals: {
      action: 'visuals',
      original: 'Accumulation is water stored in rivers, lakes, oceans...',
      result: 'Added labeled water storage diagram.',
      visuals: ['🌊 Ocean', '🏞️ Lake & river', '🌱 Groundwater arrows'],
    },
    summarize: {
      action: 'summarize',
      original: 'Accumulation is water stored in rivers, lakes, oceans...',
      result: 'Key points about accumulation:',
      bullets: ['Water stored in rivers, lakes, oceans, soil', 'Oceans hold the most', 'Groundwater feeds plant roots'],
    },
  },
  evaporation: {
    simplify: {
      action: 'simplify',
      original: 'Evaporation happens when the Sun heats up water and turns it into water vapour. Water vapour is a gas in the air. Water can be evaporated from plants. This is called transpiration.',
      result: 'The Sun heats water and turns it into a gas called water vapour. Plants also release water into the air — that\'s called transpiration.',
      keywords: ['Sun', 'heat', 'vapour', 'transpiration'],
    },
    visuals: {
      action: 'visuals',
      original: 'Evaporation happens when the Sun heats up water...',
      result: 'Added evaporation process visuals.',
      visuals: ['☀️ → 💧 → ☁️ Heat arrows', '🌿 Transpiration from leaves'],
    },
    summarize: {
      action: 'summarize',
      original: 'Evaporation happens when the Sun heats up water...',
      result: 'Key points about evaporation:',
      bullets: ['Sun heats water → becomes gas', 'Water vapour rises into air', 'Plants release water too (transpiration)'],
    },
  },
  condensation: {
    simplify: {
      action: 'simplify',
      original: 'When water vapour is in the air, it cools and turns back to a liquid. This is called condensation. Water droplets in the air form clouds. But even on a clear day, there is always water in the air.',
      result: 'Water vapour cools down and becomes liquid again. This makes clouds! There\'s always some water in the air.',
      keywords: ['cool', 'liquid', 'clouds'],
    },
    visuals: {
      action: 'visuals',
      original: 'When water vapour is in the air, it cools...',
      result: 'Added condensation diagram.',
      visuals: ['☁️ Cloud formation stages', '💧 Droplet close-up'],
    },
    summarize: {
      action: 'summarize',
      original: 'When water vapour is in the air, it cools...',
      result: 'Key points about condensation:',
      bullets: ['Vapour cools → liquid', 'Forms clouds', 'Water always in air'],
    },
  },
  precipitation: {
    simplify: {
      action: 'simplify',
      original: 'When more water joins the clouds, they get heavy. The water falls back to Earth, which is called precipitation. Precipitation gives water to plants and animals. Precipitation can be: rain, hail, sleet, snow.',
      result: 'Clouds get heavy with water and it falls down. This is called precipitation. It can be rain, hail, sleet, or snow!',
      keywords: ['rain', 'hail', 'sleet', 'snow'],
    },
    visuals: {
      action: 'visuals',
      original: 'When more water joins the clouds, they get heavy...',
      result: 'Added precipitation type illustrations.',
      visuals: ['🌧️ Rain', '🌨️ Snow & hail', '🌿 Water reaching plants'],
    },
    summarize: {
      action: 'summarize',
      original: 'When more water joins the clouds, they get heavy...',
      result: 'Key points about precipitation:',
      bullets: ['Heavy clouds release water', '4 types: rain, hail, sleet, snow', 'Gives water to plants & animals'],
    },
  },
  // Page 2 — Answers
  q1: {
    simplify: { action: 'simplify', original: 'Match each word to the correct definition: Precipitation, Evaporation, Accumulation, Condensation, Transpiration.', result: 'Draw a line from each water cycle word to what it means.', keywords: ['match', 'definition'] },
    visuals: { action: 'visuals', original: 'Match each word to the correct definition...', result: 'Added colour-coded matching hints.', visuals: ['🔵 Word-to-definition colour lines'] },
    summarize: { action: 'summarize', original: 'Match each word to the correct definition...', result: 'Matching exercise:', bullets: ['Precipitation → rain, snow, etc.', 'Evaporation → Sun heats water to gas', 'Accumulation → water stored in lakes/oceans', 'Condensation → vapour cools to liquid', 'Transpiration → water from plants'] },
  },
  q2: {
    simplify: { action: 'simplify', original: 'Check the true statements about the water cycle.', result: 'Pick the sentences that are correct.', keywords: ['true', 'false'] },
    visuals: { action: 'visuals', original: 'Check the true statements...', result: 'Added visual true/false markers.', visuals: ['✅ True statement highlights'] },
    summarize: { action: 'summarize', original: 'Check the true statements...', result: 'True/false check:', bullets: ['Earth always has the same water ✓', 'Moon is important ✗', 'Oceans hold most water ✓'] },
  },
  q3: {
    simplify: { action: 'simplify', original: 'List the four stages of the water cycle.', result: 'Name the 4 steps water goes through.', keywords: ['stages', 'cycle'] },
    visuals: { action: 'visuals', original: 'List the four stages...', result: 'Added numbered cycle diagram.', visuals: ['🔄 4-step cycle diagram'] },
    summarize: { action: 'summarize', original: 'List the four stages...', result: 'The 4 stages:', bullets: ['1. Accumulation', '2. Evaporation', '3. Condensation', '4. Precipitation'] },
  },
  q456: {
    simplify: { action: 'simplify', original: 'Q4: What are clouds formed of? Q5: Explain evaporation. Q6: Why is precipitation important?', result: 'Q4: What makes clouds? Q5: How does water become gas? Q6: Why do plants and animals need rain?', keywords: ['clouds', 'evaporation', 'precipitation'] },
    visuals: { action: 'visuals', original: 'Q4–Q6 short answer questions...', result: 'Added visual answer hints.', visuals: ['☁️ Cloud diagram for Q4', '☀️ → 💨 for Q5', '🌧️ → 🌿 for Q6'] },
    summarize: { action: 'summarize', original: 'Q4–Q6 short answer questions...', result: 'Answer summaries:', bullets: ['Q4: Clouds = water droplets', 'Q5: Sun heats water → gas', 'Q6: Rain gives water to plants & animals'] },
  },
  // Page 3 — Questions (blank) — same content as page 2 but framed as questions
  q1_blank: {
    simplify: { action: 'simplify', original: 'Match each word to the correct definition.', result: 'Draw a line from each word to its meaning.', keywords: ['match', 'definition'] },
    visuals: { action: 'visuals', original: 'Match each word to the correct definition.', result: 'Added visual word bank with icons.', visuals: ['🏷️ Illustrated word cards'] },
    summarize: { action: 'summarize', original: 'Match each word to the correct definition.', result: 'Hint:', bullets: ['Think about what happens at each step of the cycle'] },
  },
  q2_blank: {
    simplify: { action: 'simplify', original: 'Check the true statements.', result: 'Read each sentence and check if it is true.', keywords: ['true', 'check'] },
    visuals: { action: 'visuals', original: 'Check the true statements.', result: 'Added visual clue icons.', visuals: ['💡 Clue icons next to statements'] },
    summarize: { action: 'summarize', original: 'Check the true statements.', result: 'Hint:', bullets: ['Remember: the Sun (not the Moon) drives the cycle'] },
  },
  q3_blank: {
    simplify: { action: 'simplify', original: 'List the four stages of the water cycle.', result: 'Write the 4 steps water goes through.', keywords: ['four', 'stages'] },
    visuals: { action: 'visuals', original: 'List the four stages...', result: 'Added cycle diagram with blanks.', visuals: ['🔄 Cycle with fill-in blanks'] },
    summarize: { action: 'summarize', original: 'List the four stages...', result: 'Hint:', bullets: ['A → E → C → P'] },
  },
  q456_blank: {
    simplify: { action: 'simplify', original: 'Q4: What are clouds formed of? Q5: Explain evaporation. Q6: Why is precipitation important?', result: 'Q4: What makes clouds? Q5: How does water turn into gas? Q6: Why is rain important?', keywords: ['clouds', 'evaporation', 'rain'] },
    visuals: { action: 'visuals', original: 'Q4–Q6 short answer questions...', result: 'Added visual prompts.', visuals: ['☁️ Q4 hint', '☀️ Q5 hint', '🌧️ Q6 hint'] },
    summarize: { action: 'summarize', original: 'Q4–Q6 short answer questions...', result: 'Hints:', bullets: ['Q4: Think about tiny water drops', 'Q5: What does the Sun do to water?', 'Q6: Who needs rain?'] },
  },
};

// ---------------------------------------------------------------------------
// Panel content component
// ---------------------------------------------------------------------------
function PanelContent({
  data,
  isAlreadyApplied,
  onApply,
  onDismiss,
}: {
  data: Adaptation | null;
  isAlreadyApplied: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  if (!data) return null;
  const meta = ACTION_META[data.action];

  return (
    <View style={styles.panelInner}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleRow}>
          <Ionicons name={meta.icon} size={18} color={colors.primary} />
          <Text style={styles.panelTitle}>{meta.label}</Text>
        </View>
        <Pressable onPress={onDismiss} style={styles.panelClose}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.panelLabel}>Original</Text>
        <View style={styles.panelTextBlock}>
          <Text style={styles.panelOriginalText}>{data.original}</Text>
        </View>

        <View style={styles.arrowRow}>
          <Ionicons name="arrow-down" size={20} color={colors.primary} />
        </View>

        {data.action === 'simplify' && (
          <>
            <Text style={styles.panelLabel}>Simplified</Text>
            <View style={styles.panelResultBlock}>
              <Text style={styles.panelResultText}>{data.result}</Text>
            </View>
            {data.keywords && (
              <>
                <Text style={styles.panelLabel}>Key Words</Text>
                <View style={styles.keywordsRow}>
                  {data.keywords.map((w) => (
                    <View key={w} style={styles.keywordChip}>
                      <Text style={styles.keywordText}>{w}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {data.action === 'visuals' && (
          <>
            <Text style={styles.panelLabel}>Visual Supports</Text>
            <View style={styles.panelResultBlock}>
              <Text style={styles.panelResultText}>{data.result}</Text>
            </View>
            {data.visuals && (
              <View style={styles.visualsList}>
                {data.visuals.map((v) => (
                  <View key={v} style={styles.visualPlaceholder}>
                    <Text style={styles.visualPlaceholderText}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {data.action === 'summarize' && (
          <>
            <Text style={styles.panelLabel}>Summary</Text>
            <View style={styles.panelResultBlock}>
              <Text style={styles.panelResultText}>{data.result}</Text>
              {data.bullets && (
                <View style={styles.bulletList}>
                  {data.bullets.map((b) => (
                    <View key={b} style={styles.bulletRow}>
                      <Text style={styles.bulletDot}>•</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.panelActions}>
        {isAlreadyApplied ? (
          <View style={styles.appliedIndicator}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.appliedText}>Applied</Text>
          </View>
        ) : (
          <Pressable style={styles.applyBtn} onPress={onApply}>
            <Ionicons name="checkmark" size={20} color={colors.surface} />
            <Text style={styles.applyBtnText}>Apply</Text>
          </Pressable>
        )}
        <Pressable style={styles.retryBtn}>
          <Ionicons name="refresh" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.editBtn}>
          <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

// Source image aspect ratio (from the PDF render: roughly 595 × 842)
const IMAGE_ASPECT = 595 / 842;

export default function WorksheetViewScreen() {
  const navigation = useNavigation<Nav>();

  const [pageIndex, setPageIndex] = useState(0);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<ToolbarAction>('simplify');
  const [showToolbar, setShowToolbar] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [adaptedZones, setAdaptedZones] = useState<Record<string, Adaptation>>({});
  const [previewAdaptation, setPreviewAdaptation] = useState<Adaptation | null>(null);

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const currentPage = PAGES[pageIndex];
  const totalPages = PAGES.length;

  const goToPage = (idx: number) => {
    // Dismiss any open panel/toolbar when switching pages
    setSelectedZone(null);
    setShowToolbar(false);
    setShowPanel(false);
    setPreviewAdaptation(null);
    setPageIndex(idx);
  };

  const panelAnim = useRef(new Animated.Value(0)).current;
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

  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: showPanel ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 12,
    }).start();
  }, [showPanel]);

  const handleImageLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setImageSize({ width, height: width / IMAGE_ASPECT });
  };

  const handleZoneTap = (id: string) => {
    if (selectedZone === id) {
      setSelectedZone(null);
      setShowToolbar(false);
      setShowPanel(false);
      setPreviewAdaptation(null);
    } else {
      setSelectedZone(id);
      if (adaptedZones[id]) {
        setPreviewAdaptation(adaptedZones[id]);
        setShowToolbar(false);
        setShowPanel(true);
      } else {
        setPreviewAdaptation(null);
        setShowToolbar(true);
        setShowPanel(false);
      }
    }
  };

  const handleAction = (action: ToolbarAction) => {
    setCurrentAction(action);
    setShowToolbar(false);
    setIsProcessing(true);

    const result =
      selectedZone && MOCK_RESULTS[selectedZone]
        ? MOCK_RESULTS[selectedZone][action]
        : null;
    setPreviewAdaptation(result);

    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setIsProcessing(false);
      setShowPanel(true);
    });
  };

  const handleApply = () => {
    if (selectedZone && previewAdaptation) {
      setAdaptedZones((prev) => ({ ...prev, [selectedZone]: previewAdaptation }));
    }
    setShowPanel(false);
    setSelectedZone(null);
    setPreviewAdaptation(null);
  };

  const handleDismissPanel = () => {
    setShowPanel(false);
    setSelectedZone(null);
    setPreviewAdaptation(null);
  };

  const panelWidth = 300;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="The Water Cycle" />

      <View style={styles.content}>
        {/* Left: Worksheet image with overlay zones */}
        <View style={styles.worksheetArea}>
          {/* Page navigation bar */}
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
              {PAGES.map((p, i) => (
                <Pressable key={i} onPress={() => goToPage(i)} style={styles.pageDotWrap}>
                  <View style={[styles.pageDot, i === pageIndex && styles.pageDotActive]} />
                  <Text
                    style={[styles.pageDotLabel, i === pageIndex && styles.pageDotLabelActive]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => goToPage(pageIndex + 1)}
              style={[
                styles.pageNavBtn,
                pageIndex === totalPages - 1 && styles.pageNavBtnDisabled,
              ]}
              disabled={pageIndex === totalPages - 1}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={
                  pageIndex === totalPages - 1
                    ? colors.surfaceMuted
                    : colors.textSecondary
                }
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.worksheetScroll}
            contentContainerStyle={styles.worksheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageWrapper} onLayout={handleImageLayout}>
              <Image
                source={currentPage.image}
                style={[
                  styles.worksheetImage,
                  imageSize.height > 0 && { height: imageSize.height },
                ]}
                resizeMode="contain"
              />

              {/* Tappable overlay zones for the current page */}
              {imageSize.width > 0 &&
                currentPage.zones.map((zone) => {
                  const isSelected = selectedZone === zone.id;
                  const isAdapted = !!adaptedZones[zone.id];
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
                        isAdapted && !isSelected && styles.zoneAdapted,
                      ]}
                      onPress={() => handleZoneTap(zone.id)}
                    >
                      {isAdapted && !isSelected && (
                        <View style={styles.zoneBadge}>
                          <Ionicons
                            name={ACTION_META[adaptedZones[zone.id].action].icon}
                            size={12}
                            color={colors.surface}
                          />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
            </View>
          </ScrollView>
        </View>

        {/* Right: Side panel */}
        <Animated.View
          style={[
            styles.sidePanel,
            {
              width: panelWidth,
              transform: [
                {
                  translateX: panelAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [panelWidth + spacing.pagePadding, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents={showPanel ? 'auto' : 'none'}
        >
          <PanelContent
            data={previewAdaptation}
            isAlreadyApplied={!!(selectedZone && adaptedZones[selectedZone])}
            onApply={handleApply}
            onDismiss={handleDismissPanel}
          />
        </Animated.View>
      </View>

      {/* Floating toolbar */}
      <Animated.View
        style={[
          styles.toolbar,
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
        <Pressable style={styles.toolbarItem} onPress={() => handleAction('simplify')}>
          <Ionicons name="text" size={20} color={colors.surface} />
          <Text style={styles.toolbarLabel}>Simplify</Text>
        </Pressable>
        <View style={styles.toolbarDivider} />
        <Pressable style={styles.toolbarItem} onPress={() => handleAction('visuals')}>
          <Ionicons name="image" size={20} color={colors.surface} />
          <Text style={styles.toolbarLabel}>Add Visuals</Text>
        </Pressable>
        <View style={styles.toolbarDivider} />
        <Pressable style={styles.toolbarItem} onPress={() => handleAction('summarize')}>
          <Ionicons name="list" size={20} color={colors.surface} />
          <Text style={styles.toolbarLabel}>Summarize</Text>
        </Pressable>
      </Animated.View>

      {/* Processing toast */}
      <Animated.View style={[styles.toast, { opacity: toastAnim }]} pointerEvents="none">
        <Ionicons name="hourglass" size={16} color={colors.surface} />
        <Text style={styles.toastText}>{ACTION_META[currentAction].toastText}</Text>
      </Animated.View>

      {/* Bottom hint bar */}
      <View style={styles.hintBar}>
        <Ionicons name="finger-print" size={16} color={colors.textSecondary} />
        <Text style={styles.hintText}>
          Tap any section on the worksheet, then choose an action
        </Text>
      </View>

      {/* Bottom action buttons */}
      <View style={styles.fabRow}>
        <Pressable
          style={styles.fabSecondary}
          onPress={() => {
            const zoneLabelMap: Record<string, string> = {};
            PAGES.forEach((p) => p.zones.forEach((z) => { zoneLabelMap[z.id] = z.label; }));

            const summaries: AdaptationSummary[] = Object.entries(adaptedZones).map(
              ([zoneId, adapt]) => ({
                zoneId,
                zoneLabel: zoneLabelMap[zoneId] ?? zoneId,
                action: adapt.action,
                original: adapt.original,
                result: adapt.result,
              }),
            );
            navigation.navigate('Export', {
              title: 'The Water Cycle',
              adaptations: summaries,
            });
          }}
        >
          <Ionicons name="download-outline" size={20} color={colors.primary} />
          <Text style={styles.fabSecondaryText}>Export</Text>
        </Pressable>

        <Pressable
          style={styles.fab}
          onPress={() => {
            const zoneLabelMap: Record<string, string> = {};
            PAGES.forEach((p) => p.zones.forEach((z) => { zoneLabelMap[z.id] = z.label; }));

            const adapted: AdaptedZone[] = Object.entries(adaptedZones).map(
              ([zoneId, adapt]) => ({
                zoneId,
                zoneLabel: zoneLabelMap[zoneId] ?? zoneId,
                action: adapt.action,
                original: adapt.original,
                result: adapt.result,
                keywords: adapt.keywords,
                bullets: adapt.bullets,
                visuals: adapt.visuals,
              }),
            );
            navigation.navigate('StudentView', {
              title: 'The Water Cycle',
              adaptations: adapted,
            });
          }}
        >
          <Ionicons name="school" size={20} color={colors.surface} />
          <Text style={styles.fabText}>Hand to Student</Text>
        </Pressable>
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

  // Worksheet image area
  worksheetArea: {
    flex: 1,
    paddingLeft: spacing.pagePadding,
    paddingRight: spacing.innerGap,
  },
  // Page navigation
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
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGap,
  },
  pageDotWrap: {
    alignItems: 'center',
    gap: 4,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
  },
  pageDotActive: {
    backgroundColor: colors.primary,
    width: 10,
    height: 10,
  },
  pageDotLabel: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  pageDotLabelActive: {
    color: colors.primary,
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
  zoneAdapted: {
    backgroundColor: `${colors.primary}15`,
    borderColor: `${colors.primary}40`,
  },
  zoneBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.primary,
    borderRadius: radii.circle,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Side panel
  sidePanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    paddingRight: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
  },
  panelInner: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    ...shadows.modalSheet,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.innerGap,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
  },
  panelTitle: { ...typography.cardTitle, color: colors.textPrimary },
  panelClose: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelScroll: { flex: 1 },
  panelLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: spacing.innerGapSmall,
  },
  panelTextBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
    marginBottom: spacing.innerGap,
  },
  panelOriginalText: { ...typography.bodySmall, color: colors.textSecondary },
  arrowRow: { alignItems: 'center', marginBottom: spacing.innerGap },
  panelResultBlock: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
    marginBottom: spacing.innerGap,
  },
  panelResultText: { ...typography.body, color: colors.textPrimary },

  // Keywords
  keywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.innerGapSmall,
    marginBottom: spacing.innerGap,
  },
  keywordChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: 6,
  },
  keywordText: { ...typography.caption, color: colors.primary },

  // Visuals
  visualsList: { gap: spacing.innerGapSmall, marginBottom: spacing.innerGap },
  visualPlaceholder: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
    alignItems: 'center',
  },
  visualPlaceholderText: { ...typography.bodySmall, color: colors.textSecondary },

  // Bullets
  bulletList: { marginTop: spacing.innerGapSmall, gap: spacing.innerGapSmall },
  bulletRow: { flexDirection: 'row', gap: spacing.innerGapSmall },
  bulletDot: { ...typography.body, color: colors.primary },
  bulletText: { ...typography.body, color: colors.textPrimary, flex: 1 },

  // Panel actions
  panelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    paddingTop: spacing.innerGap,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.chip,
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
  },
  applyBtnText: { ...typography.cardTitle, color: colors.surface },
  appliedIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
  },
  appliedText: { ...typography.cardTitle, color: colors.primary },
  retryBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Floating toolbar
  toolbar: {
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
  toolbarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
  },
  toolbarLabel: { ...typography.bodySmall, color: colors.surface },
  toolbarDivider: { width: 1, height: 20, backgroundColor: '#FFFFFF33' },

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

  // FAB row
  fabRow: {
    position: 'absolute',
    bottom: 56,
    left: spacing.pagePadding,
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
  },
  fabSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: spacing.innerGapSmall,
    gap: spacing.innerGapSmall,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    ...shadows.floatingToolbar,
  },
  fabSecondaryText: { ...typography.cardTitle, color: colors.primary },
  fab: {
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
