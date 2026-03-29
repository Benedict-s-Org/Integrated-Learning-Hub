// ============================================================
// FourLineGrid — Four-Line Writing Grid Overlay
// ============================================================
// Pure visual canvas overlay (pointer-events: none) layered
// BELOW the drawing canvas. Renders the HK primary school
// copybook grid (香港抄寫簿格式) with a red left margin line
// and optional faded prompt text on the first baseline.
// ============================================================

import React, { useRef, useEffect } from 'react';

// ─── Props ───────────────────────────────────────────────────

interface FourLineGridProps {
  /** Canvas width in CSS pixels */
  width: number;
  /** Canvas height in CSS pixels */
  height: number;
  /** Faded template text shown along the first baseline */
  promptText: string;
  /**
   * Total height of one line group (top → descender) in CSS pixels.
   * ~15mm on a typical iPad screen ≈ 60px.
   * Default: 60
   */
  lineGroupHeight?: number;
}

// ─── Constants ────────────────────────────────────────────────

const MARGIN_X = 60;              // red margin line position (px)
const MARGIN_COLOUR = '#ef4444';  // red-500
const MARGIN_OPACITY = 0.45;      // semi-transparent

const TOP_SOLID_COLOUR   = '#94a3b8'; // slate-400
const MIDLINE_COLOUR     = '#cbd5e1'; // slate-300 (dashed)
const BASELINE_COLOUR    = '#94a3b8'; // slate-400 (slightly thicker)
const DESCENDER_COLOUR   = '#e2e8f0'; // slate-200 (light dotted)

const PROMPT_COLOUR = 'rgba(148, 163, 184, 0.30)'; // slate-400 at 30%

// ─── Component ───────────────────────────────────────────────

export const FourLineGrid: React.FC<FourLineGridProps> = ({
  width,
  height,
  promptText,
  lineGroupHeight = 60,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;

    // Set physical pixel dimensions
    canvas.width  = Math.round(width  * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale all draw calls so we always work in CSS px
    ctx.scale(dpr, dpr);

    drawGrid(ctx, width, height, lineGroupHeight, promptText);
  }, [width, height, lineGroupHeight, promptText]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        width,
        height,
        zIndex: 0,
      }}
    />
  );
};

// ─── Drawing Logic ────────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  groupH: number,
  promptText: string,
): void {
  ctx.clearRect(0, 0, cssW, cssH);

  // ── Line ratios within one group ──────────────────────────
  // Visual proportions (matching standard HK school copybooks):
  //   top-line   →  0%
  //   midline    → 40%  (upper writing zone is 40% of group)
  //   baseline   → 70%  (lower writing zone is 30% of group)
  //   descender  → 95%  (descender zone is 25% of group)
  const MID_FRAC  = 0.40;
  const BASE_FRAC = 0.70;
  const DESC_FRAC = 0.95;

  // Top padding so the first top-line doesn't sit at y=0
  const topPad = groupH * 0.25;
  const numGroups = Math.floor((cssH - topPad) / groupH);

  for (let i = 0; i < numGroups; i++) {
    const groupTop = topPad + i * groupH;

    const yTop  = groupTop;
    const yMid  = groupTop + groupH * MID_FRAC;
    const yBase = groupTop + groupH * BASE_FRAC;
    const yDesc = groupTop + groupH * DESC_FRAC;

    // 1. Top / ascender line — solid
    hLine(ctx, MARGIN_X, cssW, yTop,  TOP_SOLID_COLOUR, 0.75, []);

    // 2. Midline — dashed
    hLine(ctx, MARGIN_X, cssW, yMid,  MIDLINE_COLOUR,   0.75, [8, 5]);

    // 3. Baseline — solid, slightly thicker (most important reference)
    hLine(ctx, MARGIN_X, cssW, yBase, BASELINE_COLOUR,  1.1,  []);

    // 4. Descender line — dotted / lightest
    hLine(ctx, MARGIN_X, cssW, yDesc, DESCENDER_COLOUR, 0.6,  [2, 6]);

    // 5. Prompt text on the FIRST group only
    if (i === 0 && promptText) {
      const fontSize = Math.round(groupH * BASE_FRAC * 0.72);
      ctx.save();
      ctx.font          = `${fontSize}px "Times New Roman", Georgia, serif`;
      ctx.fillStyle     = PROMPT_COLOUR;
      ctx.textBaseline  = 'alphabetic';
      ctx.textAlign     = 'left';
      ctx.fillText(promptText, MARGIN_X + 10, yBase - 2);
      ctx.restore();
    }
  }

  // ── Red left margin line ──────────────────────────────────
  ctx.save();
  ctx.globalAlpha = MARGIN_OPACITY;
  ctx.strokeStyle = MARGIN_COLOUR;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, 0);
  ctx.lineTo(MARGIN_X, cssH);
  ctx.stroke();
  ctx.restore();
}

/** Draws a single horizontal line across the canvas */
function hLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  colour: string,
  lineWidth: number,
  lineDash: number[],
): void {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth   = lineWidth;
  ctx.setLineDash(lineDash);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}
