import { LucideIcon } from "lucide-react";

// Empty location placeholder
export interface EmptyLocation {
  name: string;
  desc: string;
  icon?: LucideIcon;
}

// Locus item (memory palace location)
export interface Locus {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  isFurniture: boolean;
  furnitureId?: string;
  placementId?: string;
  spriteImages?: (string | null)[];
  spriteFilter?: string;
}

// History snapshot for undo/redo
export interface HistorySnapshot {
  id: number;
  name: string;
  timestamp: string;
  data: unknown[];
}

// Study word item
export interface StudyWord {
  word: string;
  index: number;
}

// Grid mode for overlay
export type GridMode = "floor" | "full";
