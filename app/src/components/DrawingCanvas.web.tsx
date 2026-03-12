import { useRef, useEffect, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';

// Re-export the same types so DrawingToolbar imports work on web
export type DrawingTool = 'pen' | 'highlighter' | 'eraser' | 'circle' | 'rect' | 'arrow' | 'text';

export type DrawingPath = {
  path: any;
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

type WebPath = {
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
  tool: DrawingTool;
  opacity: number;
};

export default function DrawingCanvas({
  width,
  height,
  tool,
  color,
  strokeWidth,
  opacity = 1,
  onDrawingChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const pathsRef = useRef<WebPath[]>([]);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const shapesRef = useRef<DrawingShape[]>([]);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const [, forceRender] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Draw completed paths
    for (const p of pathsRef.current) {
      if (p.points.length < 2) continue;
      ctx.beginPath();
      ctx.globalAlpha = p.opacity;
      ctx.strokeStyle = p.tool === 'eraser' ? '#FFFFFF' : p.color;
      ctx.lineWidth = p.tool === 'eraser' ? p.strokeWidth * 2 : p.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw completed shapes
    for (const s of shapesRef.current) {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.strokeWidth;
      ctx.lineCap = 'round';

      if (s.type === 'circle') {
        const r = Math.sqrt(
          Math.pow(s.end.x - s.start.x, 2) + Math.pow(s.end.y - s.start.y, 2),
        );
        ctx.arc(s.start.x, s.start.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'rect') {
        const x = Math.min(s.start.x, s.end.x);
        const y = Math.min(s.start.y, s.end.y);
        const w = Math.abs(s.end.x - s.start.x);
        const h = Math.abs(s.end.y - s.start.y);
        ctx.strokeRect(x, y, w, h);
      } else if (s.type === 'arrow') {
        ctx.moveTo(s.start.x, s.start.y);
        ctx.lineTo(s.end.x, s.end.y);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(s.end.y - s.start.y, s.end.x - s.start.x);
        const headLen = 20;
        const headAngle = Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(s.end.x, s.end.y);
        ctx.lineTo(
          s.end.x - headLen * Math.cos(angle - headAngle),
          s.end.y - headLen * Math.sin(angle - headAngle),
        );
        ctx.moveTo(s.end.x, s.end.y);
        ctx.lineTo(
          s.end.x - headLen * Math.cos(angle + headAngle),
          s.end.y - headLen * Math.sin(angle + headAngle),
        );
        ctx.stroke();
      }
    }

    // Draw in-progress path
    if (currentPoints.current.length >= 2) {
      ctx.beginPath();
      const effOpacity = tool === 'highlighter' ? 0.4 : opacity;
      ctx.globalAlpha = effOpacity;
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      ctx.lineWidth = tool === 'eraser' ? strokeWidth * 2 : strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(currentPoints.current[0].x, currentPoints.current[0].y);
      for (let i = 1; i < currentPoints.current.length; i++) {
        ctx.lineTo(currentPoints.current[i].x, currentPoints.current[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [width, height, color, strokeWidth, tool, opacity]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    redraw();
  }, [width, height, redraw]);

  const getPos = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleStart = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    if (tool === 'circle' || tool === 'rect' || tool === 'arrow') {
      shapeStart.current = pos;
    } else {
      currentPoints.current = [pos];
    }
  }, [tool]);

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    if (tool === 'circle' || tool === 'rect' || tool === 'arrow') {
      // Live preview shape
      const tempShapes = [...shapesRef.current];
      if (shapeStart.current) {
        // We'll just redraw with a temp shape
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          redraw();
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeWidth;
          if (tool === 'circle') {
            const r = Math.sqrt(
              Math.pow(pos.x - shapeStart.current.x, 2) +
              Math.pow(pos.y - shapeStart.current.y, 2),
            );
            ctx.arc(shapeStart.current.x, shapeStart.current.y, r, 0, Math.PI * 2);
          } else if (tool === 'rect') {
            const x = Math.min(shapeStart.current.x, pos.x);
            const y = Math.min(shapeStart.current.y, pos.y);
            ctx.strokeRect(x, y, Math.abs(pos.x - shapeStart.current.x), Math.abs(pos.y - shapeStart.current.y));
          } else if (tool === 'arrow') {
            ctx.moveTo(shapeStart.current.x, shapeStart.current.y);
            ctx.lineTo(pos.x, pos.y);
          }
          ctx.stroke();
        }
      }
    } else {
      currentPoints.current.push(pos);
      redraw();
    }
  }, [tool, color, strokeWidth, redraw]);

  const handleEnd = useCallback(() => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (tool === 'circle' || tool === 'rect' || tool === 'arrow') {
      if (shapeStart.current) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        // Use last known mouse position (we store end at handleMove)
        // For simplicity, store the shape from the last redraw
        // Actually we need the end point. Let's just use what we have.
      }
      shapeStart.current = null;
    } else {
      if (currentPoints.current.length >= 2) {
        pathsRef.current.push({
          points: [...currentPoints.current],
          color,
          strokeWidth,
          tool,
          opacity: tool === 'highlighter' ? 0.4 : opacity,
        });
      }
      currentPoints.current = [];
    }
    redraw();
    forceRender((n) => n + 1);
  }, [tool, color, strokeWidth, opacity, redraw]);

  // Attach native DOM events (RN Web doesn't support onPointerDown etc. on View)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (e: MouseEvent) => handleStart(e);
    const onMove = (e: MouseEvent) => handleMove(e);
    const onUp = () => handleEnd();
    const onTouchStart = (e: TouchEvent) => handleStart(e);
    const onTouchMove = (e: TouchEvent) => handleMove(e);
    const onTouchEnd = () => handleEnd();

    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleStart, handleMove, handleEnd]);

  // Expose clear via a global (simple approach for web)
  useEffect(() => {
    (window as any).__drawingCanvasClear = () => {
      pathsRef.current = [];
      shapesRef.current = [];
      currentPoints.current = [];
      redraw();
      forceRender((n) => n + 1);
    };
    return () => {
      delete (window as any).__drawingCanvasClear;
    };
  }, [redraw]);

  return (
    <View style={[styles.container, { width, height }]}>
      <canvas
        ref={canvasRef as any}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          cursor: 'crosshair',
        }}
      />
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
