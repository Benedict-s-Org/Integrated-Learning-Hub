import { GridMode } from "@/components/IsometricGridOverlay";
import { MemoryPoint } from "@/hooks/useMemoryPoints";
import { FurnitureItem, Placement, WallPlacement, FurnitureModel } from "@/types/furniture";
import { CustomWall, CustomFloor, HoveredTile, HoveredWallTile, IsoPoint } from "@/types/room";

// Props for the main IsometricRoom component
export interface IsometricRoomProps {
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
  fullModels: Record<string, FurnitureModel[]>;
  activeWall?: CustomWall | null;
  activeFloor?: CustomFloor | null;
  tileWidth: number;
  tileHeight: number;
  isMemoryMode?: boolean;
  onMemoryClick?: (targetType: string, targetId: string, position: { x?: number; y?: number; furnitureId?: string }) => void;
  memoryPoints?: MemoryPoint[];
  hasTileMemoryPoint?: (x: number, y: number) => boolean;
  isStudyMode?: boolean;
  onStudyClick?: (placementId: string) => void;
  hasDueCard?: (placementId: string) => boolean;
  onRemoveWallPlacement?: (id: string) => void;
  showGrid?: boolean;
  gridMode?: GridMode;
}

// Props for floor renderer
export interface FloorRendererProps {
  gridSize: number;
  toIso: (x: number, y: number) => IsoPoint;
  activeFloor?: CustomFloor | null;
  hoveredTile: HoveredTile | null;
  isMemoryMode: boolean;
  hasTileMemoryPoint?: (x: number, y: number) => boolean;
  onTileHover: (x: number, y: number) => void;
  onMemoryClick?: (targetType: string, targetId: string, position: { x: number; y: number }) => void;
}

// Props for wall renderer
export interface WallRendererProps {
  gridSize: number;
  wallHeight: number;
  toIso: (x: number, y: number) => IsoPoint;
  activeWall?: CustomWall | null;
}

// Props for furniture renderer
export interface FurnitureRendererProps {
  placements: Placement[];
  wallPlacements: WallPlacement[];
  fullCatalog: FurnitureItem[];
  fullModels: Record<string, FurnitureModel[]>;
  toIso: (x: number, y: number) => IsoPoint;
  toIsoWall: (gridPos: number, z: number, surface: "left-wall" | "right-wall") => { x: number; y: number; skewY: number };
  isRemoveMode: boolean;
  removalSelectedId: string | null;
  movingPlacementId: string | null;
  isMemoryMode: boolean;
  isStudyMode: boolean;
  memoryPoints: MemoryPoint[];
  hasDueCard?: (placementId: string) => boolean;
  onFurnitureClick: (id: string) => void;
  onFurnitureMouseDown: (placement: Placement) => void;
  onMemoryClick?: (targetType: string, targetId: string, position: { furnitureId?: string }) => void;
  onStudyClick?: (placementId: string) => void;
}

// Props for avatar renderer
export interface AvatarRendererProps {
  gridSize: number;
  toIso: (x: number, y: number) => IsoPoint;
}

// Props for ghost furniture (preview during drag)
export interface GhostFurnitureProps {
  draggingItem: FurnitureItem;
  hoveredTile: HoveredTile | null;
  hoveredWallTile: HoveredWallTile | null;
  draggingRotation: number;
  isValidPlacement: boolean;
  toIso: (x: number, y: number) => IsoPoint;
  toIsoWall: (gridPos: number, z: number, surface: "left-wall" | "right-wall") => { x: number; y: number; skewY: number };
  fullModels: Record<string, FurnitureModel[]>;
}

// Camera/pan state hook return type
export interface IsometricCameraState {
  offset: { x: number; y: number };
  rotation: number;
  isPanDragging: boolean;
  isRotateDragging: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
}
