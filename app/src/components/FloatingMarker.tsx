import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';

type AdaptationType = 'simplify' | 'visuals' | 'summarize';

export type MarkerData = {
  id: string;
  type: AdaptationType;
  label: string;
  position: { x: number; y: number }; // Position relative to worksheet (percentage)
  content: {
    original: string;
    result: string;
    keywords?: string[];
    bullets?: string[];
    visuals?: string[];
  };
};

type Props = {
  marker: MarkerData;
  worksheetWidth: number;
  worksheetHeight: number;
  onDragEnd?: (id: string, position: { x: number; y: number }) => void;
};

const ACTION_META: Record<
  AdaptationType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  simplify: { label: 'Simplified', icon: 'text', color: colors.primary },
  visuals: { label: 'Visuals', icon: 'image', color: '#8B5CF6' },
  summarize: { label: 'Summary', icon: 'list', color: '#10B981' },
};

export default function FloatingMarker({
  marker,
  worksheetWidth,
  worksheetHeight,
  onDragEnd,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const meta = ACTION_META[marker.type];

  // Calculate absolute position from percentage
  const absoluteX = (marker.position.x / 100) * worksheetWidth;
  const absoluteY = (marker.position.y / 100) * worksheetHeight;

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Determine bubble position (left or right of badge)
  const screenWidth = Dimensions.get('window').width;
  const bubbleWidth = 280;
  const showBubbleOnLeft = absoluteX > screenWidth / 2;

  return (
    <>
      {/* Invisible overlay to detect outside clicks */}
      {isExpanded && (
        <Pressable
          style={styles.overlay}
          onPress={() => setIsExpanded(false)}
        />
      )}

      <View
        style={[
          styles.container,
          {
            left: absoluteX,
            top: absoluteY,
          },
        ]}
      >
        {/* Badge button */}
        <Pressable
          style={[styles.badge, { backgroundColor: meta.color }]}
          onPress={toggleExpanded}
        >
          <Ionicons name={meta.icon} size={16} color={colors.surface} />
        </Pressable>

        {/* Popup bubble */}
        <Animated.View
        style={[
          styles.bubble,
          {
            width: bubbleWidth,
            [showBubbleOnLeft ? 'right' : 'left']: 36, // Position next to badge
            opacity: expandAnim,
            transform: [
              {
                scale: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
              {
                translateY: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={isExpanded ? 'auto' : 'none'}
      >
        {/* Triangle pointer */}
        <View
          style={[
            styles.triangle,
            showBubbleOnLeft ? styles.triangleRight : styles.triangleLeft,
          ]}
        />

        {/* Bubble header */}
        <View style={styles.bubbleHeader}>
          <View style={styles.bubbleTitleRow}>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
            <Text style={styles.bubbleTitle} numberOfLines={1}>
              {marker.label}
            </Text>
          </View>
          <Pressable onPress={toggleExpanded} style={styles.bubbleClose}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Bubble content */}
        <ScrollView
          style={styles.bubbleScroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.bubbleLabel}>Original</Text>
          <View style={styles.bubbleTextBlock}>
            <Text style={styles.bubbleOriginalText}>{marker.content.original}</Text>
          </View>

          <View style={styles.arrowRow}>
            <Ionicons name="arrow-down" size={16} color={meta.color} />
          </View>

          <Text style={styles.bubbleLabel}>{meta.label}</Text>
          <View style={[styles.bubbleResultBlock, { backgroundColor: `${meta.color}20` }]}>
            <Text style={styles.bubbleResultText}>{marker.content.result}</Text>
          </View>

          {/* Keywords */}
          {marker.content.keywords && marker.content.keywords.length > 0 && (
            <>
              <Text style={styles.bubbleLabel}>Key Words</Text>
              <View style={styles.keywordsRow}>
                {marker.content.keywords.map((w) => (
                  <View key={w} style={[styles.keywordChip, { backgroundColor: `${meta.color}20` }]}>
                    <Text style={[styles.keywordText, { color: meta.color }]}>{w}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Bullets */}
          {marker.content.bullets && marker.content.bullets.length > 0 && (
            <View style={styles.bulletList}>
              {marker.content.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <Text style={[styles.bulletDot, { color: meta.color }]}>•</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Visuals */}
          {marker.content.visuals && marker.content.visuals.length > 0 && (
            <View style={styles.visualsList}>
              {marker.content.visuals.map((v) => (
                <View key={v} style={styles.visualItem}>
                  <Text style={styles.visualText}>{v}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  container: {
    position: 'absolute',
    zIndex: 100,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radii.circle,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floatingToolbar,
  },

  // Bubble styles
  bubble: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.innerGap,
    maxHeight: 400,
    ...shadows.modalSheet,
  },
  triangle: {
    position: 'absolute',
    top: 8,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  triangleLeft: {
    left: -8,
    borderRightWidth: 8,
    borderRightColor: colors.surface,
  },
  triangleRight: {
    right: -8,
    borderLeftWidth: 8,
    borderLeftColor: colors.surface,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.innerGapSmall,
  },
  bubbleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.innerGapSmall,
    flex: 1,
  },
  bubbleTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    flex: 1,
  },
  bubbleClose: {
    width: 28,
    height: 28,
    borderRadius: radii.circle,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleScroll: {
    maxHeight: 300,
  },
  bubbleLabel: {
    ...typography.overline,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.innerGapSmall,
  },
  bubbleTextBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGapSmall,
  },
  bubbleOriginalText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  arrowRow: {
    alignItems: 'center',
    marginVertical: spacing.innerGapSmall,
  },
  bubbleResultBlock: {
    borderRadius: radii.chip,
    padding: spacing.innerGapSmall,
  },
  bubbleResultText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  keywordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  keywordChip: {
    borderRadius: radii.circle,
    paddingHorizontal: spacing.innerGapSmall,
    paddingVertical: 4,
  },
  keywordText: {
    ...typography.micro,
  },
  bulletList: {
    gap: 4,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
  },
  bulletDot: {
    ...typography.bodySmall,
  },
  bulletText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
  visualsList: {
    gap: 4,
    marginTop: 4,
  },
  visualItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGapSmall,
    alignItems: 'center',
  },
  visualText: {
    ...typography.micro,
    color: colors.textSecondary,
  },
});
