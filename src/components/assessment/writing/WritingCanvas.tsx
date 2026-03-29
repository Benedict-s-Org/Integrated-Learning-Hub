import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { PressureSample } from '../shared/types';

// ─── Props ───────────────────────────────────────────────────

interface WritingCanvasProps {
  /** Reference to the FourLineGrid canvas sit below */
  gridCanvasRef: React.RefObject<HTMLCanvasElement>;
  /** Writing prompt placeholder - hidden after first stroke */
  promptText: string;
  /** Width in CSS px */
  width: number;
  /** Height in CSS px */
  height: number;
  /** Real-time callback for pressure analysis */
  onPressureData?: (samples: PressureSample[]) => void;
}

/** Interface for the imperative handle exposed by WritingCanvas */
export interface WritingCanvasRef {
  clear: () => void;
  undo: () => void;
  getSnapshotData: () => Promise<{
    samples: PressureSample[];
    compositeUrl: string;
    rawUrl: string;
  }>;
}

// ─── Constants ────────────────────────────────────────────────

const MIN_LINE_WIDTH = 1.0;
const MAX_LINE_WIDTH = 8.0;
const STROKE_COLOUR = '#1e293b'; // slate-800
const DRAWING_CURSOR = 'crosshair';

const PRESSURE_THRESHOLD_LIGHT = 0.25;
const PRESSURE_THRESHOLD_EXCESSIVE = 0.60;

const SNAPSHOT_INTERVAL = 5; // snapshot every 5 strokes

// ─── Types ───────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

interface Stroke {
  points: Point[];
}

// ─── Component ───────────────────────────────────────────────

