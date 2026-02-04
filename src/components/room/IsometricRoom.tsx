import React, { useState, useRef } from "react";
import { HOUSE_LEVELS } from "@/constants/houseLevels";
import { GridMode } from "@/components/IsometricGridOverlay";
import { MemoryPoint } from "@/hooks/useMemoryPoints";
import { FurnitureItem, Placement, WallPlacement, CustomFurniture, FurnitureColorVariant } from "@/types/furniture";
import { CustomWall, CustomFloor } from "@/types/room";

// Types
interface ActiveWall {
  id: string;
  lightSide?: string;
  darkSide?: string;
  lightImage?: string;
  darkImage?: string;
}

interface ActiveFloor {
  id: string;
  image?: string;
}

interface ActiveWall {
  id: string;
  lightSide?: string;
  darkSide?: string;
  lightImage?: string;
  darkImage?: string;
}

interface ActiveFloor {
  id: string;
  image?: string;
}

interface IsometricRoomProps {
  houseLevel: number;
  placements: Placement[];
  wallPlacements?: WallPlacement[];
  onCommitPlacement: (furnitureId: string, x: number, y: number, rotation: number) => void;
  onCommitWallPlacement?: (furnitureId: string, gridPos: number, z: number, surface: "left-wall" | "right-wall") => void;
  draggingItem: FurnitureItem | null;
  setDraggingRotation: React.Dispatch<React.SetStateAction<number>>;
  draggingRotation: number;
  isRemoveMode: boolean;
  removalSelectedId: string | null;
  onFurnitureClick: (id: string) => void;
  onFurnitureMouseDown: (placement: Placement) => void;
  movingPlacementId: string | null;
  fullCatalog: FurnitureItem[];
  fullModels: Record<string, any[]>;
  activeWall?: ActiveWall | null;
  activeFloor?: ActiveFloor | null;
  tileWidth: number;
  tileHeight: number;
  isMemoryMode?: boolean;
  onMemoryClick?: (type: string, id: string, extra?: any) => void;
  memoryPoints?: MemoryPoint[];
  hasTileMemoryPoint?: (x: number, y: number) => boolean;
  isStudyMode?: boolean;
  onStudyClick?: (placementId: string) => void;
  hasDueCard?: (placementId: string) => boolean;
  onRemoveWallPlacement?: (id: string) => void;
  showGrid?: boolean;
  gridMode?: GridMode;
  onTileClick?: (x: number, y: number) => void;
  avatarUrl?: string | null;
  onVariantChange?: (placementId: string, variantId: string | null) => void;
}

