// Room Geometry Utilities for Space Design Center
// Handles chunk-based room layout, perimeter calculation, and wall segments

export interface Chunk {
  cx: number;
  cy: number;
}

export interface Tile {
  x: number;
  y: number;
}

export interface WallSegment {
  id: string;
  start: Tile;
  end: Tile;
  surface: 'left-wall' | 'right-wall' | 'front-left' | 'front-right';
  lengthInTiles: number;
  direction: 'horizontal' | 'vertical';
}

export interface PerimeterEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

// Door placement on a wall segment
export interface DoorPlacement {
  id: string;
  segmentId: string;
  position: number; // Position along the segment (0 to lengthInTiles-1)
  doorType: string; // e.g., 'door_basic', 'door_double', 'door_arch'
  width: number; // Width in tiles (usually 2)
}

// Room/Region for connectivity
export interface Room {
  id: string;
  chunkKeys: Set<string>;
  connectedRoomIds: Set<string>;
}

// Connectivity graph between rooms
export interface ConnectivityGraph {
  rooms: Room[];
  doors: DoorPlacement[];
  isFullyConnected: boolean;
}

// Convert chunks to individual tiles
export function chunksToTiles(chunks: Chunk[]): Set<string> {
  const tiles = new Set<string>();
  for (const chunk of chunks) {
    // Each 2x2 chunk produces 4 tiles
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 2; dy++) {
        tiles.add(`${chunk.cx + dx},${chunk.cy + dy}`);
      }
    }
  }
  return tiles;
}

// Parse tile key back to coordinates
export function parseTileKey(key: string): Tile {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

// Check if a tile exists in the active set
export function isTileActive(activeTiles: Set<string>, x: number, y: number): boolean {
  return activeTiles.has(`${x},${y}`);
}

// Check if a furniture placement is valid within active tiles
export function isPlacementValid(
  activeTiles: Set<string>,
  x: number,
  y: number,
  width: number,
  depth: number
): boolean {
  for (let dx = 0; dx < width; dx++) {
    for (let dy = 0; dy < depth; dy++) {
      if (!activeTiles.has(`${x + dx},${y + dy}`)) {
        return false;
      }
    }
  }
  return true;
}

// Get bounding box of all chunks
export function getChunksBounds(chunks: Chunk[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (chunks.length === 0) {
    return { minX: 0, minY: 0, maxX: 2, maxY: 2 };
  }
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const chunk of chunks) {
    minX = Math.min(minX, chunk.cx);
    minY = Math.min(minY, chunk.cy);
    maxX = Math.max(maxX, chunk.cx + 2);
    maxY = Math.max(maxY, chunk.cy + 2);
  }
  
  return { minX, minY, maxX, maxY };
}

// Get adjacent chunk positions that could be expanded to
export function getExpandableChunks(chunks: Chunk[]): Chunk[] {
  const existing = new Set(chunks.map(c => `${c.cx},${c.cy}`));
  const candidates = new Set<string>();
  
  for (const chunk of chunks) {
    // Check all 4 adjacent positions (up, down, left, right)
    const adjacent = [
      { cx: chunk.cx - 2, cy: chunk.cy },     // left
      { cx: chunk.cx + 2, cy: chunk.cy },     // right
      { cx: chunk.cx, cy: chunk.cy - 2 },     // up
      { cx: chunk.cx, cy: chunk.cy + 2 },     // down
    ];
    
    for (const adj of adjacent) {
      const key = `${adj.cx},${adj.cy}`;
      if (!existing.has(key)) {
        candidates.add(key);
      }
    }
  }
  
  return Array.from(candidates).map(key => {
    const [cx, cy] = key.split(',').map(Number);
    return { cx, cy };
  });
}

// Check if adding a chunk would create a hole (simple validation)
export function wouldCreateHole(chunks: Chunk[], newChunk: Chunk): boolean {
  // For V1, we do a simple connectivity check
  // A hole would mean there's an enclosed empty space
  // This is a simplified check - just ensure the new chunk connects
  
  if (chunks.length === 0) return false;
  
  const existing = new Set(chunks.map(c => `${c.cx},${c.cy}`));
  
  // Check if new chunk is adjacent to any existing chunk
  const isAdjacent = chunks.some(c => {
    const dx = Math.abs(c.cx - newChunk.cx);
    const dy = Math.abs(c.cy - newChunk.cy);
    return (dx === 2 && dy === 0) || (dx === 0 && dy === 2);
  });
  
  return !isAdjacent;
}

// Calculate perimeter edges from active tiles
export function calculatePerimeter(activeTiles: Set<string>): PerimeterEdge[] {
  const edges: PerimeterEdge[] = [];
  
  for (const tileKey of activeTiles) {
    const { x, y } = parseTileKey(tileKey);
    
    // Check each edge of this tile
    // Top edge (if no tile above)
    if (!activeTiles.has(`${x},${y - 1}`)) {
      edges.push({ x1: x, y1: y, x2: x + 1, y2: y, direction: 'up' });
    }
    // Bottom edge (if no tile below)
    if (!activeTiles.has(`${x},${y + 1}`)) {
      edges.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1, direction: 'down' });
    }
    // Left edge (if no tile to left)
    if (!activeTiles.has(`${x - 1},${y}`)) {
      edges.push({ x1: x, y1: y, x2: x, y2: y + 1, direction: 'left' });
    }
    // Right edge (if no tile to right)
    if (!activeTiles.has(`${x + 1},${y}`)) {
      edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1, direction: 'right' });
    }
  }
  
  return edges;
}