export const WritingCanvas = forwardRef<WritingCanvasRef, WritingCanvasProps>(({
  gridCanvasRef,
  promptText,
  width,
  height,
  onPressureData
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // ── State ─────────────────────────────────────────────────
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPressure, setCurrentPressure] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [snapshots, setSnapshots] = useState<ImageData[]>([]);
  const [allSamples, setAllSamples] = useState<PressureSample[]>([]);

  // ── Refs for ephemeral state ──────────────────────────────
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const currentStrokeRef = useRef<Point[]>([]);
  const pressureBufferRef = useRef<number[]>([]); // for moving average

  // ── Init Canvas ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = STROKE_COLOUR;
    ctxRef.current = ctx;
  }, [width, height]);

  // ── Imperative Handle ────────────────────────────────────
  
  useImperativeHandle(ref, () => ({
    clear: () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      setStrokes([]);
      setSnapshots([]);
      setAllSamples([]);
      setHasStarted(false);
      setCurrentPressure(0);
    },
    undo: () => {
      const ctx = ctxRef.current;
      if (!ctx || strokes.length === 0) return;

      const nextStrokes = strokes.slice(0, -1);
      ctx.clearRect(0, 0, width, height);

      const snapshotIdx = Math.floor(nextStrokes.length / SNAPSHOT_INTERVAL) - 1;
      if (snapshotIdx >= 0 && snapshots[snapshotIdx]) {
        ctx.putImageData(snapshots[snapshotIdx], 0, 0);
        const remainingStrokes = nextStrokes.slice((snapshotIdx + 1) * SNAPSHOT_INTERVAL);
        remainingStrokes.forEach(s => drawQuadraticStroke(s.points));
      } else {
        nextStrokes.forEach(s => drawQuadraticStroke(s.points));
      }

      setStrokes(nextStrokes);
      if (strokes.length % SNAPSHOT_INTERVAL === 0) {
        setSnapshots(prev => prev.slice(0, -1));
      }
    },
    getSnapshotData: async () => {
      if (!canvasRef.current || !gridCanvasRef?.current) {
        throw new Error('Canvas not initialized');
      }

      const dpr = window.devicePixelRatio || 1;
      const offscreen = document.createElement('canvas');
      offscreen.width = width * dpr;
      offscreen.height = height * dpr;
      const oCtx = offscreen.getContext('2d');
      if (!oCtx) throw new Error('Failed to create offscreen context');

      oCtx.drawImage(gridCanvasRef.current, 0, 0);
      oCtx.drawImage(canvasRef.current, 0, 0);
      const compositeUrl = offscreen.toDataURL('image/png');
      const rawUrl = canvasRef.current.toDataURL('image/png');

      const downsampled: PressureSample[] = [];
      let lastTime = 0;
      for (const s of allSamples) {
        if (s.time - lastTime >= 10) {
          downsampled.push(s);
          lastTime = s.time;
        }
      }

      return {
        samples: downsampled,
        compositeUrl,
        rawUrl
      };
    }
  }));

  // ── Drawing Utilities ─────────────────────────────────────
  
  const getPressureLabel = (p: number) => {
    if (p < PRESSURE_THRESHOLD_LIGHT) return '輕微 (Light)';
    if (p > PRESSURE_THRESHOLD_EXCESSIVE) return '過大 (Excessive)';
    return '適中 (Moderate)';
  };

  const drawQuadraticStroke = useCallback((points: Point[]) => {
    const ctx = ctxRef.current;
    if (!ctx || points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i + 1].x) / 2;
        const midY = (points[i].y + points[i + 1].y) / 2;
        const p = points[i].pressure;
        ctx.lineWidth = MIN_LINE_WIDTH + (MAX_LINE_WIDTH - MIN_LINE_WIDTH) * p;
        ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(midX, midY);
    }
  }, []);

  // ── Pointer Handlers ──────────────────────────────────────
  
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    setIsDrawing(true);
    setHasStarted(true);

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;

    currentStrokeRef.current = [{ x, y, pressure, timestamp: Date.now() }];
    pressureBufferRef.current = [pressure];
    setCurrentPressure(pressure);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const events = e.nativeEvent.getCoalescedEvents?.() || [e.nativeEvent];
    const ctx = ctxRef.current;
    if (!ctx) return;

    for (const event of events) {
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rawPressure = e.pointerType === 'pen' ? event.pressure : 0.5;

      pressureBufferRef.current.push(rawPressure);
      if (pressureBufferRef.current.length > 3) pressureBufferRef.current.shift();
      const avgPressure = pressureBufferRef.current.reduce((a, b) => a + b) / pressureBufferRef.current.length;

      const prevPoint = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      const newPoint: Point = { x, y, pressure: avgPressure, timestamp: Date.now() };

      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineWidth = MIN_LINE_WIDTH + (MAX_LINE_WIDTH - MIN_LINE_WIDTH) * avgPressure;
      ctx.lineTo(x, y);
      ctx.stroke();

      currentStrokeRef.current.push(newPoint);
      setCurrentPressure(avgPressure);
      
      const newSample = { 
        time: newPoint.timestamp, 
        pressure: avgPressure,
        x: newPoint.x,
        y: newPoint.y
      };
      
      setAllSamples(prev => {
        const next = [...prev, newSample];
        if (onPressureData) onPressureData(next);
        return next;
      });
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentPressure(0);

    const newStroke = { points: [...currentStrokeRef.current] };
    const newStrokes = [...strokes, newStroke];
    setStrokes(newStrokes);

    if (newStrokes.length % SNAPSHOT_INTERVAL === 0 && ctxRef.current) {
      const dpr = window.devicePixelRatio || 1;
      const snapshot = ctxRef.current.getImageData(0, 0, width * dpr, height * dpr);
      setSnapshots(prev => [...prev, snapshot]);
    }

    currentStrokeRef.current = [];
    pressureBufferRef.current = [];
  };

  // ── Render Helpers ─────────────────────────────────────────

  const pressurePercent = Math.min(100, currentPressure * 100);
  const pressureColor = currentPressure < PRESSURE_THRESHOLD_LIGHT 
    ? '#22c55e' 
    : currentPressure > PRESSURE_THRESHOLD_EXCESSIVE 
    ? '#ef4444' 
    : '#f59e0b';

  return (
    <div className="relative flex flex-col items-center bg-transparent" style={{ width, height: height + 80 }}>
      {/* Hand tracker layer */}
      <div className="relative" style={{ width, height }}>
        {/* Prompt Text (HK copybook faded style) */}
        {!hasStarted && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-30">
              <span className="text-4xl font-semibold text-slate-400 font-mono tracking-widest">{promptText}</span>
           </div>
        )}

        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative z-10 touch-none block"
          style={{ width, height, cursor: DRAWING_CURSOR }}
        />
      </div>

      {/* Real-time Pressure Monitoring (Bilingual HK-style) */}
      <div className="w-full h-20 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 mt-4 flex flex-col justify-center px-6 gap-2 shadow-sm">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse bg-blue-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Pressure / 筆壓</span>
            </div>
          <span className="text-sm font-black tracking-tight" style={{ color: pressureColor }}>
            {getPressureLabel(currentPressure)}
          </span>
        </div>
        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div 
            className="absolute h-full bg-green-500/10 border-x border-green-500/20"
            style={{ 
              left: `${PRESSURE_THRESHOLD_LIGHT * 100}%`, 
              width: `${(PRESSURE_THRESHOLD_EXCESSIVE - PRESSURE_THRESHOLD_LIGHT) * 100}%` 
            }}
          />
          <div 
            className="h-full transition-all duration-75 ease-out"
            style={{ 
              width: `${pressurePercent}%`, 
              backgroundColor: pressureColor,
              boxShadow: `0 0 12px ${pressureColor}40`
            }}
          />
        </div>
      </div>
    </div>
  );
});

WritingCanvas.displayName = 'WritingCanvas';
