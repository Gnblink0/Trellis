import { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { colors } from '../theme';
import {
  getImageSize,
  normalizeToMaxWidth,
  WORKSHEET_MERGE_MAX_WIDTH,
} from '../utils/worksheetImages';

type Props = {
  pageUris: string[];
  onDone: (mergedUri: string) => void;
  onError: (err: unknown) => void;
};

/**
 * Renders stacked worksheet pages (off-screen) and snapshots them into one JPEG for the process API.
 */
export default function WorksheetPageMerge({ pageUris, onDone, onError }: Props) {
  const ref = useRef<View>(null);
  const [stack, setStack] = useState<{ uri: string; height: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStack(null);
    (async () => {
      try {
        const normalized = await Promise.all(
          pageUris.map((u) => normalizeToMaxWidth(u, WORKSHEET_MERGE_MAX_WIDTH))
        );
        const sizes = await Promise.all(normalized.map((u) => getImageSize(u)));
        if (cancelled) return;
        const W = WORKSHEET_MERGE_MAX_WIDTH;
        setStack(
          normalized.map((uri, i) => ({
            uri,
            height: W * (sizes[i]!.height / sizes[i]!.width),
          }))
        );
      } catch (e) {
        onError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageUris, onError]);

  useEffect(() => {
    if (!stack || stack.length === 0) return;

    let cancelled = false;

    void (async () => {
      try {
        try {
          await Promise.all(stack.map((s) => Image.prefetch(s.uri)));
        } catch {
          /* local file URIs may not prefetch; snapshot still works after delay */
        }
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 350));
        if (cancelled) return;
        const node = ref.current;
        if (!node) {
          onError(new Error('Merge view not ready'));
          return;
        }
        const uri = await captureRef(node, {
          format: 'jpg',
          quality: 0.88,
          result: 'tmpfile',
        });
        onDone(uri);
      } catch (e) {
        if (!cancelled) onError(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stack, onDone, onError]);

  if (!stack || stack.length === 0) return null;

  const W = WORKSHEET_MERGE_MAX_WIDTH;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={styles.offscreen}
      pointerEvents="none"
    >
      {stack.map((item, i) => (
        <Image
          key={`${item.uri}-${i}`}
          source={{ uri: item.uri }}
          style={{ width: W, height: item.height }}
          resizeMode="stretch"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -16000,
    top: 0,
    opacity: 0.02,
    width: WORKSHEET_MERGE_MAX_WIDTH,
    backgroundColor: colors.surface,
  },
});
