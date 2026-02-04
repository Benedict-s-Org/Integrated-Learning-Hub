import { LucideIcon } from "lucide-react";

export interface FurnitureCategory {
  id: string;
  label: string;
}

// Basic furniture item from the catalog
export interface FurnitureItem {
  id: string;
  name: string;
  icon: string | LucideIcon | null;
  // cost: number; // Inconsistency: catalog uses price, type uses cost. Unified to price/cost?
  // Let's support both or pick one. The constants used `price`. The type used `cost`.
  // I will add price to type as optional or alias.
  cost?: number;
  price?: number;
  desc?: string;
  category?: string;
  type?: string;
  size: [number, number];
  height?: number;
  color?: string;
  isSpecial?: boolean;
  navigateTo?: string;
  action?: string;
  modelUrl?: string; // Added from constant usage
  canSit?: boolean; // Added from constant usage
  surfaceHeight?: number; // Added from constant usage
}

// Color variant definition
export interface FurnitureColorVariant {
  id: string;
  name: string;
  color: string; // Hex code for UI
  images: (string | null)[];
}

// Custom furniture with sprite support
export interface CustomFurniture extends FurnitureItem {
  spriteImages?: (string | null)[];
  conditionImages?: string[];
  spriteOffsetX?: number;
  spriteOffsetY?: number;
  spriteScale?: number;
  spriteScaleX?: number;
  spriteScaleY?: number;
  spriteSkewX?: number;
  spriteSkewY?: number;
  spriteFilter?: string;
  colorVariants?: FurnitureColorVariant[];
}

// Placement of furniture on the floor
export interface Placement {
  id: string;
  furnitureId: string;
  x: number;
  y: number;
  rotation: number;
  variantId?: string;
}

// Placement of furniture on a wall
export interface WallPlacement {
  id: string;
  furnitureId: string;
  gridPos: number;
  z: number;
  surface: "left-wall" | "right-wall";
  rotation: number;
  variantId?: string;
}

// 3D box primitive for geometric furniture models
export interface FurnitureBoxPrimitive {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
}

// Model definition for geometric furniture
export type FurnitureModels = Record<string, FurnitureBoxPrimitive[]>;
