import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows } from '../theme';

type AdaptationType = 'simplify' | 'visuals' | 'summarize';
export type MarkerState = 'loading' | 'ready' | 'reviewed';

export type MarkerData = {
  id: string;
  type: AdaptationType;
  label: string;
  state: MarkerState;
  position: { x: number; y: number }; // Position relative to worksheet (percentage)
  content: {
    original: string;
    result: string;
    keywords?: string[];
    bullets?: string[];
    visuals?: string[];
    visualUrl?: string;
  } | null; // null while loading
};

type Props = {
  marker: MarkerData;
  worksheetWidth: number;
  worksheetHeight: number;
  onDragEnd?: (id: string, position: { x: number; y: number }) => void;
  onPress?: (marker: MarkerData) => void;
};

const ACTION_META: Record<
  AdaptationType,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  simplify: { label: 'Simplified', icon: 'text', color: colors.actionSimplify },
  visuals: { label: 'Visuals', icon: 'image', color: colors.actionVisuals },
  summarize: { label: 'Summary', icon: 'list', color: colors.actionSummarize },
};

export default function FloatingMarker({
  marker,
  worksheetWidth,
  worksheetHeight,
  onDragEnd,
  onPress,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const notifAnim = useRef(new Animated.Value(1)).current;

  const meta = ACTION_META[marker.type];

  // Calculate absolute position from percentage
  const absoluteX = (marker.position.x / 100) * worksheetWidth;
  const absoluteY = (marker.position.y / 100) * worksheetHeight;

  // Loading pulse animation (skip for reviewed — no Animated.View used)
  useEffect(() => {
    if (marker.state !== 'loading') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.9, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [marker.state]);

  // Ready notification dot breathing animation (skip for reviewed)
  useEffect(() => {
    if (marker.state !== 'ready') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(notifAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(notifAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [marker.state]);

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [isExpanded]);

  const handleBadgePress = () => {
    if (marker.state === 'loading') return; // no-op while loading
    if (marker.state === 'ready') {
      // Delegate to parent to open preview modal
      onPress?.(marker);
      return;
    }
    // reviewed: toggle inline popup
    setIsExpanded(!isExpanded);
  };

  // Determine bubble position (left or right of badge)
  const screenWidth = Dimensions.get('window').width;
  const bubbleWidth = 280;
  const showBubbleOnLeft = absoluteX > screenWidth / 2;

  const isLoading = marker.state === 'loading';

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
        {/* Badge button — only use Animated.View for loading/ready (avoids Reanimated conflicts for static reviewed markers) */}
        {marker.state === 'reviewed' ? (
          <View>
            <Pressable
              style={[styles.badge, { backgroundColor: meta.color }]}
              onPress={handleBadgePress}
            >
              <Ionicons name={meta.icon} size={16} color={colors.surface} />
            </Pressable>
          </View>
        ) : (
          <Animated.View
            style={[
              { transform: [{ scale: pulseAnim }] },
              isLoading && { opacity: 0.7 },
            ]}
          >
            <Pressable
              style={[styles.badge, { backgroundColor: meta.color }]}
              onPress={handleBadgePress}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Ionicons name={meta.icon} size={16} color={colors.surface} />
              )}
            </Pressable>

            {/* Notification dot for "ready" state */}
            {marker.state === 'ready' && (
              <Animated.View
                style={[
                  styles.notificationDot,
                  { opacity: notifAnim },
                ]}
              />
            )}
          </Animated.View>
        )}

        {/* Popup bubble — only for reviewed markers with content */}
        {marker.state === 'reviewed' && marker.content && (
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
            <Pressable onPress={() => setIsExpanded(false)} style={styles.bubbleClose}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Bubble content */}
          <ScrollView
            style={styles.bubbleScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Result block */}
            <View style={[styles.bubbleResultBlock, { backgroundColor: `${meta.color}20` }]}>
              {/* Summary: bullets inside block */}
              {marker.content.bullets && marker.content.bullets.length > 0 ? (
                <View style={styles.bulletList}>
                  {marker.content.bullets.map((b) => (
                    <View key={b} style={styles.bulletRow}>
                      <Text style={[styles.bulletDot, { color: meta.color }]}>•</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.bubbleResultText}>{marker.content.result}</Text>
              )}
            </View>

            {/* Keywords */}
            {marker.content.keywords && marker.content.keywords.length > 0 && (
              <View style={styles.keywordsRow}>
                {marker.content.keywords.map((w) => (
                  <View key={w} style={[styles.keywordChip, { backgroundColor: `${meta.color}20` }]}>
                    <Text style={[styles.keywordText, { color: meta.color }]}>{w}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Visual image or fallback hints */}
            {marker.content.visualUrl ? (
              <Image
                source={{ uri: marker.content.visualUrl }}
                style={styles.bubbleVisualImage}
                resizeMode="contain"
              />
            ) : (
              marker.content.visuals && marker.content.visuals.length > 0 && (
                <View style={styles.visualsList}>
                  {marker.content.visuals.map((v) => (
                    <View key={v} style={styles.visualItem}>
                      <Text style={styles.visualText}>{v}</Text>
                    </View>
                  ))}
                </View>
              )
            )}
          </ScrollView>
          </Animated.View>
        )}
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
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.markerNotification,
    borderWidth: 1.5,
    borderColor: colors.surface,
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
    marginTop: spacing.innerGapSmall,
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
  bubbleVisualImage: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 180,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.innerGapSmall,
  },
});