// Group perimeter edges into wall segments (2 tiles = 1 wall unit)
export function calculateWallSegments(activeTiles: Set<string>): WallSegment[] {
  const edges = calculatePerimeter(activeTiles);
  const segments: WallSegment[] = [];
  
  // Group edges by direction and position
  const leftEdges = edges.filter(e => e.direction === 'left');
  const rightEdges = edges.filter(e => e.direction === 'right');
  const upEdges = edges.filter(e => e.direction === 'up');
  const downEdges = edges.filter(e => e.direction === 'down');
  
  // Process left edges (these become left-wall segments in isometric view)
  // Sort by x, then y
  const sortedLeftEdges = [...leftEdges].sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1);
  let currentSegment: PerimeterEdge[] = [];
  
  for (const edge of sortedLeftEdges) {
    if (currentSegment.length === 0) {
      currentSegment.push(edge);
    } else {
      const last = currentSegment[currentSegment.length - 1];
      if (last.x1 === edge.x1 && last.y2 === edge.y1) {
        currentSegment.push(edge);
      } else {
        if (currentSegment.length > 0) {
          const first = currentSegment[0];
          const lastEdge = currentSegment[currentSegment.length - 1];
          segments.push({
            id: `left-${first.x1}-${first.y1}`,
            start: { x: first.x1, y: first.y1 },
            end: { x: lastEdge.x2, y: lastEdge.y2 },
            surface: 'left-wall',
            lengthInTiles: currentSegment.length,
            direction: 'vertical'
          });
        }
        currentSegment = [edge];
      }
    }
  }
  // Don't forget the last segment
  if (currentSegment.length > 0) {
    const first = currentSegment[0];
    const lastEdge = currentSegment[currentSegment.length - 1];
    segments.push({
      id: `left-${first.x1}-${first.y1}`,
      start: { x: first.x1, y: first.y1 },
      end: { x: lastEdge.x2, y: lastEdge.y2 },
      surface: 'left-wall',
      lengthInTiles: currentSegment.length,
      direction: 'vertical'
    });
  }
  
  // Process up edges (these become right-wall segments in isometric view)
  const sortedUpEdges = [...upEdges].sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);
  currentSegment = [];
  
  for (const edge of sortedUpEdges) {
    if (currentSegment.length === 0) {
      currentSegment.push(edge);
    } else {
      const last = currentSegment[currentSegment.length - 1];
      if (last.y1 === edge.y1 && last.x2 === edge.x1) {
        currentSegment.push(edge);
      } else {
        if (currentSegment.length > 0) {
          const first = currentSegment[0];
          const lastEdge = currentSegment[currentSegment.length - 1];
          segments.push({
            id: `right-${first.x1}-${first.y1}`,
            start: { x: first.x1, y: first.y1 },
            end: { x: lastEdge.x2, y: lastEdge.y2 },
            surface: 'right-wall',
            lengthInTiles: currentSegment.length,
            direction: 'horizontal'
          });
        }
        currentSegment = [edge];
      }
    }
  }
  if (currentSegment.length > 0) {
    const first = currentSegment[0];
    const lastEdge = currentSegment[currentSegment.length - 1];
    segments.push({
      id: `right-${first.x1}-${first.y1}`,
      start: { x: first.x1, y: first.y1 },
      end: { x: lastEdge.x2, y: lastEdge.y2 },
      surface: 'right-wall',
      lengthInTiles: currentSegment.length,
      direction: 'horizontal'
    });
  }
  
  return segments;
}

