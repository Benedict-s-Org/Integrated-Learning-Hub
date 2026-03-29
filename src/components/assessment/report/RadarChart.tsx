// ============================================================
// RadarChart — Assessment Radar/Spider Chart Component
// ============================================================
// Visualises the five handwriting dimensions on a radar chart:
// Letter Clarity, Size Consistency, Line Adherence,
// Letter Formation, Spacing.
// ============================================================

import React, { useRef, useEffect } from 'react';

interface RadarChartProps {
  /** Scores for each dimension (1–5) */
  scores: {
    letterClarity: number;
    sizeConsistency: number;
    lineAdherence: number;
    letterFormation: number;
    spacing: number;
  };
  /** Chart diameter in pixels */
  size?: number;
  /** Whether to animate the chart on first render */
  animate?: boolean;
}

/** Labels for each axis of the radar chart */
const AXIS_LABELS = [
  'Letter Clarity',
  'Size Consistency',
  'Line Adherence',
  'Letter Formation',
  'Spacing',
];

/**
 * Radar chart displaying handwriting assessment scores.
 *
 * TODO Phase 5:
 * - Draw pentagonal grid lines (1–5 levels)
 * - Draw axis lines from center to each vertex
 * - Plot student scores as a filled polygon
 * - Add axis labels around the outside
 * - Optional animation: grow from center on mount
 * - Colour-code: green (4-5), amber (3), red (1-2)
 * - Support comparison overlay (e.g., benchmark vs student)
 */
export const RadarChart: React.FC<RadarChartProps> = ({
  scores: _scores,
  size = 300,
  animate: _animate = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // TODO: Draw radar chart
    drawPlaceholder(ctx, size);
  }, [_scores, size]);

  return (
    <div className="radar-chart flex flex-col items-center">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="rounded-xl"
      />
      {/* Fallback: text-based scores */}
      <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs text-slate-500">
        {AXIS_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
};

/**
 * Draw a placeholder radar shape.
 * TODO Phase 5: Replace with actual radar chart rendering.
 */
function drawPlaceholder(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.35;

  ctx.clearRect(0, 0, size, size);

  // Background grid circles
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (radius / 5) * i, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Center text
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Radar Chart', cx, cy - 10);
  ctx.fillText('(Phase 5)', cx, cy + 10);
}
