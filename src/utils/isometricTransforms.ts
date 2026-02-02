import { IsoPoint } from "@/types/room";

/**
 * Convert grid coordinates to isometric screen coordinates
 */
export function toIso(
  x: number, 
  y: number, 
  gridSize: number, 
  rotation: number, 
  tileWidth: number, 
  tileHeight: number
): IsoPoint {
  const cx = x - gridSize / 2;
  const cy = y - gridSize / 2;
  const rx = cx * Math.cos(rotation) - cy * Math.sin(rotation);
  const ry = cx * Math.sin(rotation) + cy * Math.cos(rotation);
  return {
    x: (rx - ry) * (tileWidth / 2),
    y: (rx + ry) * (tileHeight / 2),
  };
}

/**
 * Convert screen coordinates back to grid coordinates
 */
export function fromIso(
  screenX: number, 
  screenY: number, 
  gridSize: number, 
  rotation: number, 
  tileWidth: number, 
  tileHeight: number
): { x: number; y: number } {
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
}

/**
 * Calculate isometric position for wall decorations
 */
export function toIsoWall(
  gridPos: number,
  z: number,
  surface: "left-wall" | "right-wall",
  gridSize: number,
  toIsoFn: (x: number, y: number) => IsoPoint
): { x: number; y: number; skewY: number } {
  const corners = [
    { x: 0, y: 0 },
    { x: gridSize, y: 0 },
    { x: gridSize, y: gridSize },
    { x: 0, y: gridSize },
  ];
  const screenCorners = corners.map((c) => ({ ...c, pos: toIsoFn(c.x, c.y) }));
  
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
}

/**
 * Find the back corner index for wall rendering
 */
export function findBackCorner(
  gridSize: number,
  toIsoFn: (x: number, y: number) => IsoPoint
): {
  backCorner: { x: number; y: number; pos: IsoPoint };
  prevCorner: { x: number; y: number; pos: IsoPoint };
  nextCorner: { x: number; y: number; pos: IsoPoint };
} {
  const corners = [
    { x: 0, y: 0 },
    { x: gridSize, y: 0 },
    { x: gridSize, y: gridSize },
    { x: 0, y: gridSize },
  ];
  const screenCorners = corners.map((c) => ({ ...c, pos: toIsoFn(c.x, c.y) }));
  
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
  
  return {
    backCorner: screenCorners[backCornerIdx],
    prevCorner: screenCorners[prevIdx],
    nextCorner: screenCorners[nextIdx],
  };
}

/**
 * Get floor diamond path for a given grid boundary
 */
export function getFloorPath(
  gridSize: number,
  toIsoFn: (x: number, y: number) => IsoPoint,
  eps: number = 0
): string {
  const p1 = toIsoFn(-eps, -eps);
  const p2 = toIsoFn(gridSize + eps, -eps);
  const p3 = toIsoFn(gridSize + eps, gridSize + eps);
  const p4 = toIsoFn(-eps, gridSize + eps);
  return `M${p1.x} ${p1.y} L${p2.x} ${p2.y} L${p3.x} ${p3.y} L${p4.x} ${p4.y} Z`;
}

/**
 * Get tile diamond path for a specific grid cell
 */
export function getTilePath(
  x: number,
  y: number,
  toIsoFn: (x: number, y: number) => IsoPoint
): string {
  const tl = toIsoFn(x, y);
  const tr = toIsoFn(x + 1, y);
  const br = toIsoFn(x + 1, y + 1);
  const bl = toIsoFn(x, y + 1);
  return `M${tl.x} ${tl.y} L${tr.x} ${tr.y} L${br.x} ${br.y} L${bl.x} ${bl.y} Z`;
}
