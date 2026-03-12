import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList } from '../navigation/types';
import ScreenHeader from '../components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorksheetView'>;

// Mock worksheet sections the user can tap
const MOCK_SECTIONS = [
  {
    id: '1',
    title: 'Introduction',
    text: 'Plants are living things that grow in the ground. They need sunlight, water, and nutrients from the soil to survive and grow tall.',
  },
  {
    id: '2',
    title: 'Parts of a Plant',
    text: 'Every plant has roots, a stem, leaves, and sometimes flowers. The roots absorb water and minerals from the soil. The stem transports these up to the leaves.',
  },
  {
    id: '3',
    title: 'Photosynthesis',
    text: 'Photosynthesis is the process by which plants convert light energy into chemical energy. Chlorophyll in the leaves captures sunlight and uses it with carbon dioxide and water to produce glucose and oxygen.',
  },
  {
    id: '4',
    title: 'Questions',
    text: '1. What do plants need to grow?\n2. Name the main parts of a plant.\n3. What is photosynthesis?',
  },
];

// Mock simplified result
const MOCK_SIMPLIFIED = {
  original:
    'Photosynthesis is the process by which plants convert light energy into chemical energy. Chlorophyll in the leaves captures sunlight and uses it with carbon dioxide and water to produce glucose and oxygen.',
  simplified:
    'Plants make their own food using sunlight! The green parts of leaves catch sunlight and mix it with water and air to make sugar for energy.',
  keywords: ['sunlight', 'leaves', 'food', 'energy'],
};

type ToolbarAction = 'simplify' | 'visuals' | 'summarize';

