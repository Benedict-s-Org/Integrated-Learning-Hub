// Building types available in the city
export type BuildingType = 'house' | 'shop' | 'school' | 'park' | 'landmark';

// City object transform parameters (for fine-tuning custom images)
export interface CityTransformData {
  offsetX?: number;      // Horizontal offset (pixels)
  offsetY?: number;      // Vertical offset (pixels)
  scale?: number;        // Overall scale (1 = 100%)
  scaleX?: number;       // Horizontal stretch (100 = 100%)
  scaleY?: number;       // Vertical stretch (100 = 100%)
  rotation?: number;     // Rotation angle (degrees)
}

// Building definition
export interface Building {
  id: string;
  name: string;
  type: BuildingType;
  position: { x: number; y: number };
  size: { width: number; depth: number };
  exteriorStyle: BuildingExteriorStyle;
  interiorRoomId?: string; // Links to existing room for interior view
  isUnlocked: boolean;
  unlockCost?: number;
  level?: number;
  // Custom style asset overrides
  customImageUrl?: string;
  customAssetId?: string;
  // Transform parameters for custom images
  transform?: CityTransformData;
}

// Visual styling for building exteriors
export interface BuildingExteriorStyle {
  roofColor: string;
  wallColor: string;
  accentColor: string;
  windowStyle: 'modern' | 'classic' | 'minimal';
  hasChimney?: boolean;
  hasBalcony?: boolean;
  stories?: number;
}

// Street segment in the city grid
export interface StreetSegment {
  id: string;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  type: 'road' | 'sidewalk' | 'crosswalk';
}

// City decorations (trees, benches, lamps, etc.)
export interface CityDecoration {
  id: string;
  type: 'tree' | 'bench' | 'lamp' | 'fountain' | 'sign' | 'vehicle' | 'flower' | 'bush' | 'mushroom' | 'birdhouse' | 'rock' | 'butterfly';
  position: { x: number; y: number };
  rotation?: number;
  variant?: string;
  // Custom style asset overrides
  customImageUrl?: string;
  customAssetId?: string;
  // Transform parameters for custom images
  transform?: CityTransformData;
}

// Complete city layout
export interface CityLayout {
  id: string;
  userId: string;
  buildings: Building[];
  streets: StreetSegment[];
  decorations: CityDecoration[];
  cityLevel: number;
  createdAt?: string;
  updatedAt?: string;
}

// City level progression
export interface CityLevel {
  level: number;
  name: string;
  maxBuildings: number;
  cityGridSize: number;
  unlockCost: number;
  features: string[];
}

// Building catalog item for shop
export interface BuildingCatalogItem {
  id: string;
  name: string;
  type: BuildingType;
  cost: number;
  description: string;
  size: { width: number; depth: number };
  defaultStyle: BuildingExteriorStyle;
  requiredCityLevel: number;
}

// City view state
export interface CityViewState {
  selectedBuildingId: string | null;
  hoveredBuildingId: string | null;
  isPlacingBuilding: boolean;
  placingBuildingType: BuildingType | null;
  cameraOffset: { x: number; y: number };
  zoom: number;
}

// City style asset type
export type CityAssetType = 'building' | 'decoration' | 'ground' | 'road' | 'map_element';

// City style asset (uploaded by admin)
export interface CityStyleAsset {
  id: string;
  asset_type: CityAssetType;
  name: string;
  image_url: string;
  thumbnail_url?: string | null;
  config?: {
    width?: number;
    height?: number;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    anchorMultiplier?: number;
    scaleX?: number;
    scaleY?: number;
    skewX?: number;
    skewY?: number;
  };
  is_default: boolean;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
}
