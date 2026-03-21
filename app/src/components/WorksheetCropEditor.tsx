import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
  PanResponder,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii } from '../theme';
import {
  computeContainRect,
  displayCropToImagePixels,
  getImageSize,
} from '../utils/worksheetImages';

const MIN_CROP = 48;
const HANDLE = 36;

type Props = {
  uri: string;
  onConfirm: (croppedUri: string) => void;
  onSkipFullImage: () => void;
  onCancel: () => void;
};

function DimMask({
  cw,
  ch,
  crop,
}: {
  cw: number;
  ch: number;
  crop: { left: number; top: number; width: number; height: number };
}) {
  const bg = colors.scrim;
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: cw,
          height: crop.top,
          backgroundColor: bg,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: crop.top + crop.height,
          width: cw,
          height: Math.max(0, ch - crop.top - crop.height),
          backgroundColor: bg,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: crop.top,
          width: crop.left,
          height: crop.height,
          backgroundColor: bg,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: crop.left + crop.width,
          top: crop.top,
          width: Math.max(0, cw - crop.left - crop.width),
          height: crop.height,
          backgroundColor: bg,
        }}
      />
    </>
  );
}

export default function WorksheetCropEditor({
  uri,
  onConfirm,
  onSkipFullImage,
  onCancel,
}: Props) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);

  const [crop, setCrop] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const cropRef = useRef(crop);
  cropRef.current = crop;

  const moveStart = useRef({ l: 0, t: 0, w: 0, h: 0 });
  const resizeStart = useRef({ w: 0, h: 0 });

  useEffect(() => {
    setCrop(null);
    setNatural(null);
    void getImageSize(uri)
      .then(({ width, height }) => setNatural({ w: width, h: height }))
      .catch(() => setNatural(null));
  }, [uri]);

  const fitted = useMemo(() => {
    if (!natural || container.w < 1 || container.h < 1) return null;
    return computeContainRect(container.w, container.h, natural.w, natural.h);
  }, [natural, container.w, container.h]);

  useEffect(() => {
    if (!fitted || !natural) return;
    setCrop((prev) => {
      if (prev) return prev;
      const m = 8;
      return {
        left: fitted.x + m,
        top: fitted.y + m,
        width: Math.max(MIN_CROP, fitted.width - m * 2),
        height: Math.max(MIN_CROP, fitted.height - m * 2),
      };
    });
  }, [fitted, natural]);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ w: width, h: height });
  }, []);

  const clampCrop = useCallback(
    (c: { left: number; top: number; width: number; height: number }) => {
      if (!fitted) return c;
      const width = Math.max(
        MIN_CROP,
        Math.min(c.width, fitted.width)
      );
      const height = Math.max(
        MIN_CROP,
        Math.min(c.height, fitted.height)
      );
      const left = Math.max(
        fitted.x,
        Math.min(c.left, fitted.x + fitted.width - width)
      );
      const top = Math.max(
        fitted.y,
        Math.min(c.top, fitted.y + fitted.height - height)
      );
      return { left, top, width, height };
    },
    [fitted]
  );

  const movePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const cur = cropRef.current;
          if (cur) {
            moveStart.current = { l: cur.left, t: cur.top, w: cur.width, h: cur.height };
          }
        },
        onPanResponderMove: (_, g) => {
          const s = moveStart.current;
          if (!fitted) return;
          setCrop(
            clampCrop({
              left: s.l + g.dx,
              top: s.t + g.dy,
              width: s.w,
              height: s.h,
            })
          );
        },
      }),
    [clampCrop, fitted]
  );

  const resizePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const cur = cropRef.current;
          if (cur) {
            resizeStart.current = { w: cur.width, h: cur.height };
          }
        },
        onPanResponderMove: (_, g) => {
          const cur = cropRef.current;
          if (!cur || !fitted) return;
          const s = resizeStart.current;
          setCrop(
            clampCrop({
              ...cur,
              width: s.w + g.dx,
              height: s.h + g.dy,
            })
          );
        },
      }),
    [clampCrop, fitted]
  );

  const applyCrop = useCallback(async () => {
    if (!natural || !fitted || !crop) return;
    setBusy(true);
    try {
      const px = displayCropToImagePixels(crop, fitted, natural.w, natural.h);
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: px.originX,
              originY: px.originY,
              width: px.width,
              height: px.height,
            },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      onConfirm(out.uri);
    } finally {
      setBusy(false);
    }
  }, [natural, fitted, crop, uri, onConfirm]);

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.overlay}>
        <View style={styles.webMsg}>
          <Text style={styles.webMsgText}>
            Cropping is not available on web. Use full image or open the app on a device.
          </Text>
          <Pressable style={styles.secondaryBtn} onPress={onSkipFullImage}>
            <Text style={styles.secondaryBtnText}>Use full image</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={onCancel}>
            <Text style={styles.primaryBtnText}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.toolbar}>
        <Pressable onPress={onCancel} style={styles.iconBtn} hitSlop={spacing.innerGapSmall}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.toolbarTitle}>Crop page</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.stage} onLayout={onContainerLayout}>
        {!natural ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
            {fitted && crop && container.w > 0 && container.h > 0 ? (
              <DimMask cw={container.w} ch={container.h} crop={crop} />
            ) : null}
            {fitted && crop ? (
              <View
                style={[
                  styles.cropBox,
                  {
                    left: crop.left,
                    top: crop.top,
                    width: crop.width,
                    height: crop.height,
                  },
                ]}
                {...movePan.panHandlers}
              >
                <View style={styles.cropInner} />
                <View style={styles.handleBR} {...resizePan.panHandlers}>
                  <Ionicons name="contract-outline" size={20} color={colors.primary} />
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>Drag the box to move. Drag the handle to resize.</Text>
        <View style={styles.footerRow}>
          <Pressable style={styles.secondaryBtn} onPress={onSkipFullImage} disabled={busy}>
            <Text style={styles.secondaryBtnText}>Use full image</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
            onPress={() => void applyCrop()}
            disabled={busy || !crop}
          >
            {busy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.primaryBtnText}>Apply crop</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 100,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  toolbarTitle: { ...typography.title, color: colors.textPrimary },
  stage: {
    flex: 1,
    marginHorizontal: spacing.pagePadding,
    marginBottom: spacing.innerGap,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  cropInner: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  handleBR: {
    position: 'absolute',
    right: -HANDLE / 2,
    bottom: -HANDLE / 2,
    width: HANDLE,
    height: HANDLE,
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  footer: {
    paddingHorizontal: spacing.pagePadding,
    paddingBottom: spacing.sectionGapBottom,
    gap: spacing.innerGap,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.innerGapSmall,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    paddingVertical: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    borderRadius: radii.secondaryButton,
    backgroundColor: colors.surfaceMuted,
  },
  secondaryBtnText: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  primaryBtn: {
    paddingVertical: spacing.innerGapSmall,
    paddingHorizontal: spacing.innerGap,
    borderRadius: radii.secondaryButton,
    backgroundColor: colors.primary,
    minWidth: 160,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    ...typography.button,
    color: colors.surface,
  },
  webMsg: {
    flex: 1,
    padding: spacing.pagePadding,
    justifyContent: 'center',
    gap: spacing.innerGap,
  },
  webMsgText: { ...typography.body, color: colors.textSecondary },
});
