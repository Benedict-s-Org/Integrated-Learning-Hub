import React from "react";
import { GridMode } from "@/components/IsometricGridOverlay";
import { IsoPoint } from "@/types/room";

interface GridOverlayProps {
  gridSize: number;
  wallHeight: number;
  tileHeight: number;
  gridMode: GridMode;
  toIso: (x: number, y: number) => IsoPoint;
}

export const GridOverlay: React.FC<GridOverlayProps> = ({
  gridSize,
  wallHeight,
  tileHeight,
  gridMode,
  toIso,
}) => {
  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Floor grid lines */}
      {Array.from({ length: gridSize + 1 }).map((_, i) => {
        const start = toIso(i, 0);
        const end = toIso(i, gridSize);
        return (
          <line
            key={`grid-floor-x-${i}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="rgba(59, 130, 246, 0.6)"
            strokeWidth={1.5}
          />
        );
      })}
      {Array.from({ length: gridSize + 1 }).map((_, i) => {
        const start = toIso(0, i);
        const end = toIso(gridSize, i);
        return (
          <line
            key={`grid-floor-y-${i}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="rgba(59, 130, 246, 0.6)"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Wall grid lines (only in full mode) */}
      {gridMode === "full" && (
        <>
          {/* Left wall vertical lines */}
          {Array.from({ length: gridSize + 1 }).map((_, i) => {
            const base = toIso(i, 0);
            return (
              <line
                key={`grid-left-v-${i}`}
                x1={base.x}
                y1={base.y}
                x2={base.x}
                y2={base.y - wallHeight}
                stroke="rgba(99, 102, 241, 0.5)"
                strokeWidth={1}
              />
            );
          })}
          {/* Right wall vertical lines */}
          {Array.from({ length: gridSize + 1 }).map((_, i) => {
            const base = toIso(0, i);
            return (
              <line
                key={`grid-right-v-${i}`}
                x1={base.x}
                y1={base.y}
                x2={base.x}
                y2={base.y - wallHeight}
                stroke="rgba(99, 102, 241, 0.5)"
                strokeWidth={1}
              />
            );
          })}
          {/* Left wall horizontal lines */}
          {Array.from({ length: Math.floor(wallHeight / tileHeight) }).map((_, h) => {
            const heightOffset = (h + 1) * tileHeight;
            const leftStart = toIso(0, 0);
            const leftEnd = toIso(gridSize, 0);
            return (
              <line
                key={`grid-left-h-${h}`}
                x1={leftStart.x}
                y1={leftStart.y - heightOffset}
                x2={leftEnd.x}
                y2={leftEnd.y - heightOffset}
                stroke="rgba(99, 102, 241, 0.5)"
                strokeWidth={1}
              />
            );
          })}
          {/* Right wall horizontal lines */}
          {Array.from({ length: Math.floor(wallHeight / tileHeight) }).map((_, h) => {
            const heightOffset = (h + 1) * tileHeight;
            const rightStart = toIso(0, 0);
            const rightEnd = toIso(0, gridSize);
            return (
              <line
                key={`grid-right-h-${h}`}
                x1={rightStart.x}
                y1={rightStart.y - heightOffset}
                x2={rightEnd.x}
                y2={rightEnd.y - heightOffset}
                stroke="rgba(99, 102, 241, 0.5)"
                strokeWidth={1}
              />
            );
          })}
        </>
      )}
    </g>
  );
};
