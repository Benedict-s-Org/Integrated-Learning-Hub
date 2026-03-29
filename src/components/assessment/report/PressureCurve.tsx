// ============================================================
// PressureCurve — Pressure-over-Time Visualisation
// ============================================================
// Renders the pressure data as a time-series curve, showing
// how pen pressure changed during the writing task.
// Highlights zones (light/moderate/excessive) and fatigue.
// ============================================================

import React, { useRef, useEffect } from 'react';
import { PressureSample, PressureZone } from '../shared/types';
import { PRESSURE_THRESHOLDS, PRESSURE_ZONE_COLOURS } from '../shared/constants';

interface PressureCurveProps {
  /** Raw pressure samples to plot */
  samples: PressureSample[];
  /** Width of the chart in pixels */
  width?: number;
  /** Height of the chart in pixels */
  height?: number;
  /** Whether to show zone background bands */
  showZones?: boolean;
  /** Fatigue index to display */
  fatigueIndex?: number;
}

/**
 * Pressure curve chart for the assessment report.
 *
 * TODO Phase 5:
 * - Plot pressure (y-axis, 0–1) over time (x-axis, ms)
 * - Draw coloured background bands for each pressure zone
 * - Render the pressure curve as a smooth line
 * - Color-code the curve segments by zone
 * - Show a dashed line at the fatigue threshold point (1/3 mark)
 * - Add axis labels and legend
 * - Optional: hover tooltip showing exact pressure at time point
 */
export const PressureCurve: React.FC<PressureCurveProps> = ({
  samples,
  width = 600,
  height = 200,
  showZones: _showZones = true,
  fatigueIndex: _fatigueIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // TODO: Draw full pressure curve
    drawPlaceholder(ctx, width, height, samples.length);
  }, [samples, width, height]);

  return (
    <div className="pressure-curve">
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="rounded-xl border border-slate-200"
      />
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ backgroundColor: PRESSURE_ZONE_COLOURS[PressureZone.LIGHT] }}
          />
          Light (&lt;{PRESSURE_THRESHOLDS.LIGHT_MAX})
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ backgroundColor: PRESSURE_ZONE_COLOURS[PressureZone.MODERATE] }}
          />
          Moderate
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-3 h-3 rounded-full inline-block"
            style={{ backgroundColor: PRESSURE_ZONE_COLOURS[PressureZone.EXCESSIVE] }}
          />
          Excessive (&gt;{PRESSURE_THRESHOLDS.MODERATE_MAX})
        </span>
      </div>
    </div>
  );
};

/**
 * Draw a placeholder chart.
 * TODO Phase 5: Replace with actual pressure curve rendering.
 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sampleCount: number
): void {
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Zone bands
  const lightY = height * (1 - PRESSURE_THRESHOLDS.LIGHT_MAX);
  const modY = height * (1 - PRESSURE_THRESHOLDS.MODERATE_MAX);

  ctx.fillStyle = PRESSURE_ZONE_COLOURS[PressureZone.EXCESSIVE] + '10';
  ctx.fillRect(0, 0, width, modY);

  ctx.fillStyle = PRESSURE_ZONE_COLOURS[PressureZone.MODERATE] + '10';
  ctx.fillRect(0, modY, width, lightY - modY);

  ctx.fillStyle = PRESSURE_ZONE_COLOURS[PressureZone.LIGHT] + '10';
  ctx.fillRect(0, lightY, width, height - lightY);

  // Center text
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    sampleCount > 0 ? `${sampleCount} samples to plot` : 'Pressure Curve (Phase 5)',
    width / 2,
    height / 2
  );
}
