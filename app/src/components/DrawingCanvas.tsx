import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  SkPath,
  Group,
  Circle,
  Rect,
  vec,
  Line,
  Text as SkiaText,
  useFont,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'circle' | 'rect' | 'arrow' | 'text';

export type DrawingPath = {
  path: SkPath;
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

  const currentPath = useRef<SkPath | null>(null);
  const currentShape = useRef<DrawingShape | null>(null);

  const notifyChange = useCallback(() => {
    if (onDrawingChange) {
      onDrawingChange({ paths, shapes, texts });
    }
  }, [paths, shapes, texts, onDrawingChange]);

  // Gesture for drawing paths (pen, highlighter, eraser)
  const panGesture = Gesture.Pan()
    .onStart((event) => {
      if (tool === 'text') return;

      if (tool === 'circle' || tool === 'rect' || tool === 'arrow') {
        // Start a shape
        currentShape.current = {
          type: tool,
          start: { x: event.x, y: event.y },
          end: { x: event.x, y: event.y },
          color,
          strokeWidth,
        };
      } else {
        // Start a path (pen, highlighter, eraser)
        const path = Skia.Path.Make();
        path.moveTo(event.x, event.y);
        currentPath.current = path;
      }
    })
    .onUpdate((event) => {
      if (tool === 'text') return;

      if (tool === 'circle' || tool === 'rect' || tool === 'arrow') {
        // Update shape end point
        if (currentShape.current) {
          currentShape.current.end = { x: event.x, y: event.y };
          // Trigger re-render by updating shapes
          setShapes([...shapes, currentShape.current]);
        }
      } else {
        // Update path
        if (currentPath.current) {
          currentPath.current.lineTo(event.x, event.y);
          // Trigger re-render by updating paths
          setPaths((prev) => [
            ...prev.slice(0, -1),
            {
              path: currentPath.current!,
              color: tool === 'eraser' ? 'white' : color,
              strokeWidth: tool === 'eraser' ? strokeWidth * 2 : strokeWidth,
              tool,
              opacity: tool === 'highlighter' ? 0.4 : opacity,
            },
          ]);
        }
      }
    })
    .onEnd(() => {
      if (tool === 'text') return;

      if (tool === 'circle' || tool === 'rect' || tool === 'arrow') {
        // Finalize shape
        if (currentShape.current) {
          setShapes((prev) => [...prev, currentShape.current!]);
          currentShape.current = null;
          notifyChange();
        }
      } else {
        // Finalize path
        if (currentPath.current) {
          setPaths((prev) => [
            ...prev,
            {
              path: currentPath.current!,
              color: tool === 'eraser' ? 'white' : color,
              strokeWidth: tool === 'eraser' ? strokeWidth * 2 : strokeWidth,
              tool,
              opacity: tool === 'highlighter' ? 0.4 : opacity,
            },
          ]);
          currentPath.current = null;
          notifyChange();
        }
      }
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((event) => {
      if (tool === 'text') {
        // TODO: Show text input modal at this position
        // For now, add placeholder text
        setTexts((prev) => [
          ...prev,
          {
            text: 'Text',
            x: event.x,
            y: event.y,
            color,
            fontSize: strokeWidth * 3,
          },
        ]);
        notifyChange();
      }
    });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  return (
    <View style={[styles.container, { width, height }]}>
      <GestureDetector gesture={composed}>
        <Canvas style={{ width, height }}>
          <Group>
            {/* Draw all completed paths */}
            {paths.map((item, index) => (
              <Path
                key={`path-${index}`}
                path={item.path}
                color={item.color}
                style="stroke"
                strokeWidth={item.strokeWidth}
                strokeCap="round"
                strokeJoin="round"
                opacity={item.opacity ?? 1}
              />
            ))}

            {/* Draw all completed shapes */}
            {shapes.map((shape, index) => {
              if (shape.type === 'circle') {
                const radius = Math.sqrt(
                  Math.pow(shape.end.x - shape.start.x, 2) +
                    Math.pow(shape.end.y - shape.start.y, 2)
                );
                return (
                  <Circle
                    key={`shape-${index}`}
                    cx={shape.start.x}
                    cy={shape.start.y}
                    r={radius}
                    color={shape.color}
                    style="stroke"
                    strokeWidth={shape.strokeWidth}
                  />
                );
              } else if (shape.type === 'rect') {
                const x = Math.min(shape.start.x, shape.end.x);
                const y = Math.min(shape.start.y, shape.end.y);
                const w = Math.abs(shape.end.x - shape.start.x);
                const h = Math.abs(shape.end.y - shape.start.y);
                return (
                  <Rect
                    key={`shape-${index}`}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    color={shape.color}
                    style="stroke"
                    strokeWidth={shape.strokeWidth}
                  />
                );
              } else if (shape.type === 'arrow') {
                // Draw arrow as line + triangle head
                const angle = Math.atan2(
                  shape.end.y - shape.start.y,
                  shape.end.x - shape.start.x
                );
                const headLength = 20;
                const headAngle = Math.PI / 6; // 30 degrees

                return (
                  <Group key={`shape-${index}`}>
                    {/* Main line */}
                    <Line
                      p1={vec(shape.start.x, shape.start.y)}
                      p2={vec(shape.end.x, shape.end.y)}
                      color={shape.color}
                      strokeWidth={shape.strokeWidth}
                    />
                    {/* Arrow head */}
                    <Path
                      path={Skia.Path.Make()
                        .moveTo(shape.end.x, shape.end.y)
                        .lineTo(
                          shape.end.x - headLength * Math.cos(angle - headAngle),
                          shape.end.y - headLength * Math.sin(angle - headAngle)
                        )
                        .moveTo(shape.end.x, shape.end.y)
                        .lineTo(
                          shape.end.x - headLength * Math.cos(angle + headAngle),
                          shape.end.y - headLength * Math.sin(angle + headAngle)
                        )}
                      color={shape.color}
                      style="stroke"
                      strokeWidth={shape.strokeWidth}
                      strokeCap="round"
                    />
                  </Group>
                );
              }
              return null;
            })}

            {/* Draw all texts */}
            {texts.map((item, index) => (
              <SkiaText
                key={`text-${index}`}
                x={item.x}
                y={item.y}
                text={item.text}
                color={item.color}
                font={null as any} // TODO: Load font
              />
            ))}
          </Group>
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
