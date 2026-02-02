import React from "react";
import { IsoPoint } from "@/types/room";
import { CustomFloor } from "@/types/room";
import { getFloorPath, getTilePath } from "@/utils/isometricTransforms";

interface FloorRendererProps {
  gridSize: number;
  toIso: (x: number, y: number) => IsoPoint;
  activeFloor?: CustomFloor | null;
  hoveredTile: { x: number; y: number } | null;
  isMemoryMode: boolean;
  hasTileMemoryPoint?: (x: number, y: number) => boolean;
  onTileHover: (x: number, y: number) => void;
  onMemoryClick?: (targetType: string, targetId: string, position: { x: number; y: number }) => void;
}

interface FloorBaseProps {
  gridSize: number;
  toIso: (x: number, y: number) => IsoPoint;
  hasCustomFloor: boolean;
}

// Floor base with gradient or transparent for custom texture
export const FloorBase: React.FC<FloorBaseProps> = ({
  gridSize,
  toIso,
  hasCustomFloor,
}) => {
  const floorPath = getFloorPath(gridSize, toIso, 0.02);

  return (
    <g>
      <defs>
        <linearGradient id="floor-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5E6D3" />
          <stop offset="50%" stopColor="#EBD9C6" />
          <stop offset="100%" stopColor="#E0CCBA" />
        </linearGradient>
      </defs>
      <path d={floorPath} fill={hasCustomFloor ? "transparent" : "url(#floor-gradient)"} />
    </g>
  );
};

// Wooden plank lines (only when no custom floor)
export const FloorPlanks: React.FC<{ gridSize: number; toIso: (x: number, y: number) => IsoPoint }> = ({
  gridSize,
  toIso,
}) => {
  const plankCount = gridSize * 2;
  const planks: React.ReactNode[] = [];

  // Horizontal planks
  for (let i = 1; i < plankCount; i++) {
    const t = i / plankCount;
    const startX = t * gridSize;
    const startY = 0;
    const endX = 0;
    const endY = t * gridSize;

    const start = toIso(startX, startY);
    const end = toIso(endX, endY);

    planks.push(
      <line
        key={`plank-h-${i}`}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#C4A882"
        strokeWidth={1.5}
        opacity={0.6}
      />
    );
  }

  // Vertical planks
  for (let i = 1; i < plankCount; i++) {
    const t = i / plankCount;
    const startX = 0;
    const startY = t * gridSize;
    const endX = t * gridSize;
    const endY = gridSize;

    const start = toIso(startX, startY);
    const end = toIso(endX, endY);

    planks.push(
      <line
        key={`plank-v-${i}`}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#C4A882"
        strokeWidth={1.5}
        opacity={0.6}
      />
    );
  }

  return <g>{planks}</g>;
};