// Convert isometric coordinates helper
export function toIso(x: number, y: number, tileWidth = 40, tileHeight = 20): { x: number; y: number } {
  return {
    x: (x - y) * (tileWidth / 2),
    y: (x + y) * (tileHeight / 2)
  };
}

// Inverse isometric conversion
export function fromIso(screenX: number, screenY: number, tileWidth = 40, tileHeight = 20): { x: number; y: number } {
  const x = (screenX / (tileWidth / 2) + screenY / (tileHeight / 2)) / 2;
  const y = (screenY / (tileHeight / 2) - screenX / (tileWidth / 2)) / 2;
  return { x, y };
}

// ==========================================
// DOOR AND CONNECTIVITY FUNCTIONS (V3)
// ==========================================

// Find which wall segment a door is on
export function findDoorSegment(segments: WallSegment[], door: DoorPlacement): WallSegment | undefined {
  return segments.find(s => s.id === door.segmentId);
}

// Check if a door can be placed at a position on a segment
export function canPlaceDoor(
  segment: WallSegment,
  position: number,
  doorWidth: number = 2
): boolean {
  // Door must fit within the segment
  if (position < 0 || position + doorWidth > segment.lengthInTiles) {
    return false;
  }
  return true;
}

// Split a wall segment around a door (for rendering with cutout)
export interface WallRenderSegment {
  startPos: number;
  endPos: number;
  isDoor: boolean;
  doorId?: string;
}

export function splitSegmentForDoors(
  segment: WallSegment,
  doors: DoorPlacement[]
): WallRenderSegment[] {
  const segmentDoors = doors
    .filter(d => d.segmentId === segment.id)
    .sort((a, b) => a.position - b.position);
  
  if (segmentDoors.length === 0) {
    return [{ startPos: 0, endPos: segment.lengthInTiles, isDoor: false }];
  }
  
  const renderSegments: WallRenderSegment[] = [];
  let currentPos = 0;
  
  for (const door of segmentDoors) {
    // Wall segment before door
    if (door.position > currentPos) {
      renderSegments.push({
        startPos: currentPos,
        endPos: door.position,
        isDoor: false
      });
    }
    
    // Door segment
    renderSegments.push({
      startPos: door.position,
      endPos: door.position + door.width,
      isDoor: true,
      doorId: door.id
    });
    
    currentPos = door.position + door.width;
  }
  
  // Wall segment after last door
  if (currentPos < segment.lengthInTiles) {
    renderSegments.push({
      startPos: currentPos,
      endPos: segment.lengthInTiles,
      isDoor: false
    });
  }
  
  return renderSegments;
}

// Calculate isometric points for a wall segment portion
export function getWallSegmentPath(
  segment: WallSegment,
  startPos: number,
  endPos: number,
  wallHeight: number,
  tileWidth: number,
  tileHeight: number
): { floor: { x: number; y: number }[]; top: { x: number; y: number }[] } {
  const ratio = (pos: number) => pos / segment.lengthInTiles;
  
  const startRatio = ratio(startPos);
  const endRatio = ratio(endPos);
  
  // Interpolate along the segment
  const floorStart = {
    x: segment.start.x + (segment.end.x - segment.start.x) * startRatio,
    y: segment.start.y + (segment.end.y - segment.start.y) * startRatio
  };
  const floorEnd = {
    x: segment.start.x + (segment.end.x - segment.start.x) * endRatio,
    y: segment.start.y + (segment.end.y - segment.start.y) * endRatio
  };
  
  const isoStart = toIso(floorStart.x, floorStart.y, tileWidth, tileHeight);
  const isoEnd = toIso(floorEnd.x, floorEnd.y, tileWidth, tileHeight);
  
  return {
    floor: [isoStart, isoEnd],
    top: [
      { x: isoStart.x, y: isoStart.y - wallHeight },
      { x: isoEnd.x, y: isoEnd.y - wallHeight }
    ]
  };
}

