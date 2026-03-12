import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { RootStackParamList, AdaptedZone } from '../navigation/types';
import ScreenHeader from '../components/ScreenHeader';

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
// Adaptation helper panel
// ---------------------------------------------------------------------------
function HelpPanel({
  data,
  onClose,
}: {
  data: AdaptedZone;
  onClose: () => void;
}) {
  const actionLabels: Record<string, string> = {
    simplify: 'Simplified',
    visuals: 'Visuals',
    summarize: 'Summary',
  };
  const actionIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    simplify: 'text',
    visuals: 'image',
    summarize: 'list',
  };

  return (
    <View style={styles.helpPanel}>
      <View style={styles.helpHeader}>
        <View style={styles.helpTitleRow}>
          <Ionicons name={actionIcons[data.action]} size={16} color={colors.primary} />
          <Text style={styles.helpTitle}>
            {data.zoneLabel} — {actionLabels[data.action]}
          </Text>
        </View>
        <Pressable onPress={onClose} style={styles.helpClose}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={styles.helpScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.helpResultBlock}>
          <Text style={styles.helpResultText}>{data.result}</Text>
        </View>

        {data.keywords && data.keywords.length > 0 && (
          <View style={styles.helpChipsRow}>
            {data.keywords.map((w) => (
              <View key={w} style={styles.helpChip}>
                <Text style={styles.helpChipText}>{w}</Text>
              </View>
            ))}
          </View>
        )}

        {data.bullets && data.bullets.length > 0 && (
          <View style={styles.helpBullets}>
            {data.bullets.map((b) => (
              <View key={b} style={styles.helpBulletRow}>
                <Text style={styles.helpBulletDot}>•</Text>
                <Text style={styles.helpBulletText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {data.visuals && data.visuals.length > 0 && (
          <View style={styles.helpVisuals}>
            {data.visuals.map((v) => (
              <View key={v} style={styles.helpVisualItem}>
                <Text style={styles.helpVisualText}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
  const [selectedHelp, setSelectedHelp] = useState<AdaptedZone | null>(null);

  const currentPage = PAGES[pageIndex];

  const goToPage = (idx: number) => {
    setPageIndex(idx);
    setSelectedHelp(null);
  };

  const handleImageLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout;
    setImageSize({ width, height: width / IMAGE_ASPECT });
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
            Tap the green badges to see simplified content
          </Text>
        )}
      </View>

      <View style={styles.content}>
        {/* Left: Worksheet */}
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
              {PAGES.map((p, i) => (
                <Pressable key={i} onPress={() => goToPage(i)} style={styles.pageDotWrap}>
                  <View style={[styles.pageDot, i === pageIndex && styles.pageDotActive]} />
                  <Text style={[styles.pageDotLabel, i === pageIndex && styles.pageDotLabelActive]}>
                    {p.label}
                  </Text>
                </Pressable>
              ))}
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
            <View style={styles.imageWrapper} onLayout={handleImageLayout}>
              <Image
                source={currentPage.image}
                style={[
                  styles.worksheetImage,
                  imageSize.height > 0 && { height: imageSize.height },
                ]}
                resizeMode="contain"
              />

              {/* Adaptation badges (tappable to view help) */}
              {imageSize.width > 0 &&
                adaptations.map((a) => {
                  // Only show badges on reading page (page 0)
                  if (pageIndex !== 0) return null;
                  // We don't know exact positions from adaptations, so show as a floating list
                  return null;
                })}

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
            </View>
          </ScrollView>
        </View>

        {/* Right: help panel OR adaptation list */}
        <View style={styles.sideArea}>
          {selectedHelp ? (
            <HelpPanel data={selectedHelp} onClose={() => setSelectedHelp(null)} />
          ) : adaptations.length > 0 ? (
            <View style={styles.adaptList}>
              <Text style={styles.adaptListTitle}>Adapted Sections</Text>
              <Text style={styles.adaptListHint}>Tap to view</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {adaptations.map((a) => {
                  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                    simplify: 'text',
                    visuals: 'image',
                    summarize: 'list',
                  };
                  return (
                    <Pressable
                      key={a.zoneId}
                      style={styles.adaptItem}
                      onPress={() => setSelectedHelp(a)}
                    >
                      <View style={styles.adaptItemIcon}>
                        <Ionicons name={icons[a.action]} size={16} color={colors.primary} />
                      </View>
                      <Text style={styles.adaptItemLabel} numberOfLines={1}>
                        {a.zoneLabel}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyHelp}>
              <Ionicons name="book-outline" size={32} color={colors.surfaceMuted} />
              <Text style={styles.emptyHelpText}>No adaptations</Text>
            </View>
          )}
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
  worksheetArea: { flex: 1, paddingLeft: spacing.pagePadding, paddingRight: spacing.innerGap },
  worksheetScroll: { flex: 1 },
  worksheetScrollContent: { paddingBottom: 40 },
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
  pageIndicator: { flexDirection: 'row', alignItems: 'center', gap: spacing.innerGap },
  pageDotWrap: { alignItems: 'center', gap: 4 },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
  },
  pageDotActive: { backgroundColor: colors.primary, width: 10, height: 10 },
  pageDotLabel: { ...typography.micro, color: colors.textSecondary },
  pageDotLabelActive: { color: colors.primary },

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

  // Side area
  sideArea: {
    width: 280,
    paddingRight: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
  },

  // Adaptation list
  adaptList: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
  },
  adaptListTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  adaptListHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.innerGap,
  },
  adaptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    paddingVertical: spacing.innerGapSmall,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  adaptItemIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adaptItemLabel: {
    ...typography.resultItem,
    color: colors.textPrimary,
    flex: 1,
  },

  // Help panel (expanded adaptation view)
  helpPanel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    ...shadows.modalSheet,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.innerGap,
  },
  helpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    flex: 1,
  },
  helpTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  helpClose: {
    width: 28,
    height: 28,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpScroll: { flex: 1 },
  helpResultBlock: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
    marginBottom: spacing.innerGap,
  },
  helpResultText: { ...typography.body, color: colors.textPrimary },
  helpChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.innerGapSmall,
    marginBottom: spacing.innerGap,
  },
  helpChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.circle,
    paddingHorizontal: spacing.innerGap,
    paddingVertical: 6,
  },
  helpChipText: { ...typography.caption, color: colors.primary },
  helpBullets: { gap: spacing.innerGapSmall, marginBottom: spacing.innerGap },
  helpBulletRow: { flexDirection: 'row', gap: spacing.innerGapSmall },
  helpBulletDot: { ...typography.body, color: colors.primary },
  helpBulletText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  helpVisuals: { gap: spacing.innerGapSmall, marginBottom: spacing.innerGap },
  helpVisualItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
    alignItems: 'center',
  },
  helpVisualText: { ...typography.bodySmall, color: colors.textSecondary },

  // Empty state
  emptyHelp: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.innerGapSmall,
  },
  emptyHelpText: { ...typography.bodySmall, color: colors.textSecondary },
});