// Custom floor texture with 2x2 tiling
export const CustomFloorTexture: React.FC<{
  gridSize: number;
  toIso: (x: number, y: number) => IsoPoint;
  floorImage: string;
}> = ({ gridSize, toIso, floorImage }) => {
  const tileCount = Math.ceil(gridSize / 2);

  return (
    <>
      <defs>
        {Array.from({ length: tileCount }).map((_, i) =>
          Array.from({ length: tileCount }).map((_, j) => {
            const gridX = i * 2;
            const gridY = j * 2;
            const p0 = toIso(gridX, gridY);
            const p1 = toIso(gridX + 2, gridY);
            const p2 = toIso(gridX + 2, gridY + 2);
            const p3 = toIso(gridX, gridY + 2);
            const diamondPath = `M${p0.x} ${p0.y} L${p1.x} ${p1.y} L${p2.x} ${p2.y} L${p3.x} ${p3.y} Z`;
            return (
              <clipPath key={`clip-${i}-${j}`} id={`tile-clip-${i}-${j}`} clipPathUnits="userSpaceOnUse">
                <path d={diamondPath} />
              </clipPath>
            );
          })
        )}
      </defs>

      {/* Base grid layer */}
      <g style={{ pointerEvents: "none" }}>
        {Array.from({ length: gridSize + 1 }).map((_, i) => {
          const start = toIso(i, 0);
          const end = toIso(i, gridSize);
          return (
            <line
              key={`grid-x-${i}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth={0.5}
            />
          );
        })}
        {Array.from({ length: gridSize + 1 }).map((_, i) => {
          const start = toIso(0, i);
          const end = toIso(gridSize, i);
          return (
            <line
              key={`grid-y-${i}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth={0.5}
            />
          );
        })}
      </g>

      {/* Textured tiles */}
      {Array.from({ length: tileCount }).map((_, i) =>
        Array.from({ length: tileCount }).map((_, j) => {
          const gridX = i * 2;
          const gridY = j * 2;
          const p0 = toIso(gridX, gridY);
          const p1 = toIso(gridX + 2, gridY);
          const p2 = toIso(gridX + 2, gridY + 2);
          const p3 = toIso(gridX, gridY + 2);

          const bleed = 2;
          const minX = Math.min(p0.x, p1.x, p2.x, p3.x) - bleed;
          const maxX = Math.max(p0.x, p1.x, p2.x, p3.x) + bleed;
          const minY = Math.min(p0.y, p1.y, p2.y, p3.y) - bleed;
          const maxY = Math.max(p0.y, p1.y, p2.y, p3.y) + bleed;

          const imgWidth = maxX - minX;
          const imgHeight = maxY - minY;
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          return (
            <g key={`floor-tex-${i}-${j}`} clipPath={`url(#tile-clip-${i}-${j})`}>
              <image
                href={floorImage}
                x={centerX - imgWidth / 2}
                y={centerY - imgHeight / 2}
                width={imgWidth}
                height={imgHeight}
                preserveAspectRatio="xMidYMid slice"
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })
      )}
    </>
  );
};

// Interactive floor tiles
export const FloorTiles: React.FC<FloorRendererProps> = ({
  gridSize,
  toIso,
  hoveredTile,
  isMemoryMode,
  hasTileMemoryPoint,
  onTileHover,
  onMemoryClick,
}) => {
  const tiles: React.ReactNode[] = [];

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      const center = toIso(x + 0.5, y + 0.5);
      const isHovered = hoveredTile?.x === x && hoveredTile?.y === y;
      const hasTileMemory = hasTileMemoryPoint ? hasTileMemoryPoint(x, y) : false;
      const tilePath = getTilePath(x, y, toIso);

      tiles.push(
        <g
          key={`tile-${x}-${y}`}
          onMouseEnter={() => onTileHover(x, y)}
          onClick={(e) => {
            if (isMemoryMode && onMemoryClick) {
              e.stopPropagation();
              onMemoryClick("tile", `tile-${x}-${y}`, { x, y });
            }
          }}
          className={isMemoryMode ? "cursor-pointer" : "cursor-pointer"}
        >
          {/* Transparent but hoverable base */}
          <path d={tilePath} fill="transparent" style={{ pointerEvents: "auto" }} />
          
          {/* Memory point indicator */}
          {hasTileMemory && (
            <g>
              <path
                d={tilePath}
                fill="rgba(139, 92, 246, 0.15)"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                style={{ pointerEvents: "none" }}
              />
              <circle cx={center.x} cy={center.y - 5} r={6} fill="#8b5cf6" stroke="white" strokeWidth={1.5} />
              <text
                x={center.x}
                y={center.y - 2}
                fontSize="8"
                fill="white"
                textAnchor="middle"
                fontWeight="bold"
                style={{ pointerEvents: "none" }}
              >
                M
              </text>
            </g>
          )}
          
          {/* Hover highlight */}
          {isHovered && (
            <path
              d={tilePath}
              fill={isMemoryMode ? "rgba(139, 92, 246, 0.3)" : "rgba(77, 182, 172, 0.2)"}
              stroke={isMemoryMode ? "#8b5cf6" : "#4DB6AC"}
              strokeWidth={2}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      );
    }
  }

  return <>{tiles}</>;
};
