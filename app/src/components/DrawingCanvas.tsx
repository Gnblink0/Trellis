import { useCallback, useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  PanResponder,
  Modal,
  TextInput,
  Pressable,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, {
  Path as SvgPath,
  Ellipse,
  Rect as SvgRect,
  Line as SvgLine,
  Polygon,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { colors, typography, spacing, radii, shadows } from '../theme';

export type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'circle' | 'rect' | 'arrow' | 'text';

export type DrawingPath = {
  path: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  tool: DrawingTool;
  opacity?: number;
};

export type DrawingShape = {
  type: 'circle' | 'rect' | 'arrow';
  start: { x: number; y: number };
  end: { x: number; y: number };
  color: string;
  strokeWidth: number;
};

export type DrawingText = {
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
};

export type DrawingData = {
  paths: DrawingPath[];
  shapes: DrawingShape[];
  texts: DrawingText[];
};

type Props = {
  width: number;
  height: number;
  tool: DrawingTool;
  color: string;
  strokeWidth: number;
  opacity?: number;
  onDrawingChange?: (data: DrawingData) => void;
  initialData?: DrawingData;
};

const MIN_POINT_DISTANCE_SQ = 9; // 3px squared — avoid sqrt per move event

function pointsToSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

export default function DrawingCanvas({
  width,
  height,
  tool,
  color,
  strokeWidth,
  opacity = 1,
  onDrawingChange,
  initialData,
}: Props) {
  const [paths, setPaths] = useState<DrawingPath[]>(initialData?.paths ?? []);
  const [shapes, setShapes] = useState<DrawingShape[]>(initialData?.shapes ?? []);
  const [texts, setTexts] = useState<DrawingText[]>(initialData?.texts ?? []);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[] | null>(null);
  const [currentShape, setCurrentShape] = useState<DrawingShape | null>(null);

  // Text input modal state
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  // Mutable refs so PanResponder always reads current tool/color/strokeWidth
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const opacityRef = useRef(opacity);
  const pathsRef = useRef(paths);
  const shapesRef = useRef(shapes);
  const textsRef = useRef(texts);
  const onDrawingChangeRef = useRef(onDrawingChange);

  // Mutable refs for in-progress drawing (avoid stale closures)
  const currentPathRef = useRef<{ x: number; y: number }[] | null>(null);
  const currentShapeRef = useRef<DrawingShape | null>(null);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { opacityRef.current = opacity; }, [opacity]);
  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { shapesRef.current = shapes; }, [shapes]);
  useEffect(() => { textsRef.current = texts; }, [texts]);
  useEffect(() => { onDrawingChangeRef.current = onDrawingChange; }, [onDrawingChange]);

  const notifyChange = useCallback((newPaths: DrawingPath[], newShapes: DrawingShape[], newTexts: DrawingText[]) => {
    onDrawingChangeRef.current?.({ paths: newPaths, shapes: newShapes, texts: newTexts });
  }, []);

  // Text input handlers
  const handleTextPromptOpen = useCallback((pos: { x: number; y: number }) => {
    setTextPrompt(pos);
    setTextInputValue('');
  }, []);

  const handleTextConfirm = useCallback(() => {
    if (!textPrompt || !textInputValue.trim()) {
      setTextPrompt(null);
      return;
    }
    const newText: DrawingText = {
      text: textInputValue.trim(),
      x: textPrompt.x,
      y: textPrompt.y,
      color: colorRef.current,
      fontSize: strokeWidthRef.current * 3,
    };
    const newTexts = [...textsRef.current, newText];
    setTexts(newTexts);
    textsRef.current = newTexts;
    notifyChange(pathsRef.current, shapesRef.current, newTexts);
    setTextPrompt(null);
  }, [textPrompt, textInputValue, notifyChange]);

  const panResponder = useRef(
    PanResponder.create({
      // Capture phase: claim gesture BEFORE ScrollView can intercept
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Refuse to let ScrollView steal the gesture once we have it
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const t = toolRef.current;

        if (t === 'text') {
          // Open text input modal at tap position (handled via state, not ref)
          // We need to call the state setter from outside the PanResponder closure
          // Use a ref-based callback pattern
          textPromptRef.current?.({ x: locationX, y: locationY });
          return;
        }

        if (t === 'circle' || t === 'rect' || t === 'arrow') {
          const shape: DrawingShape = {
            type: t,
            start: { x: locationX, y: locationY },
            end: { x: locationX, y: locationY },
            color: colorRef.current,
            strokeWidth: strokeWidthRef.current,
          };
          currentShapeRef.current = shape;
          setCurrentShape(shape);
        } else {
          const point = { x: locationX, y: locationY };
          currentPathRef.current = [point];
          setCurrentPath([point]);
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const t = toolRef.current;

        if (t === 'text') return;

        if (t === 'circle' || t === 'rect' || t === 'arrow') {
          if (currentShapeRef.current) {
            const updated = { ...currentShapeRef.current, end: { x: locationX, y: locationY } };
            currentShapeRef.current = updated;
            setCurrentShape(updated);
          }
        } else {
          if (currentPathRef.current && currentPathRef.current.length > 0) {
            const last = currentPathRef.current[currentPathRef.current.length - 1];
            const dx = locationX - last.x;
            const dy = locationY - last.y;
            if (dx * dx + dy * dy < MIN_POINT_DISTANCE_SQ) return;

            const updated = [...currentPathRef.current, { x: locationX, y: locationY }];
            currentPathRef.current = updated;
            setCurrentPath(updated);
          }
        }
      },
      onPanResponderRelease: (evt) => {
        const t = toolRef.current;
        if (t === 'text') return;

        if (t === 'circle' || t === 'rect' || t === 'arrow') {
          if (currentShapeRef.current) {
            const newShapes = [...shapesRef.current, currentShapeRef.current];
            setShapes(newShapes);
            shapesRef.current = newShapes;
            currentShapeRef.current = null;
            setCurrentShape(null);
            notifyChange(pathsRef.current, newShapes, textsRef.current);
          }
        } else {
          if (currentPathRef.current && currentPathRef.current.length >= 1) {
            // For single-point taps, duplicate the point so SVG renders a dot
            const pts = currentPathRef.current;
            const finalPts = pts.length === 1
              ? [pts[0], { x: pts[0].x + 0.5, y: pts[0].y + 0.5 }]
              : pts;

            const newPath: DrawingPath = {
              path: finalPts,
              color: t === 'eraser' ? '#FFFFFF' : colorRef.current,
              strokeWidth: t === 'eraser' ? strokeWidthRef.current * 2 : strokeWidthRef.current,
              tool: t,
              opacity: t === 'highlighter' ? 0.4 : opacityRef.current,
            };
            const newPaths = [...pathsRef.current, newPath];
            setPaths(newPaths);
            pathsRef.current = newPaths;
            notifyChange(newPaths, shapesRef.current, textsRef.current);
          }
          currentPathRef.current = null;
          setCurrentPath(null);
        }
      },
    })
  ).current;

  // Ref-based callback for text prompt (allows PanResponder to trigger state update)
  const textPromptRef = useRef<((pos: { x: number; y: number }) => void) | null>(null);
  textPromptRef.current = handleTextPromptOpen;

  // Sync external data (undo/redo/clear)
  useEffect(() => {
    if (initialData) {
      setPaths(initialData.paths);
      setShapes(initialData.shapes);
      setTexts(initialData.texts);
      pathsRef.current = initialData.paths;
      shapesRef.current = initialData.shapes;
      textsRef.current = initialData.texts;
    }
  }, [initialData]);

  return (
    <>
      <View style={[styles.container, { width, height }]} {...panResponder.panHandlers}>
        <Svg width={width} height={height}>
          {/* Completed paths */}
          {paths.map((item, index) => (
            <SvgPath
              key={`path-${index}`}
              d={pointsToSvgPath(item.path)}
              stroke={item.color}
              strokeWidth={item.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={item.opacity ?? 1}
            />
          ))}

          {/* In-progress path */}
          {currentPath && currentPath.length >= 2 && (
            <SvgPath
              d={pointsToSvgPath(currentPath)}
              stroke={tool === 'eraser' ? '#FFFFFF' : color}
              strokeWidth={tool === 'eraser' ? strokeWidth * 2 : strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={tool === 'highlighter' ? 0.4 : opacity}
            />
          )}

          {/* Completed shapes */}
          {shapes.map((shape, index) => renderShape(shape, `shape-${index}`))}

          {/* In-progress shape */}
          {currentShape && renderShape(currentShape, 'shape-current')}

          {/* Texts */}
          {texts.map((item, index) => (
            <SvgText
              key={`text-${index}`}
              x={item.x}
              y={item.y}
              fill={item.color}
              fontSize={item.fontSize}
              fontFamily="System"
            >
              {item.text}
            </SvgText>
          ))}
        </Svg>
      </View>

      {/* Text input modal */}
      <Modal
        visible={textPrompt !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTextPrompt(null)}
      >
        <KeyboardAvoidingView
          style={styles.textModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTextPrompt(null)} />
          <View style={styles.textModalContent}>
            <Text style={styles.textModalTitle}>Add Text</Text>
            <TextInput
              style={styles.textModalInput}
              placeholder="Type here..."
              placeholderTextColor={colors.textSecondary}
              value={textInputValue}
              onChangeText={setTextInputValue}
              autoFocus
              multiline
              onSubmitEditing={handleTextConfirm}
              blurOnSubmit
            />
            <View style={styles.textModalActions}>
              <Pressable style={styles.textModalCancel} onPress={() => setTextPrompt(null)}>
                <Text style={styles.textModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.textModalConfirm} onPress={handleTextConfirm}>
                <Text style={styles.textModalConfirmText}>Place</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function renderShape(shape: DrawingShape, key: string) {
  if (shape.type === 'circle') {
    const rx = Math.abs(shape.end.x - shape.start.x);
    const ry = Math.abs(shape.end.y - shape.start.y);
    const radius = Math.sqrt(rx * rx + ry * ry);
    return (
      <Ellipse
        key={key}
        cx={shape.start.x}
        cy={shape.start.y}
        rx={radius}
        ry={radius}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        fill="none"
      />
    );
  }

  if (shape.type === 'rect') {
    const x = Math.min(shape.start.x, shape.end.x);
    const y = Math.min(shape.start.y, shape.end.y);
    const w = Math.abs(shape.end.x - shape.start.x);
    const h = Math.abs(shape.end.y - shape.start.y);
    return (
      <SvgRect
        key={key}
        x={x}
        y={y}
        width={w}
        height={h}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth}
        fill="none"
      />
    );
  }

  if (shape.type === 'arrow') {
    const angle = Math.atan2(
      shape.end.y - shape.start.y,
      shape.end.x - shape.start.x,
    );
    const headLength = 20;
    const headAngle = Math.PI / 6; // 30 degrees

    const tip = shape.end;
    const left = {
      x: tip.x - headLength * Math.cos(angle - headAngle),
      y: tip.y - headLength * Math.sin(angle - headAngle),
    };
    const right = {
      x: tip.x - headLength * Math.cos(angle + headAngle),
      y: tip.y - headLength * Math.sin(angle + headAngle),
    };

    return (
      <G key={key}>
        <SvgLine
          x1={shape.start.x}
          y1={shape.start.y}
          x2={shape.end.x}
          y2={shape.end.y}
          stroke={shape.color}
          strokeWidth={shape.strokeWidth}
          strokeLinecap="round"
        />
        <Polygon
          points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
          fill={shape.color}
        />
      </G>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Text input modal
  textModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.pagePadding,
  },
  textModalContent: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.pagePadding,
    width: '100%',
    maxWidth: 360,
    ...shadows.modalSheet,
  },
  textModalTitle: {
    ...typography.cardTitle,
    color: colors.textPrimary,
    marginBottom: spacing.innerGap,
  },
  textModalInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.chip,
    padding: spacing.innerGap,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  textModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.innerGapSmall,
    marginTop: spacing.innerGap,
  },
  textModalCancel: {
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceMuted,
  },
  textModalCancelText: {
    ...typography.cardTitle,
    color: colors.textSecondary,
  },
  textModalConfirm: {
    paddingHorizontal: spacing.pagePadding,
    paddingVertical: spacing.innerGapSmall,
    borderRadius: radii.chip,
    backgroundColor: colors.primary,
  },
  textModalConfirmText: {
    ...typography.cardTitle,
    color: colors.surface,
  },
});
