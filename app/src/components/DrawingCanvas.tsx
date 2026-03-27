import { useCallback, useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  PanResponder,
  TextInput,
  Text,
} from 'react-native';
import Svg, {
  Path as SvgPath,
  Ellipse,
  Rect as SvgRect,
  Line as SvgLine,
  Polygon,
  G,
} from 'react-native-svg';
import { colors, spacing, radii } from '../theme';

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
  /** When false, touches pass through to ScrollView for scrolling. */
  enabled?: boolean;
  onDrawingChange?: (data: DrawingData) => void;
  initialData?: DrawingData;
};

const MIN_POINT_DISTANCE_SQ = 9; // 3px squared
const DRAG_THRESHOLD_SQ = 25; // 5px squared — distinguish tap from drag

function pointsToSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Hit-testing helpers (eraser + text selection)
// ---------------------------------------------------------------------------
type Point = { x: number; y: number };

function distSq(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** Squared distance from point p to the closest point on segment v→w. */
function distToSegmentSq(p: Point, v: Point, w: Point): number {
  const l2 = distSq(v, w);
  if (l2 === 0) return distSq(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distSq(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

function isPathHit(touch: Point, path: DrawingPath, radiusSq: number): boolean {
  const pts = path.path;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegmentSq(touch, pts[i], pts[i + 1]) <= radiusSq) return true;
  }
  if (pts.length >= 1 && distSq(touch, pts[0]) <= radiusSq) return true;
  return false;
}

function isShapeHit(touch: Point, shape: DrawingShape, radiusSq: number): boolean {
  if (shape.type === 'arrow') {
    return distToSegmentSq(touch, shape.start, shape.end) <= radiusSq;
  }
  if (shape.type === 'rect') {
    const x1 = Math.min(shape.start.x, shape.end.x);
    const y1 = Math.min(shape.start.y, shape.end.y);
    const x2 = Math.max(shape.start.x, shape.end.x);
    const y2 = Math.max(shape.start.y, shape.end.y);
    return (
      distToSegmentSq(touch, { x: x1, y: y1 }, { x: x2, y: y1 }) <= radiusSq ||
      distToSegmentSq(touch, { x: x2, y: y1 }, { x: x2, y: y2 }) <= radiusSq ||
      distToSegmentSq(touch, { x: x2, y: y2 }, { x: x1, y: y2 }) <= radiusSq ||
      distToSegmentSq(touch, { x: x1, y: y2 }, { x: x1, y: y1 }) <= radiusSq
    );
  }
  if (shape.type === 'circle') {
    const rx = Math.abs(shape.end.x - shape.start.x);
    const ry = Math.abs(shape.end.y - shape.start.y);
    const r = Math.sqrt(rx * rx + ry * ry);
    const dist = Math.sqrt(distSq(touch, shape.start));
    return (dist - r) ** 2 <= radiusSq;
  }
  return false;
}

/** Hit-test a text overlay (generous bounds for easy tapping). */
function isTextHit(touch: Point, text: DrawingText): boolean {
  const w = Math.max(text.text.length * text.fontSize * 0.55, 60);
  const h = Math.max(text.fontSize * 1.6, 28);
  return (
    touch.x >= text.x - 8 && touch.x <= text.x + w + 8 &&
    touch.y >= text.y - 8 && touch.y <= text.y + h + 8
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DrawingCanvas({
  width,
  height,
  tool,
  color,
  strokeWidth,
  opacity = 1,
  enabled = true,
  onDrawingChange,
  initialData,
}: Props) {
  const [paths, setPaths] = useState<DrawingPath[]>(initialData?.paths ?? []);
  const [shapes, setShapes] = useState<DrawingShape[]>(initialData?.shapes ?? []);
  const [texts, setTexts] = useState<DrawingText[]>(initialData?.texts ?? []);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[] | null>(null);
  const [currentShape, setCurrentShape] = useState<DrawingShape | null>(null);

  /** Index of the text currently being edited inline, or null. */
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);

  // Mutable refs so PanResponder always reads current values
  const enabledRef = useRef(enabled);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef(strokeWidth);
  const opacityRef = useRef(opacity);
  const pathsRef = useRef(paths);
  const shapesRef = useRef(shapes);
  const textsRef = useRef(texts);
  const onDrawingChangeRef = useRef(onDrawingChange);
  const editingTextIndexRef = useRef(editingTextIndex);

  // In-progress drawing refs
  const currentPathRef = useRef<{ x: number; y: number }[] | null>(null);
  const currentShapeRef = useRef<DrawingShape | null>(null);
  const draggingTextRef = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { opacityRef.current = opacity; }, [opacity]);
  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { shapesRef.current = shapes; }, [shapes]);
  useEffect(() => { textsRef.current = texts; }, [texts]);
  useEffect(() => { onDrawingChangeRef.current = onDrawingChange; }, [onDrawingChange]);
  useEffect(() => { editingTextIndexRef.current = editingTextIndex; }, [editingTextIndex]);

  // -----------------------------------------------------------------------
  // Eraser: remove any drawn element near the touch point
  // -----------------------------------------------------------------------
  const eraseAtPoint = useCallback((touch: Point) => {
    const radius = Math.max(strokeWidthRef.current * 2, 15);
    const radiusSq = radius * radius;
    let changed = false;

    const newPaths = pathsRef.current.filter((p) => !isPathHit(touch, p, radiusSq));
    if (newPaths.length !== pathsRef.current.length) {
      pathsRef.current = newPaths;
      setPaths(newPaths);
      changed = true;
    }

    const newShapes = shapesRef.current.filter((s) => !isShapeHit(touch, s, radiusSq));
    if (newShapes.length !== shapesRef.current.length) {
      shapesRef.current = newShapes;
      setShapes(newShapes);
      changed = true;
    }

    const newTexts = textsRef.current.filter((t) => !isTextHit(touch, t));
    if (newTexts.length !== textsRef.current.length) {
      textsRef.current = newTexts;
      setTexts(newTexts);
      changed = true;
    }

    if (changed) {
      onDrawingChangeRef.current?.({ paths: pathsRef.current, shapes: shapesRef.current, texts: textsRef.current });
    }
  }, []);

  const eraseAtPointRef = useRef(eraseAtPoint);
  eraseAtPointRef.current = eraseAtPoint;

  // -----------------------------------------------------------------------
  // Text editing helpers
  // -----------------------------------------------------------------------
  const handleTextChange = useCallback((index: number, newText: string) => {
    const updated = [...textsRef.current];
    updated[index] = { ...updated[index], text: newText };
    textsRef.current = updated;
    setTexts(updated);
  }, []);

  /** Finalize text editing — remove empty texts, notify parent. */
  const finalizeTextEdit = useCallback(() => {
    const idx = editingTextIndexRef.current;
    if (idx === null) return;

    // Remove empty text boxes
    if (!textsRef.current[idx]?.text?.trim()) {
      const filtered = textsRef.current.filter((_, i) => i !== idx);
      textsRef.current = filtered;
      setTexts(filtered);
    }

    editingTextIndexRef.current = null;
    setEditingTextIndex(null);
    onDrawingChangeRef.current?.({ paths: pathsRef.current, shapes: shapesRef.current, texts: textsRef.current });
  }, []);

  const finalizeTextEditRef = useRef(finalizeTextEdit);
  finalizeTextEditRef.current = finalizeTextEdit;

  // -----------------------------------------------------------------------
  // PanResponder
  // -----------------------------------------------------------------------
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) => {
        if (!enabledRef.current) return false;
        // If editing a text, let touches ON the text box through to TextInput
        if (editingTextIndexRef.current !== null) {
          const { locationX, locationY } = evt.nativeEvent;
          const txt = textsRef.current[editingTextIndexRef.current];
          if (txt && isTextHit({ x: locationX, y: locationY }, txt)) {
            return false; // Let TextInput handle this touch
          }
        }
        return true;
      },
      onMoveShouldSetPanResponderCapture: (evt) => {
        if (!enabledRef.current) return false;
        if (editingTextIndexRef.current !== null) {
          const { locationX, locationY } = evt.nativeEvent;
          const txt = textsRef.current[editingTextIndexRef.current];
          if (txt && isTextHit({ x: locationX, y: locationY }, txt)) {
            return false;
          }
        }
        return true;
      },
      onStartShouldSetPanResponder: () => enabledRef.current,
      onMoveShouldSetPanResponder: () => enabledRef.current,
      onPanResponderTerminationRequest: () => !enabledRef.current,
      onShouldBlockNativeResponder: () => enabledRef.current,

      // --- GRANT ---
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const t = toolRef.current;
        const touch: Point = { x: locationX, y: locationY };

        // If editing a text and tapped outside it, dismiss editing first
        if (editingTextIndexRef.current !== null) {
          finalizeTextEditRef.current?.();
          return; // Consume this tap (don't start a new action)
        }

        // --- Eraser ---
        if (t === 'eraser') {
          eraseAtPointRef.current?.(touch);
          return;
        }

        // --- Text tool ---
        if (t === 'text') {
          const hitIndex = textsRef.current.findIndex((txt) => isTextHit(touch, txt));
          if (hitIndex >= 0) {
            // Touched an existing text — prepare for drag or tap-to-edit
            const txt = textsRef.current[hitIndex];
            draggingTextRef.current = {
              index: hitIndex,
              startX: locationX,
              startY: locationY,
              origX: txt.x,
              origY: txt.y,
            };
            didDragRef.current = false;
          } else {
            // Tap on empty space — create a new text box and start editing
            const newText: DrawingText = {
              text: '',
              x: locationX,
              y: locationY,
              color: colorRef.current,
              fontSize: Math.max(strokeWidthRef.current * 3, 14),
            };
            const newTexts = [...textsRef.current, newText];
            textsRef.current = newTexts;
            setTexts(newTexts);
            const newIndex = newTexts.length - 1;
            editingTextIndexRef.current = newIndex;
            setEditingTextIndex(newIndex);
          }
          return;
        }

        // --- Shape tools ---
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
          return;
        }

        // --- Freeform (pen / highlighter) ---
        const point = { x: locationX, y: locationY };
        currentPathRef.current = [point];
        setCurrentPath([point]);
      },

      // --- MOVE ---
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const t = toolRef.current;

        // Eraser: continuously remove elements under finger
        if (t === 'eraser') {
          eraseAtPointRef.current?.({ x: locationX, y: locationY });
          return;
        }

        // Text drag
        if (t === 'text') {
          if (draggingTextRef.current) {
            const { index, startX, startY, origX, origY } = draggingTextRef.current;
            const dx = locationX - startX;
            const dy = locationY - startY;

            if (!didDragRef.current && dx * dx + dy * dy >= DRAG_THRESHOLD_SQ) {
              didDragRef.current = true;
            }

            if (didDragRef.current) {
              const updated = [...textsRef.current];
              updated[index] = { ...updated[index], x: origX + dx, y: origY + dy };
              textsRef.current = updated;
              setTexts(updated);
            }
          }
          return;
        }

        // Shape preview
        if (t === 'circle' || t === 'rect' || t === 'arrow') {
          if (currentShapeRef.current) {
            const updated = { ...currentShapeRef.current, end: { x: locationX, y: locationY } };
            currentShapeRef.current = updated;
            setCurrentShape(updated);
          }
          return;
        }

        // Freeform path
        if (currentPathRef.current && currentPathRef.current.length > 0) {
          const last = currentPathRef.current[currentPathRef.current.length - 1];
          const dx = locationX - last.x;
          const dy = locationY - last.y;
          if (dx * dx + dy * dy < MIN_POINT_DISTANCE_SQ) return;

          const updated = [...currentPathRef.current, { x: locationX, y: locationY }];
          currentPathRef.current = updated;
          setCurrentPath(updated);
        }
      },

      // --- RELEASE ---
      onPanResponderRelease: () => {
        const t = toolRef.current;

        if (t === 'eraser') return;

        // Text: finalize drag or enter edit mode (tap)
        if (t === 'text') {
          if (draggingTextRef.current) {
            const { index } = draggingTextRef.current;
            if (!didDragRef.current) {
              // Was a tap → enter edit mode
              editingTextIndexRef.current = index;
              setEditingTextIndex(index);
            } else {
              // Was a drag → notify position change
              onDrawingChangeRef.current?.({
                paths: pathsRef.current,
                shapes: shapesRef.current,
                texts: textsRef.current,
              });
            }
            draggingTextRef.current = null;
          }
          return;
        }

        // Shape: finalize
        if (t === 'circle' || t === 'rect' || t === 'arrow') {
          if (currentShapeRef.current) {
            const newShapes = [...shapesRef.current, currentShapeRef.current];
            setShapes(newShapes);
            shapesRef.current = newShapes;
            currentShapeRef.current = null;
            setCurrentShape(null);
            onDrawingChangeRef.current?.({ paths: pathsRef.current, shapes: newShapes, texts: textsRef.current });
          }
          return;
        }

        // Freeform: finalize path
        if (currentPathRef.current && currentPathRef.current.length >= 1) {
          const pts = currentPathRef.current;
          const finalPts = pts.length === 1
            ? [pts[0], { x: pts[0].x + 0.5, y: pts[0].y + 0.5 }]
            : pts;

          const newPath: DrawingPath = {
            path: finalPts,
            color: colorRef.current,
            strokeWidth: strokeWidthRef.current,
            tool: t,
            opacity: t === 'highlighter' ? 0.4 : opacityRef.current,
          };
          const newPaths = [...pathsRef.current, newPath];
          setPaths(newPaths);
          pathsRef.current = newPaths;
          onDrawingChangeRef.current?.({ paths: newPaths, shapes: shapesRef.current, texts: textsRef.current });
        }
        currentPathRef.current = null;
        setCurrentPath(null);
      },
    })
  ).current;

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

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
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
            stroke={color}
            strokeWidth={strokeWidth}
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
      </Svg>

      {/* Text overlays — rendered as RN Views (not SVG) so they can be edited */}
      {texts.map((item, index) =>
        editingTextIndex === index ? (
          <TextInput
            key={`text-edit-${index}`}
            style={[
              styles.textEditInput,
              { left: item.x, top: item.y, color: item.color, fontSize: item.fontSize },
            ]}
            value={item.text}
            placeholder="Type here..."
            placeholderTextColor={colors.textSecondary}
            onChangeText={(t) => handleTextChange(index, t)}
            autoFocus
            multiline
            onBlur={() => finalizeTextEditRef.current?.()}
          />
        ) : item.text ? (
          <View
            key={`text-${index}`}
            style={[styles.textOverlay, { left: item.x, top: item.y }]}
            pointerEvents="none"
          >
            <Text style={{ color: item.color, fontSize: item.fontSize }}>
              {item.text}
            </Text>
          </View>
        ) : null,
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shape renderer (unchanged)
// ---------------------------------------------------------------------------
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
    const headAngle = Math.PI / 6;

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  textOverlay: {
    position: 'absolute',
    paddingHorizontal: spacing.innerGapSmall,
    paddingVertical: 2,
  },
  textEditInput: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.innerGapSmall,
    paddingVertical: 2,
    minWidth: 60,
    minHeight: 28,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});