export default function WorksheetViewScreen() {
  const navigation = useNavigation<Nav>();
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [adaptedSections, setAdaptedSections] = useState<Set<string>>(
    new Set(),
  );

  const panelAnim = useRef(new Animated.Value(0)).current;
  const toolbarAnim = useRef(new Animated.Value(0)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Animate toolbar in/out
  useEffect(() => {
    Animated.spring(toolbarAnim, {
      toValue: showToolbar ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [showToolbar]);

  // Animate panel in/out
  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: showPanel ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 12,
    }).start();
  }, [showPanel]);

  const handleSectionTap = (id: string) => {
    if (selectedSection === id) {
      setSelectedSection(null);
      setShowToolbar(false);
    } else {
      setSelectedSection(id);
      setShowToolbar(true);
      setShowPanel(false);
    }
  };

  const handleAction = (_action: ToolbarAction) => {
    setShowToolbar(false);
    setIsProcessing(true);

    // Show toast
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1200),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsProcessing(false);
      setShowPanel(true);
    });
  };

  const handleApply = () => {
    if (selectedSection) {
      setAdaptedSections((prev) => new Set(prev).add(selectedSection));
    }
    setShowPanel(false);
    setSelectedSection(null);
  };

  const handleDismissPanel = () => {
    setShowPanel(false);
    setSelectedSection(null);
  };

  const panelWidth = 300;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Grade 3 Science — Plants" />

      <View style={styles.content}>
        {/* Left: Worksheet image area */}
        <View style={styles.worksheetArea}>
          <ScrollView
            style={styles.worksheetScroll}
            contentContainerStyle={styles.worksheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.worksheetCard}>
              {/* Worksheet title */}
              <View style={styles.worksheetTitleRow}>
                <Ionicons
                  name="document-text"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.worksheetTitle}>Parts of a Plant</Text>
              </View>
              <View style={styles.worksheetMeta}>
                <Text style={styles.worksheetMetaText}>
                  Grade 3 · Science · 4 sections
                </Text>
              </View>

              {/* Sections */}
              {MOCK_SECTIONS.map((section) => {
                const isSelected = selectedSection === section.id;
                const isAdapted = adaptedSections.has(section.id);
                return (
                  <Pressable
                    key={section.id}
                    style={[
                      styles.section,
                      isSelected && styles.sectionSelected,
                      isAdapted && styles.sectionAdapted,
                    ]}
                    onPress={() => handleSectionTap(section.id)}
                  >
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      {isAdapted && (
                        <View style={styles.adaptedBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.adaptedBadgeText}>Adapted</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sectionText}>{section.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Right: Side panel (slides in) */}
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
          <View style={styles.panelInner}>
            {/* Panel header */}
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Simplified</Text>
              <Pressable
                onPress={handleDismissPanel}
                style={styles.panelClose}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.panelScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Original text */}
              <Text style={styles.panelLabel}>Original</Text>
              <View style={styles.panelTextBlock}>
                <Text style={styles.panelOriginalText}>
                  {MOCK_SIMPLIFIED.original}
                </Text>
              </View>

              {/* Arrow */}
              <View style={styles.arrowRow}>
                <Ionicons
                  name="arrow-down"
                  size={20}
                  color={colors.primary}
                />
              </View>

              {/* Simplified text */}
              <Text style={styles.panelLabel}>Simplified</Text>
              <View style={styles.panelSimplifiedBlock}>
                <Text style={styles.panelSimplifiedText}>
                  {MOCK_SIMPLIFIED.simplified}
                </Text>
              </View>

              {/* Keywords */}
              <Text style={styles.panelLabel}>Key Words</Text>
              <View style={styles.keywordsRow}>
                {MOCK_SIMPLIFIED.keywords.map((word) => (
                  <View key={word} style={styles.keywordChip}>
                    <Text style={styles.keywordText}>{word}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Panel actions */}
            <View style={styles.panelActions}>
              <Pressable style={styles.applyBtn} onPress={handleApply}>
                <Ionicons name="checkmark" size={20} color={colors.surface} />
                <Text style={styles.applyBtnText}>Apply</Text>
              </Pressable>
              <Pressable style={styles.retryBtn}>
                <Ionicons
                  name="refresh"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
              <Pressable style={styles.editBtn}>
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Floating toolbar */}
      <Animated.View
        style={[
          styles.toolbar,
          {
            opacity: toolbarAnim,
            transform: [
              {
                translateY: toolbarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
              {
                scale: toolbarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
        pointerEvents={showToolbar ? 'auto' : 'none'}
      >
        <Pressable
          style={styles.toolbarItem}
          onPress={() => handleAction('simplify')}
        >
          <Ionicons name="text" size={20} color={colors.surface} />
          <Text style={styles.toolbarLabel}>Simplify</Text>
        </Pressable>
        <View style={styles.toolbarDivider} />
        <Pressable
          style={styles.toolbarItem}
          onPress={() => handleAction('visuals')}
        >
          <Ionicons name="image" size={20} color={colors.surface} />
          <Text style={styles.toolbarLabel}>Add Visuals</Text>
        </Pressable>
        <View style={styles.toolbarDivider} />
        <Pressable
          style={styles.toolbarItem}
          onPress={() => handleAction('summarize')}
        >
          <Ionicons name="list" size={20} color={colors.surface} />
          <Text style={styles.toolbarLabel}>Summarize</Text>
        </Pressable>
      </Animated.View>

      {/* Processing toast */}
      <Animated.View
        style={[styles.toast, { opacity: toastAnim }]}
        pointerEvents="none"
      >
        <Ionicons name="hourglass" size={16} color={colors.surface} />
        <Text style={styles.toastText}>Simplifying passage…</Text>
      </Animated.View>

      {/* Bottom hint bar */}
      <View style={styles.hintBar}>
        <Ionicons
          name="finger-print"
          size={16}
          color={colors.textSecondary}
        />
        <Text style={styles.hintText}>
          Select any text section, then choose an action to adapt it
        </Text>
      </View>

      {/* FAB — Hand to Student */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('Quiz')}
      >
        <Ionicons name="school" size={22} color={colors.surface} />
        <Text style={styles.fabText}>Hand to Student</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },

  // Worksheet area (left ~60%)
  worksheetArea: {
    flex: 1,
    paddingLeft: spacing.pagePadding,
    paddingRight: spacing.innerGap,
  },
  worksheetScroll: {
    flex: 1,
  },
  worksheetScrollContent: {
    paddingBottom: 100,
  },
  worksheetCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.pagePadding,
    gap: spacing.innerGap,
  },
  worksheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
  },
  worksheetTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  worksheetMeta: {
    marginBottom: spacing.innerGapSmall,
  },
  worksheetMetaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Sections
  section: {
    borderRadius: radii.chip,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.innerGap,
    gap: spacing.innerGapSmall,
  },
  sectionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sectionAdapted: {
    backgroundColor: colors.primaryLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  sectionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  adaptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adaptedBadgeText: {
    ...typography.caption,
    color: colors.primary,
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
  panelTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  panelClose: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelScroll: {
    flex: 1,
  },
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
  panelOriginalText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  arrowRow: {
    alignItems: 'center',
    marginBottom: spacing.innerGap,
  },
  panelSimplifiedBlock: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
    marginBottom: spacing.innerGap,
  },
  panelSimplifiedText: {
    ...typography.body,
    color: colors.textPrimary,
  },
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
  keywordText: {
    ...typography.caption,
    color: colors.primary,
  },

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
  applyBtnText: {
    ...typography.cardTitle,
    color: colors.surface,
  },
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
  toolbarLabel: {
    ...typography.bodySmall,
    color: colors.surface,
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#FFFFFF33',
  },

  // Processing toast
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
  toastText: {
    ...typography.bodySmall,
    color: colors.surface,
  },

  // Bottom hint bar
  hintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
    backgroundColor: colors.surfaceMuted,
  },
  hintText: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 56,
    right: spacing.pagePadding,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGap,
    gap: spacing.innerGapSmall,
    ...shadows.fab,
  },
  fabText: {
    ...typography.cardTitle,
    color: colors.surface,
  },
});
