import React, { useEffect, useCallback, useMemo } from "react";

export type GridMode = "floor" | "full" | "pixel";

interface IsometricGridOverlayProps {
  showGrid: boolean;
  gridMode: GridMode;
  onToggleGrid?: () => void;
  tileWidth?: number;
  tileHeight?: number;
  gridSize?: number;
  wallHeight?: number;
  offset?: { x: number; y: number };
}

const IsometricGridOverlay: React.FC<IsometricGridOverlayProps> = ({
  showGrid,
  gridMode,
  onToggleGrid,
  tileWidth = 60,
  tileHeight = 30,
  gridSize = 10,
  wallHeight = 180,
  offset = { x: 0, y: 0 },
}) => {
  // Keyboard shortcut 'G' to toggle grid
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "g" || e.key === "G") {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        onToggleGrid?.();
      }
    },
    [onToggleGrid],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Convert grid coordinates to isometric screen coordinates (centered like IsometricRoom)
  const toIso = useCallback(
    (x: number, y: number) => {
      const cx = x - gridSize / 2;
      const cy = y - gridSize / 2;
      return {
        x: (cx - cy) * (tileWidth / 2),
        y: (cx + cy) * (tileHeight / 2),
      };
    },
    [tileWidth, tileHeight, gridSize],
  );

  // Fixed viewBox to match IsometricRoom exactly
  const FIXED_VIEWBOX = "-400 -300 800 600";

  // Calculate grid lines
  const gridData = useMemo(() => {
    // Generate floor grid lines
    const floorLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    // Lines going from top-left to bottom-right (along Y axis)
    for (let x = 0; x <= gridSize; x++) {
      const start = toIso(x, 0);
      const end = toIso(x, gridSize);
      floorLines.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }

    // Lines going from top-right to bottom-left (along X axis)
    for (let y = 0; y <= gridSize; y++) {
      const start = toIso(0, y);
      const end = toIso(gridSize, y);
      floorLines.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    }

    // Generate wall grid lines (vertical lines on left and right walls)
    const leftWallLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const rightWallLines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    // Left wall vertical lines (along the left edge, y = 0)
    for (let x = 0; x <= gridSize; x++) {
      const base = toIso(x, 0);
      leftWallLines.push({
        x1: base.x,
        y1: base.y,
        x2: base.x,
        y2: base.y - wallHeight,
      });
    }

    // Right wall vertical lines (along the back edge, x = 0)
    for (let y = 0; y <= gridSize; y++) {
      const base = toIso(0, y);
      rightWallLines.push({
        x1: base.x,
        y1: base.y,
        x2: base.x,
        y2: base.y - wallHeight,
      });
    }

    // Wall horizontal lines (parallel to floor at different heights)
    const wallHorizontalCount = Math.floor(wallHeight / tileHeight);
    const leftWallHorizontals: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const rightWallHorizontals: { x1: number; y1: number; x2: number; y2: number }[] = [];

    for (let h = 1; h <= wallHorizontalCount; h++) {
      const heightOffset = h * tileHeight;

      // Left wall horizontal (follows left edge)
      const leftStart = toIso(0, 0);
      const leftEnd = toIso(gridSize, 0);
      leftWallHorizontals.push({
        x1: leftStart.x,
        y1: leftStart.y - heightOffset,
        x2: leftEnd.x,
        y2: leftEnd.y - heightOffset,
      });

      // Right wall horizontal (follows back edge)
      const rightStart = toIso(0, 0);
      const rightEnd = toIso(0, gridSize);
      rightWallHorizontals.push({
        x1: rightStart.x,
        y1: rightStart.y - heightOffset,
        x2: rightEnd.x,
        y2: rightEnd.y - heightOffset,
      });
    }

    return {
      floorLines,
      leftWallLines,
      rightWallLines,
      leftWallHorizontals,
      rightWallHorizontals,
    };
  }, [toIso, gridSize, wallHeight, tileHeight]);

  if (!showGrid) return null;

  const floorLineColor = "rgba(139, 69, 19, 0.5)";
  const wallLineColor = "rgba(101, 67, 33, 0.4)";

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={FIXED_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 10,
      }}
    >
      <g transform={`translate(${offset.x}, ${offset.y})`}>
        {/* Floor grid lines */}
        {gridData.floorLines.map((line, i) => (
          <line
            key={`floor-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={floorLineColor}
            strokeWidth={1}
          />
        ))}

        {/* Wall grid lines (only in full mode) */}
        {gridMode === "full" && (
          <>
            {/* Left wall vertical lines */}
            {gridData.leftWallLines.map((line, i) => (
              <line
                key={`left-wall-v-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={wallLineColor}
                strokeWidth={1}
              />
            ))}

            {/* Right wall vertical lines */}
            {gridData.rightWallLines.map((line, i) => (
              <line
                key={`right-wall-v-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={wallLineColor}
                strokeWidth={1}
              />
            ))}

            {/* Left wall horizontal lines */}
            {gridData.leftWallHorizontals.map((line, i) => (
              <line
                key={`left-wall-h-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={wallLineColor}
                strokeWidth={1}
              />
            ))}

            {/* Right wall horizontal lines */}
            {gridData.rightWallHorizontals.map((line, i) => (
              <line
                key={`right-wall-h-${i}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={wallLineColor}
                strokeWidth={1}
              />
            ))}
          </>
        )}
      </g>
    </svg>
  );
};

export default IsometricGridOverlay;
