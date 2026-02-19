// Custom wall texture
export interface CustomWall {
  id: string;
  name: string;
  price?: number;
  lightImage?: string;
  darkImage?: string;
  lightSide?: string;
  darkSide?: string;
  color?: string;
  colorVariants?: {
    id: string;
    name: string;
    color: string;
    lightImage: string;
    darkImage: string;
  }[];
}

// Custom floor texture
export interface CustomFloor {
  id: string;
  name: string;
  price?: number;
  image?: string;
  color?: string;
  colorVariants?: {
    id: string;
    name: string;
    color: string;
    image: string;
  }[];
}

// House level configuration
export interface HouseLevel {
  level: number;
  name: string;
  cost: number;
  capacity: number;
  size: number;
}

// Isometric coordinate point
export interface IsoPoint {
  x: number;
  y: number;
}

// Tile hover state
export interface HoveredTile {
  x: number;
  y: number;
}

// Wall tile hover state
export interface HoveredWallTile {
  gridPos: number;
  z: number;
  surface: "left-wall" | "right-wall";
}

// Render object for depth sorting
export interface RenderObject {
  depth: number;
  type: string;
  render: React.ReactNode;
}