// ==========================================
// ROOM CONNECTIVITY (V3)
// ==========================================

// Build connectivity graph from chunks and doors
export function buildConnectivityGraph(
  chunks: Chunk[],
  doors: DoorPlacement[],
  wallSegments: WallSegment[]
): ConnectivityGraph {
  // For V3 basic: treat all chunks as one room initially
  // Doors connect rooms when they're on shared walls
  
  const rooms: Room[] = [];
  
  if (chunks.length === 0) {
    return { rooms, doors, isFullyConnected: true };
  }
  
  // Simple approach: all chunks form one room
  // In future, we could separate by doors/walls
  const mainRoom: Room = {
    id: 'main',
    chunkKeys: new Set(chunks.map(c => `${c.cx},${c.cy}`)),
    connectedRoomIds: new Set()
  };
  rooms.push(mainRoom);
  
  // Check if all areas are reachable (for now, always true with single room)
  const isFullyConnected = rooms.length <= 1 || 
    rooms.every(r => r.connectedRoomIds.size > 0 || rooms.length === 1);
  
  return { rooms, doors, isFullyConnected };
}

// Check if two chunks share an edge (are adjacent)
export function chunksShareEdge(c1: Chunk, c2: Chunk): boolean {
  const dx = Math.abs(c1.cx - c2.cx);
  const dy = Math.abs(c1.cy - c2.cy);
  return (dx === 2 && dy === 0) || (dx === 0 && dy === 2);
}

// Find shared wall segment between two adjacent chunks
export function findSharedWallSegment(
  c1: Chunk,
  c2: Chunk,
  segments: WallSegment[]
): WallSegment | undefined {
  const dx = c2.cx - c1.cx;
  const dy = c2.cy - c1.cy;
  
  // Determine the shared edge position
  let sharedX: number, sharedY: number;
  let surface: 'left-wall' | 'right-wall';
  
  if (dx === 2) {
    // c2 is to the right of c1
    sharedX = c1.cx + 2;
    sharedY = c1.cy;
    surface = 'right-wall';
  } else if (dx === -2) {
    // c2 is to the left of c1
    sharedX = c1.cx;
    sharedY = c1.cy;
    surface = 'left-wall';
  } else if (dy === 2) {
    // c2 is below c1
    sharedX = c1.cx;
    sharedY = c1.cy + 2;
    surface = 'left-wall';
  } else {
    // c2 is above c1
    sharedX = c1.cx;
    sharedY = c1.cy;
    surface = 'right-wall';
  }
  
  // Find matching segment
  return segments.find(s => 
    s.surface === surface &&
    s.start.x <= sharedX && s.end.x >= sharedX &&
    s.start.y <= sharedY && s.end.y >= sharedY
  );
}

// Door catalog items
export const DOOR_CATALOG = [
  {
    id: 'door_basic',
    name: '基本木門',
    type: 'door',
    width: 2,
    height: 3,
    cost: 50,
    desc: '簡單的木製門',
    color: '#8B4513',
    isDoor: true
  },
  {
    id: 'door_double',
    name: '雙開門',
    type: 'door',
    width: 3,
    height: 3,
    cost: 100,
    desc: '寬敞的雙開門',
    color: '#654321',
    isDoor: true
  },
  {
    id: 'door_arch',
    name: '拱形門',
    type: 'door',
    width: 2,
    height: 4,
    cost: 150,
    desc: '優雅的拱形門框',
    color: '#A0522D',
    isDoor: true
  }
];