export const IsometricRoom: React.FC<IsometricRoomProps> = ({
  houseLevel,
  placements,
  wallPlacements = [],
  onCommitPlacement,
  onCommitWallPlacement,
  draggingItem,
  setDraggingRotation,
  draggingRotation,
  isRemoveMode,
  removalSelectedId,
  onFurnitureClick,
  onFurnitureMouseDown,
  movingPlacementId,
  fullCatalog,
  fullModels,
  activeWall = null,
  activeFloor = null,
  tileWidth,
  tileHeight,
  isMemoryMode = false,
  onMemoryClick,
  memoryPoints = [],
  hasTileMemoryPoint,
  isStudyMode = false,
  onStudyClick,
  hasDueCard,
  onRemoveWallPlacement,
  showGrid = false,
  gridMode = "floor" as GridMode,
  onTileClick,
  avatarUrl,
  onVariantChange,
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 100 });
  console.log("IsometricRoom: Render with houseLevel", houseLevel);
  const [rotation, setRotation] = useState(0);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [hoveredWallTile, setHoveredWallTile] = useState<{
    gridPos: number;
    z: number;
    surface: "left-wall" | "right-wall";
  } | null>(null);
  const [isPanDragging, setIsPanDragging] = useState(false);
  const [isRotateDragging, setIsRotateDragging] = useState(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Ensure houseLevel is within valid bounds to prevent crashes
  const safeHouseLevel = Math.min(Math.max(0, houseLevel), HOUSE_LEVELS.length - 1);
  const gridSize = HOUSE_LEVELS[safeHouseLevel].size;
  const svgRef = useRef<SVGSVGElement>(null);
  const wallHeight = 180;
  const wallGridCols = gridSize;
  const wallGridRows = 3;
  const wallCellHeight = wallHeight / wallGridRows;
  const baseboardHeight = 15;
  const frameThickness = 8;

  const toIso = (x: number, y: number) => {
    const cx = x - gridSize / 2;
    const cy = y - gridSize / 2;
    const rx = cx * Math.cos(rotation) - cy * Math.sin(rotation);
    const ry = cx * Math.sin(rotation) + cy * Math.cos(rotation);
    return {
      x: (rx - ry) * (tileWidth / 2),
      y: (rx + ry) * (tileHeight / 2),
    };
  };

  const toIsoWall = (gridPos: number, z: number, surface: "left-wall" | "right-wall") => {
    const corners = [
      { x: 0, y: 0 },
      { x: gridSize, y: 0 },
      { x: gridSize, y: gridSize },
      { x: 0, y: gridSize },
    ];
    const screenCorners = corners.map((c) => ({ ...c, pos: toIso(c.x, c.y) }));
    let backCornerIdx = 0;
    let minScreenY = Infinity;
    screenCorners.forEach((c, idx) => {
      if (c.pos.y < minScreenY) {
        minScreenY = c.pos.y;
        backCornerIdx = idx;
      }
    });
    const prevIdx = (backCornerIdx - 1 + 4) % 4;
    const nextIdx = (backCornerIdx + 1) % 4;
    const backCorner = screenCorners[backCornerIdx];
    const prevCorner = screenCorners[prevIdx];
    const nextCorner = screenCorners[nextIdx];

    const t = (gridPos + 0.5) / gridSize;

    if (surface === "left-wall") {
      const x = backCorner.pos.x + (prevCorner.pos.x - backCorner.pos.x) * t;
      const y = backCorner.pos.y + (prevCorner.pos.y - backCorner.pos.y) * t - z;
      return { x, y, skewY: -30 };
    } else {
      const x = backCorner.pos.x + (nextCorner.pos.x - backCorner.pos.x) * t;
      const y = backCorner.pos.y + (nextCorner.pos.y - backCorner.pos.y) * t - z;
      return { x, y, skewY: 30 };
    }
  };

  const fromIso = (screenX: number, screenY: number) => {
    const rx = screenX / (tileWidth / 2) / 2 + screenY / (tileHeight / 2) / 2;
    const ry = screenY / (tileHeight / 2) / 2 - screenX / (tileWidth / 2) / 2;

    const cosR = Math.cos(-rotation);
    const sinR = Math.sin(-rotation);
    const cx = rx * cosR - ry * sinR;
    const cy = rx * sinR + ry * cosR;

    return {
      x: cx + gridSize / 2,
      y: cy + gridSize / 2,
    };
  };

  const drawBoxPrimitive = (
    globalX: number,
    globalY: number,
    p: any,
    furnitureW: number,
    furnitureD: number,
    rot: number,
    colorOverride: string | null,
    opacityOverride: number,
    indexKey: number,
    isGhost: boolean,
  ) => {
    let lx = p.x;
    let ly = p.y;
    let lw = p.w;
    let ld = p.d;

    if (rot === 1) {
      const oldLx = lx;
      lx = furnitureD - ly - ld;
      ly = oldLx;
      const oldLw = lw;
      lw = ld;
      ld = oldLw;
    } else if (rot === 2) {
      lx = furnitureW - lx - lw;
      ly = furnitureD - ly - ld;
    } else if (rot === 3) {
      const oldLx = lx;
      lx = ly;
      ly = furnitureW - oldLx - lw;
      const oldLw = lw;
      lw = ld;
      ld = oldLw;
    }

    const worldX = globalX + lx;
    const worldY = globalY + ly;
    const zScale = 40;
    const h = p.h * zScale;
    const zBase = p.z * zScale;
    const p1 = toIso(worldX, worldY);
    const p2 = toIso(worldX + lw, worldY);
    const p3 = toIso(worldX + lw, worldY + ld);
    const p4 = toIso(worldX, worldY + ld);
    p1.y -= zBase;
    p2.y -= zBase;
    p3.y -= zBase;
    p4.y -= zBase;
    const t1 = { x: p1.x, y: p1.y - h };
    const t2 = { x: p2.x, y: p2.y - h };
    const t3 = { x: p3.x, y: p3.y - h };
    const t4 = { x: p4.x, y: p4.y - h };
    const color = colorOverride || p.color;
    const opacity = opacityOverride || 1;

    return (
      <g key={`part-${indexKey}`} style={{ opacity, pointerEvents: isGhost ? "none" : "auto" }}>
        <path
          d={`M${p2.x} ${p2.y} L${p3.x} ${p3.y} L${t3.x} ${t3.y} L${t2.x} ${t2.y} Z`}
          fill={color}
          filter="brightness(0.85)"
        />
        <path
          d={`M${p3.x} ${p3.y} L${p4.x} ${p4.y} L${t4.x} ${t4.y} L${t3.x} ${t3.y} Z`}
          fill={color}
          filter="brightness(0.7)"
        />
        <path
          d={`M${t1.x} ${t1.y} L${t2.x} ${t2.y} L${t3.x} ${t3.y} L${t4.x} ${t4.y} Z`}
          fill={color}
          filter="brightness(1.1)"
        />
      </g>
    );
  };

  const drawSpriteFurniture = (x: number, y: number, item: CustomFurniture, rot: number, isGhost = false, isValid = true, isSelected = false) => {
    const [w, d] = item.size;
    const effectiveW = rot % 2 === 0 ? w : d;
    const effectiveD = rot % 2 === 0 ? d : w;

    const center = toIso(x + effectiveW / 2, y + effectiveD / 2);
    const imageIndex = rot % 4;
    const imgSrc = item.spriteImages?.[imageIndex];
    if (!imgSrc) return null;

    const baseSize = Math.max(effectiveW, effectiveD) * 70;
    const scale = item.spriteScale ?? 1;
    const imgWidth = baseSize * scale;
    const imgHeight = imgWidth;

    const scaleX = (item.spriteScaleX ?? 100) / 100;
    const scaleY = (item.spriteScaleY ?? 100) / 100;
    const skewX = item.spriteSkewX ?? 0;
    const skewY = item.spriteSkewY ?? 0;

    let opacity = 1;
    let filter = item.spriteFilter || "";

    if (isGhost) {
      opacity = 0.7;
      filter = isValid ? "" : "sepia(1) hue-rotate(-50deg) saturate(3)";
    } else if (isSelected) {
      filter = "drop-shadow(0 0 5px red)";
    }

    const posX = center.x - imgWidth / 2 + (item.spriteOffsetX ?? 0);
    const posY = center.y - imgHeight + (item.spriteOffsetY ?? 20);

    return (
      <g style={{ opacity, pointerEvents: isGhost ? "none" : "auto" }}>
        <foreignObject
          x={posX}
          y={posY}
          width={imgWidth}
          height={imgHeight}
          style={{ overflow: "visible" }}
        >
          <div
            style={{
              width: imgWidth,
              height: imgHeight,
              transform: `scale(${scaleX}, ${scaleY}) skew(${skewX}deg, ${skewY}deg)`,
              transformOrigin: "center bottom",
              filter,
            }}
          >
            <img
              src={imgSrc}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        </foreignObject>
      </g>
    );
  };

  const drawComplexFurniture = (x: number, y: number, item: FurnitureItem, rot: number, isGhost = false, isValid = true, isSelected = false) => {
    if (item.type === "sprite" && (item as CustomFurniture).spriteImages) {
      return drawSpriteFurniture(x, y, item as CustomFurniture, rot, isGhost, isValid, isSelected);
    }

    const models = fullModels[item.id] || fullModels.default;
    const furnitureW = item.size[0];
    const furnitureD = item.size[1];
    let colorOverride: string | null = null;
    let opacity = 1;

    if (isGhost) {
      colorOverride = isValid ? "#34d399" : "#f87171";
      opacity = 0.6;
    } else if (isSelected) {
      colorOverride = "#f87171";
    }

    return (
      <g>
        {models?.map((prim: any, idx: number) =>
          drawBoxPrimitive(x, y, prim, furnitureW, furnitureD, rot, colorOverride, opacity, idx, isGhost),
        )}
      </g>
    );
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      if (draggingItem) {
        setDraggingRotation((prev) => (prev + 1) % 4);
      } else {
        setIsRotateDragging(true);
      }
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 0 && !draggingItem) {
      setIsPanDragging(true);
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const detectWallZone = (
    svgX: number,
    svgY: number,
  ): { gridPos: number; z: number; surface: "left-wall" | "right-wall" } | null => {
    const corners = [
      { x: 0, y: 0 },
      { x: gridSize, y: 0 },
      { x: gridSize, y: gridSize },
      { x: 0, y: gridSize },
    ];
    const screenCorners = corners.map((c) => ({ ...c, pos: toIso(c.x, c.y) }));
    let backCornerIdx = 0;
    let minScreenY = Infinity;
    screenCorners.forEach((c, idx) => {
      if (c.pos.y < minScreenY) {
        minScreenY = c.pos.y;
        backCornerIdx = idx;
      }
    });
    const prevIdx = (backCornerIdx - 1 + 4) % 4;
    const nextIdx = (backCornerIdx + 1) % 4;
    const backCorner = screenCorners[backCornerIdx];
    const prevCorner = screenCorners[prevIdx];
    const nextCorner = screenCorners[nextIdx];

    const leftWallResult = checkPointOnWall(svgX, svgY, backCorner.pos, prevCorner.pos, "left-wall");
    if (leftWallResult) return leftWallResult;

    const rightWallResult = checkPointOnWall(svgX, svgY, backCorner.pos, nextCorner.pos, "right-wall");
    if (rightWallResult) return rightWallResult;

    return null;
  };

  const checkPointOnWall = (
    svgX: number,
    svgY: number,
    start: { x: number; y: number },
    end: { x: number; y: number },
    surface: "left-wall" | "right-wall",
  ): { gridPos: number; z: number; surface: "left-wall" | "right-wall" } | null => {
    const wallDx = end.x - start.x;
    const wallDy = end.y - start.y;
    const wallLen = Math.sqrt(wallDx * wallDx + wallDy * wallDy);

    const t = ((svgX - start.x) * wallDx + (svgY - start.y) * wallDy) / (wallLen * wallLen);

    if (t < 0 || t > 1) return null;

    const closestX = start.x + t * wallDx;
    const closestY = start.y + t * wallDy;

    const perpDist = Math.sqrt(Math.pow(svgX - closestX, 2) + Math.pow(svgY - closestY, 2));

    const heightAboveWall = closestY - svgY;

    if (heightAboveWall > 15 && heightAboveWall < wallHeight && perpDist < 40) {
      const gridPos = Math.floor(t * wallGridCols);
      const z = Math.floor(heightAboveWall / wallCellHeight) * wallCellHeight + wallCellHeight / 2;
      return { gridPos: Math.min(gridPos, wallGridCols - 1), z, surface };
    }

    return null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanDragging) {
      const deltaX = e.clientX - lastMouseRef.current.x;
      const deltaY = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setOffset((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      return; // Don't calculate hover while panning
    } else if (isRotateDragging) {
      const deltaX = e.clientX - lastMouseRef.current.x;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setRotation((prev) => prev + deltaX * 0.01);
      return; // Don't calculate hover while rotating
    }

    // Always calculate SVG coordinates for hover detection
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;

    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const svgPoint = point.matrixTransform(ctm.inverse());
    const svgX = svgPoint.x - offset.x;
    const svgY = svgPoint.y - offset.y;

    // First, check if mouse is on a valid floor tile (priority over wall detection)
    const gridCoords = fromIso(svgX, svgY);
    const tileX = Math.floor(gridCoords.x);
    const tileY = Math.floor(gridCoords.y);

    if (tileX >= 0 && tileX < gridSize && tileY >= 0 && tileY < gridSize) {
      // Mouse is on valid floor tile
      setHoveredTile({ x: tileX, y: tileY });
      setHoveredWallTile(null);
    } else if (draggingItem) {
      // Only check wall zone when dragging and outside floor area
      const wallZone = detectWallZone(svgX, svgY);
      if (wallZone) {
        setHoveredWallTile(wallZone);
        setHoveredTile(null);
      } else {
        setHoveredTile(null);
        setHoveredWallTile(null);
      }
    } else {
      setHoveredTile(null);
      setHoveredWallTile(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanDragging(false);
    setIsRotateDragging(false);

    if (draggingItem) {
      if (hoveredWallTile && onCommitWallPlacement) {
        onCommitWallPlacement(draggingItem.id, hoveredWallTile.gridPos, hoveredWallTile.z, hoveredWallTile.surface);
      } else if (hoveredTile && isValidPlacement(hoveredTile.x, hoveredTile.y, draggingItem, draggingRotation)) {
        onCommitPlacement(draggingItem.id, hoveredTile.x, hoveredTile.y, draggingRotation);
      }
    }
  };

  const handleTileHover = (x: number, y: number) => {
    setHoveredTile({ x, y });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (draggingItem) {
      setDraggingRotation((prev) => (prev + 1) % 4);
    }
  };

  const isValidPlacement = (x: number, y: number, item: FurnitureItem | null, rot: number) => {
    if (!item) return false;
    const [w, d] = item.size;
    const effectiveW = rot % 2 === 0 ? w : d;
    const effectiveD = rot % 2 === 0 ? d : w;

    if (x + effectiveW > gridSize || y + effectiveD > gridSize) return false;

    for (let p of placements) {
      if (p.id === movingPlacementId) continue;
      const existingItem = fullCatalog.find((f) => f.id === p.furnitureId);
      if (!existingItem) continue;
      const [ew, ed] = existingItem.size;
      const pW = p.rotation % 2 === 0 ? ew : ed;
      const pD = p.rotation % 2 === 0 ? ed : ew;

      if (x < p.x + pW && x + effectiveW > p.x && y < p.y + pD && y + effectiveD > p.y) return false;
    }
    return true;
  };

  const getFloorPath = (eps: number) => {
    return `M${toIso(-eps, -eps).x} ${toIso(-eps, -eps).y} L${toIso(gridSize + eps, -eps).x} ${toIso(gridSize + eps, -eps).y} L${toIso(gridSize + eps, gridSize + eps).x} ${toIso(gridSize + eps, gridSize + eps).y} L${toIso(-eps, gridSize + eps).x} ${toIso(-eps, gridSize + eps).y} Z`;
  };

  const renderScene = () => {
    // Important: keep the floor plane (including hover/memory overlays) always behind furniture.
    // Otherwise, floor tiles in the “front” (larger screen Y) can sort above furniture placed in
    // the “back” (smaller screen Y), visually covering it.
    const floorObjects: Array<{ depth: number; type: string; render: React.ReactNode }> = [];
    const objects: Array<{ depth: number; type: string; render: React.ReactNode }> = [];

    const floorPath = getFloorPath(0.02);
    const hasCustomFloor = activeFloor?.image;

    floorObjects.push({
      depth: -99999,
      type: "floor-base",
      render: (
        <g key="floor-base">
          <defs>
            <linearGradient id="floor-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5E6D3" />
              <stop offset="50%" stopColor="#EBD9C6" />
              <stop offset="100%" stopColor="#E0CCBA" />
            </linearGradient>
          </defs>
          <path d={floorPath} fill={hasCustomFloor ? "transparent" : "url(#floor-gradient)"} />
        </g>
      ),
    });

    // Plank lines removed for cleaner floor appearance

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const center = toIso(x + 0.5, y + 0.5);
        const isHovered = hoveredTile?.x === x && hoveredTile?.y === y;
        const hasTileMemory = hasTileMemoryPoint ? hasTileMemoryPoint(x, y) : false;

        const tl = toIso(x, y);
        const tr = toIso(x + 1, y);
        const br = toIso(x + 1, y + 1);
        const bl = toIso(x, y + 1);

        const tilePath = `M${tl.x} ${tl.y} L${tr.x} ${tr.y} L${br.x} ${br.y} L${bl.x} ${bl.y} Z`;

        floorObjects.push({
          depth: center.y,
          type: "floor",
          render: (
            <g
              key={`tile-${x}-${y}`}
              onMouseEnter={() => handleTileHover(x, y)}
              onClick={(e) => {
                if (isMemoryMode && onMemoryClick) {
                  e.stopPropagation();
                  onMemoryClick("tile", `tile-${x}-${y}`, { x, y });
                } else if (onTileClick) {
                  e.stopPropagation();
                  onTileClick(x, y);
                }
              }}
              className="cursor-pointer"
            >
              <path d={tilePath} fill="transparent" style={{ pointerEvents: "auto" }} />
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
          ),
        });
      }
    }

    placements.forEach((p) => {
      const originalItem = fullCatalog.find((f) => f.id === p.furnitureId);
      if (!originalItem || p.id === movingPlacementId) return;

      // Resolve Variant
      let item = originalItem;
      if (p.variantId && (originalItem as CustomFurniture).colorVariants) {
        const variant = (originalItem as CustomFurniture).colorVariants?.find(v => v.id === p.variantId);
        if (variant) {
          // Create a shallow copy with overridden images
          // Note: casting to CustomFurniture to access spriteImages
          item = {
            ...originalItem,
            spriteImages: variant.images,
            // If we had a name change for variant, we could override it too, but visually images matter most
          } as CustomFurniture;
        }
      }

      const [w, d] = item.size;
      const effectiveW = p.rotation % 2 === 0 ? w : d;
      const effectiveD = p.rotation % 2 === 0 ? d : w;
      const center = toIso(p.x + effectiveW / 2, p.y + effectiveD / 2);
      const isSelected = removalSelectedId === p.id;
      const hasMemory = memoryPoints.some((mp) => mp.targetType === "furniture" && mp.targetId === p.id);
      const hasDue = hasDueCard ? hasDueCard(p.id) : false;

      objects.push({
        depth: center.y + 10,
        type: "furniture",
        render: (
          <g
            key={p.id}
            onMouseDown={(e) => {
              if (isStudyMode && hasDue && onStudyClick) {
                e.stopPropagation();
                onStudyClick(p.id);
              } else if (isMemoryMode && onMemoryClick) {
                e.stopPropagation();
                onMemoryClick("furniture", p.id, { furnitureId: p.furnitureId });
              } else if (isRemoveMode) {
                e.stopPropagation();
                onFurnitureClick(p.id);
              } else {
                e.stopPropagation();
                if (e.button === 0) onFurnitureMouseDown(p);
              }
            }}
            onClick={(e) => {
              // Handle variant cycling with Alt + Click
              if (e.altKey && onVariantChange) {
                e.stopPropagation();
                // Find next variant
                const variants = (item as CustomFurniture).colorVariants || [];
                if (variants.length > 0) {
                  const currentId = p.variantId || null;
                  const currentIndex = currentId ? variants.findIndex(v => v.id === currentId) : -1;

                  // Sequence: Default (starts at -1) -> Variant 0 -> Variant 1 -> ... -> Default
                  let nextIndex = currentIndex + 1;
                  if (nextIndex >= variants.length) {
                    onVariantChange(p.id, null); // Back to default
                  } else {
                    onVariantChange(p.id, variants[nextIndex].id);
                  }
                }
                return;
              }

              // Handle special furniture actions (like openPhonicsModal)
              if (!isStudyMode && !isMemoryMode && !isRemoveMode) {
                e.stopPropagation();
                onFurnitureClick(p.id);
              }
            }}
            className={`cursor-pointer hover:opacity-90 transition-opacity`}
          >
            {drawComplexFurniture(p.x, p.y, item, p.rotation, false, true, isSelected)}
            {hasDue && isStudyMode && (
              <g style={{ pointerEvents: "none" }}>
                <circle
                  cx={center.x}
                  cy={center.y - (item.height || 20) - 25}
                  r={16}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={2}
                  opacity={0.5}
                >
                  <animate attributeName="r" from="14" to="22" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite" />
                </circle>
                <circle
                  cx={center.x}
                  cy={center.y - (item.height || 20) - 25}
                  r={14}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={center.x}
                  y={center.y - (item.height || 20) - 19}
                  fontSize="16"
                  fill="white"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  !
                </text>
              </g>
            )}
            {hasMemory && !isStudyMode && (
              <g style={{ pointerEvents: "none" }}>
                <circle
                  cx={center.x}
                  cy={center.y - (item.height || 20) - 15}
                  r={10}
                  fill="#8b5cf6"
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={center.x}
                  y={center.y - (item.height || 20) - 11}
                  fontSize="10"
                  fill="white"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  M
                </text>
              </g>
            )}
            {isRemoveMode && <title>點擊選擇移除</title>}
            {isMemoryMode && <title>點擊添加/編輯記憶點</title>}
            {isStudyMode && hasDue && <title>點擊開始複習</title>}
          </g>
        ),
      });
    });

    wallPlacements.forEach((wp) => {
      const originalItem = fullCatalog.find((f) => f.id === wp.furnitureId);
      if (!originalItem) return;

      // Resolve Variant
      // Cast to CustomFurniture for potential variant access
      let item = originalItem as CustomFurniture;
      if (wp.variantId && item.colorVariants) {
        const variant = item.colorVariants.find(v => v.id === wp.variantId);
        if (variant) {
          item = {
            ...item,
            spriteImages: variant.images
          } as CustomFurniture;
        }
      }

      const wallPos = toIsoWall(wp.gridPos, wp.z, wp.surface);
      const itemSize = Math.max(item.size[0], item.size[1]) * 35;
      const isSelected = removalSelectedId === wp.id;

      objects.push({
        depth: -100 + wp.z,
        type: "wall-decoration",
        render: (
          <g
            key={`wall-${wp.id}`}
            transform={`translate(${wallPos.x}, ${wallPos.y})`}
            onClick={(e) => {
              if (isRemoveMode) {
                e.stopPropagation();
                onFurnitureClick(wp.id);
              }
            }}
            className="cursor-pointer"
          >
            <g transform={`skewY(${wallPos.skewY}deg)`}>
              {item.type === "sprite" && item.spriteImages?.[0] ? (
                <image
                  href={item.spriteImages[0]}
                  x={-itemSize / 2}
                  y={-itemSize}
                  width={itemSize}
                  height={itemSize}
                  style={{
                    filter: isSelected ? "drop-shadow(0 0 5px red)" : undefined,
                    opacity: isSelected ? 0.8 : 1,
                  }}
                />
              ) : (
                <rect
                  x={-itemSize / 2}
                  y={-itemSize}
                  width={itemSize}
                  height={itemSize}
                  fill={item.color || "#8b5cf6"}
                  stroke={isSelected ? "#ef4444" : "#6b7280"}
                  strokeWidth={isSelected ? 3 : 1}
                  rx={4}
                />
              )}
            </g>
            {isSelected && (
              <circle r={8} cy={-itemSize - 10} fill="#ef4444" stroke="white" strokeWidth={2}>
                <animate attributeName="r" from="6" to="10" dur="0.5s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        ),
      });
    });

    if (draggingItem && hoveredWallTile && !hoveredTile) {
      const wallPos = toIsoWall(hoveredWallTile.gridPos, hoveredWallTile.z, hoveredWallTile.surface);
      const itemSize = Math.max(draggingItem.size[0], draggingItem.size[1]) * 35;

      objects.push({
        depth: -100 + hoveredWallTile.z,
        type: "wall-ghost",
        render: (
          <g key="wall-ghost" transform={`translate(${wallPos.x}, ${wallPos.y})`} style={{ pointerEvents: "none" }}>
            <g transform={`skewY(${wallPos.skewY}deg)`}>
              {draggingItem.type === "sprite" && draggingItem.spriteImages?.[0] ? (
                <image
                  href={draggingItem.spriteImages[0]}
                  x={-itemSize / 2}
                  y={-itemSize}
                  width={itemSize}
                  height={itemSize}
                  style={{ opacity: 0.6, filter: "brightness(1.2)" }}
                />
              ) : (
                <rect
                  x={-itemSize / 2}
                  y={-itemSize}
                  width={itemSize}
                  height={itemSize}
                  fill="#34d399"
                  opacity={0.6}
                  rx={4}
                />
              )}
            </g>
          </g>
        ),
      });
    }

    if (draggingItem && hoveredTile && !hoveredWallTile) {
      const { x, y } = hoveredTile;
      const center = toIso(x + 0.5, y + 0.5);
      const isValid = isValidPlacement(x, y, draggingItem, draggingRotation);
      const ghostEl = drawComplexFurniture(x, y, draggingItem, draggingRotation, true, isValid);
      objects.push({
        depth: center.y + 20,
        type: "ghost",
        render: React.cloneElement(ghostEl as React.ReactElement, { key: "ghost-active" }),
      });
    }

    const avatarX = Math.floor(gridSize / 2);
    const avatarY = Math.floor(gridSize / 2);
    const avatarPos = toIso(avatarX + 0.5, avatarY + 0.5);
    objects.push({
      depth: avatarPos.y + 5,
      type: "avatar",
      render: (
        <g
          key="avatar"
          transform={`translate(${toIso(avatarX, avatarY).x}, ${toIso(avatarX, avatarY).y - 10})`}
          style={{ pointerEvents: "none" }}
        >
          {avatarUrl ? (
            <>
              {/* Shadow */}
              <ellipse cx="0" cy="0" rx="25" ry="12" fill="rgba(0,0,0,0.15)" />
              {/* Custom avatar image */}
              <image
                href={avatarUrl}
                x={-35}
                y={-80}
                width={70}
                height={80}
                preserveAspectRatio="xMidYMax meet"
              />
            </>
          ) : (
            <>
              {/* Default SVG character */}
              <ellipse cx="0" cy="0" rx="20" ry="10" fill="rgba(0,0,0,0.15)" />
              <rect x="-12" y="-45" width="24" height="35" rx="12" fill="#6366f1" />
              <rect x="-6" y="-35" width="12" height="15" rx="6" fill="#818cf8" />
              <path d="M-8 -15 L-8 0" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
              <path d="M8 -15 L8 0" stroke="#4f46e5" strokeWidth="8" strokeLinecap="round" />
              <circle cx="0" cy="-55" r="22" fill="#fda4af" stroke="#f43f5e" strokeWidth="2" />
              <circle cx="-6" cy="-55" r="2" fill="#333" />
              <circle cx="6" cy="-55" r="2" fill="#333" />
            </>
          )}
        </g>
      ),
    });

    floorObjects.sort((a, b) => a.depth - b.depth);
    objects.sort((a, b) => a.depth - b.depth);

    // Render floor first, then all non-floor objects on top.
    return [...floorObjects, ...objects].map((o) => o.render);
  };

  const renderWalls = () => {
    const corners = [
      { x: 0, y: 0 },
      { x: gridSize, y: 0 },
      { x: gridSize, y: gridSize },
      { x: 0, y: gridSize },
    ];
    const screenCorners = corners.map((c) => ({ ...c, pos: toIso(c.x, c.y) }));
    let backCornerIdx = 0;
    let minScreenY = Infinity;
    screenCorners.forEach((c, idx) => {
      if (c.pos.y < minScreenY) {
        minScreenY = c.pos.y;
        backCornerIdx = idx;
      }
    });
    const prevIdx = (backCornerIdx - 1 + 4) % 4;
    const nextIdx = (backCornerIdx + 1) % 4;
    const backCorner = screenCorners[backCornerIdx];
    const prevCorner = screenCorners[prevIdx];
    const nextCorner = screenCorners[nextIdx];

    const hasCustomWallLight = activeWall?.lightSide || activeWall?.lightImage;
    const hasCustomWallDark = activeWall?.darkSide || activeWall?.darkImage;

    return (
      <g style={{ pointerEvents: "none" }}>
        <defs>
          <linearGradient id="wall-left-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5DC9BF" />
            <stop offset="30%" stopColor="#4DB6AC" />
            <stop offset="100%" stopColor="#3D9B91" />
          </linearGradient>
          <linearGradient id="wall-right-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4DB6AC" />
            <stop offset="30%" stopColor="#3D9B91" />
            <stop offset="100%" stopColor="#2D8B81" />
          </linearGradient>
          {hasCustomWallLight && (
            <pattern id="custom-wall-light-pattern" patternUnits="userSpaceOnUse" width="100" height="100">
              <image href={activeWall?.lightSide || activeWall?.lightImage} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
          {hasCustomWallDark && (
            <pattern id="custom-wall-dark-pattern" patternUnits="userSpaceOnUse" width="100" height="100">
              <image href={activeWall?.darkSide || activeWall?.darkImage} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
          <linearGradient id="wood-frame-light" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#A1887F" />
            <stop offset="50%" stopColor="#8D6E63" />
            <stop offset="100%" stopColor="#6D4C41" />
          </linearGradient>
          <linearGradient id="wood-frame-dark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8D6E63" />
            <stop offset="50%" stopColor="#6D4C41" />
            <stop offset="100%" stopColor="#5D4037" />
          </linearGradient>
          <linearGradient id="wood-baseboard" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8D6E63" />
            <stop offset="100%" stopColor="#5D4037" />
          </linearGradient>
          <linearGradient id="ao-shadow" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(45, 80, 75, 0.5)" />
            <stop offset="40%" stopColor="rgba(45, 80, 75, 0)" />
          </linearGradient>
        </defs>

        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight} Z`}
          fill={hasCustomWallLight ? "url(#custom-wall-light-pattern)" : "url(#wall-left-gradient)"}
        />
        {!hasCustomWallLight && (
          <path
            d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight} L${prevCorner.pos.x + 2} ${prevCorner.pos.y - wallHeight + 3} L${backCorner.pos.x - 2} ${backCorner.pos.y - wallHeight + 3} Z`}
            fill="#7DD4CA"
            opacity={0.7}
          />
        )}
        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y - 40} L${backCorner.pos.x} ${backCorner.pos.y - 40} Z`}
          fill="url(#ao-shadow)"
        />

        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight} Z`}
          fill={hasCustomWallDark ? "url(#custom-wall-dark-pattern)" : "url(#wall-right-gradient)"}
        />
        {!hasCustomWallDark && (
          <path
            d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight} L${nextCorner.pos.x - 2} ${nextCorner.pos.y - wallHeight + 3} L${backCorner.pos.x + 2} ${backCorner.pos.y - wallHeight + 3} Z`}
            fill="#5DC9BF"
            opacity={0.5}
          />
        )}
        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y - 40} L${backCorner.pos.x} ${backCorner.pos.y - 40} Z`}
          fill="url(#ao-shadow)"
        />

        <line
          x1={backCorner.pos.x}
          y1={backCorner.pos.y}
          x2={backCorner.pos.x}
          y2={backCorner.pos.y - wallHeight}
          stroke="#7DD4CA"
          strokeWidth="2"
          opacity={0.8}
        />

        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y} L${prevCorner.pos.x} ${prevCorner.pos.y - baseboardHeight} L${backCorner.pos.x} ${backCorner.pos.y - baseboardHeight} Z`}
          fill="url(#wood-baseboard)"
        />
        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y - baseboardHeight} L${prevCorner.pos.x} ${prevCorner.pos.y - baseboardHeight} L${prevCorner.pos.x + 1} ${prevCorner.pos.y - baseboardHeight + 2} L${backCorner.pos.x - 1} ${backCorner.pos.y - baseboardHeight + 2} Z`}
          fill="#A1887F"
          opacity={0.8}
        />

        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y} L${nextCorner.pos.x} ${nextCorner.pos.y - baseboardHeight} L${backCorner.pos.x} ${backCorner.pos.y - baseboardHeight} Z`}
          fill="url(#wood-frame-dark)"
        />
        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y - baseboardHeight} L${nextCorner.pos.x} ${nextCorner.pos.y - baseboardHeight} L${nextCorner.pos.x - 1} ${nextCorner.pos.y - baseboardHeight + 2} L${backCorner.pos.x + 1} ${backCorner.pos.y - baseboardHeight + 2} Z`}
          fill="#8D6E63"
          opacity={0.6}
        />

        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight - frameThickness} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight - frameThickness} Z`}
          fill="url(#wood-frame-light)"
        />
        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight - frameThickness} L${prevCorner.pos.x} ${prevCorner.pos.y - wallHeight - frameThickness} L${prevCorner.pos.x + 2} ${prevCorner.pos.y - wallHeight - frameThickness + 3} L${backCorner.pos.x - 2} ${backCorner.pos.y - wallHeight - frameThickness + 3} Z`}
          fill="#BCAAA4"
          opacity={0.8}
        />

        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight - frameThickness} L${backCorner.pos.x} ${backCorner.pos.y - wallHeight - frameThickness} Z`}
          fill="url(#wood-frame-dark)"
        />
        <path
          d={`M${backCorner.pos.x} ${backCorner.pos.y - wallHeight - frameThickness} L${nextCorner.pos.x} ${nextCorner.pos.y - wallHeight - frameThickness} L${nextCorner.pos.x - 2} ${nextCorner.pos.y - wallHeight - frameThickness + 3} L${backCorner.pos.x + 2} ${backCorner.pos.y - wallHeight - frameThickness + 3} Z`}
          fill="#A1887F"
          opacity={0.6}
        />

        <rect
          x={backCorner.pos.x - 6}
          y={backCorner.pos.y - wallHeight - frameThickness}
          width={12}
          height={wallHeight + frameThickness}
          fill="url(#wood-frame-light)"
        />
        <rect
          x={backCorner.pos.x - 6}
          y={backCorner.pos.y - wallHeight - frameThickness}
          width={3}
          height={wallHeight + frameThickness}
          fill="#BCAAA4"
          opacity={0.5}
        />

        <rect
          x={prevCorner.pos.x - 6}
          y={prevCorner.pos.y - wallHeight - frameThickness}
          width={12}
          height={wallHeight + frameThickness}
          fill="url(#wood-frame-dark)"
        />

        <rect
          x={nextCorner.pos.x - 6}
          y={nextCorner.pos.y - wallHeight - frameThickness}
          width={12}
          height={wallHeight + frameThickness}
          fill="url(#wood-frame-dark)"
        />
      </g>
    );
  };

  const renderCompassLabels = () => {
    const labelStyle: React.CSSProperties = {
      fontSize: "14px",
      fontWeight: "bold",
      fill: "#5D4037",
      fontFamily: "monospace",
      textAnchor: "middle" as const,
    };
    const nPos = toIso(0, gridSize / 2);
    const ePos = toIso(gridSize / 2, 0);
    const sPos = toIso(gridSize, gridSize / 2);
    const wPos = toIso(gridSize / 2, gridSize);
    return (
      <g className="select-none pointer-events-none">
        <text x={nPos.x - 40} y={nPos.y - 15} style={labelStyle}>
          北 (N)
        </text>
        <text x={ePos.x + 40} y={ePos.y - 15} style={labelStyle}>
          東 (E)
        </text>
        <text x={sPos.x + 40} y={sPos.y + 25} style={labelStyle}>
          南 (S)
        </text>
        <text x={wPos.x - 40} y={wPos.y + 25} style={labelStyle}>
          西 (W)
        </text>
      </g>
    );
  };

  return (
    <div
      className={`w-full h-full flex items-center justify-center overflow-hidden bg-slate-50 relative group ${draggingItem ? "cursor-grabbing" : isRemoveMode ? "cursor-crosshair" : "cursor-default"}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      data-component-name="IsometricRoom"
      data-source-file="src/components/room/IsometricRoom.tsx"
    >
      <svg
        ref={svgRef}
        viewBox="-400 -300 800 600"
        className="w-full h-full max-w-[800px] select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`translate(${offset.x}, ${offset.y})`}>
          {renderWalls()}

          {activeFloor?.image && (
            <>
              <defs>
                {Array.from({ length: Math.ceil(gridSize / 2) }).map((_, i) =>
                  Array.from({ length: Math.ceil(gridSize / 2) }).map((_, j) => {
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
                  }),
                )}
              </defs>

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

              {Array.from({ length: Math.ceil(gridSize / 2) }).map((_, i) =>
                Array.from({ length: Math.ceil(gridSize / 2) }).map((_, j) => {
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
                        href={activeFloor.image}
                        x={centerX - imgWidth / 2}
                        y={centerY - imgHeight / 2}
                        width={imgWidth}
                        height={imgHeight}
                        preserveAspectRatio="xMidYMid slice"
                        style={{ pointerEvents: "none" }}
                      />
                    </g>
                  );
                }),
              )}
            </>
          )}

          {renderScene()}

          {showGrid && (
            <g style={{ pointerEvents: "none" }}>
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

              {gridMode === "full" && (
                <>
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
                </>
              )}
            </g>
          )}

          {renderCompassLabels()}
        </g>
      </svg>
    </div>
  );
};

export default IsometricRoom;
