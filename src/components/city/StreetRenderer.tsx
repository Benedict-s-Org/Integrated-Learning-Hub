import React from "react";
import { CARTOON_PALETTE } from "@/constants/cityStyleGuide";

interface StreetRendererProps {
  gridSize: number;
  toIso: (x: number, y: number) => { x: number; y: number };
}

export function StreetRenderer({ gridSize, toIso }: StreetRendererProps) {
  // Generate street tiles around the edge of the map
  const streetTiles: { x: number; y: number; type: "road" | "sidewalk" }[] = [];
  
  // Create a road around the perimeter
  for (let i = 0; i < gridSize; i++) {
    // Top edge
    streetTiles.push({ x: i, y: 0, type: "road" });
    streetTiles.push({ x: i, y: 1, type: "sidewalk" });
    
    // Bottom edge
    streetTiles.push({ x: i, y: gridSize - 1, type: "road" });
    streetTiles.push({ x: i, y: gridSize - 2, type: "sidewalk" });
    
    // Left edge
    streetTiles.push({ x: 0, y: i, type: "road" });
    streetTiles.push({ x: 1, y: i, type: "sidewalk" });
    
    // Right edge
    streetTiles.push({ x: gridSize - 1, y: i, type: "road" });
    streetTiles.push({ x: gridSize - 2, y: i, type: "sidewalk" });
  }

  // Create a cross road through the middle
  const mid = Math.floor(gridSize / 2);
  for (let i = 2; i < gridSize - 2; i++) {
    streetTiles.push({ x: mid, y: i, type: "road" });
    streetTiles.push({ x: mid - 1, y: i, type: "sidewalk" });
    streetTiles.push({ x: mid + 1, y: i, type: "sidewalk" });
    
    streetTiles.push({ x: i, y: mid, type: "road" });
    streetTiles.push({ x: i, y: mid - 1, type: "sidewalk" });
    streetTiles.push({ x: i, y: mid + 1, type: "sidewalk" });
  }

  const renderStreetTile = (tile: { x: number; y: number; type: "road" | "sidewalk" }, index: number) => {
    const p1 = toIso(tile.x, tile.y);
    const p2 = toIso(tile.x + 1, tile.y);
    const p3 = toIso(tile.x + 1, tile.y + 1);
    const p4 = toIso(tile.x, tile.y + 1);
    
    // Warm cartoon-style colors for roads and sidewalks
    const fillColor = tile.type === "road" 
      ? CARTOON_PALETTE.ground.path  // Warm sand/cream path
      : CARTOON_PALETTE.ground.pathLight;  // Lighter sidewalk
    
    const strokeColor = tile.type === "road"
      ? CARTOON_PALETTE.ground.pathDark
      : CARTOON_PALETTE.ground.path;

    return (
      <polygon
        key={`street-${index}`}
        points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={0.5}
        rx={2}
      />
    );
  };

  // Road markings - cute dotted lines
  const renderRoadMarkings = () => {
    const markings: React.ReactNode[] = [];
    
    // Horizontal road marking - cute cream dots
    for (let i = 2; i < gridSize - 2; i += 2) {
      const center = toIso(i + 0.5, mid + 0.5);
      markings.push(
        <circle
          key={`h-mark-${i}`}
          cx={center.x}
          cy={center.y}
          r={3}
          fill={CARTOON_PALETTE.ground.pathLight}
          opacity={0.8}
        />
      );
    }
    
    // Vertical road marking - cute cream dots
    for (let i = 2; i < gridSize - 2; i += 2) {
      const center = toIso(mid + 0.5, i + 0.5);
      markings.push(
        <circle
          key={`v-mark-${i}`}
          cx={center.x}
          cy={center.y}
          r={3}
          fill={CARTOON_PALETTE.ground.pathLight}
          opacity={0.8}
        />
      );
    }
    
    return markings;
  };

  // Add cute cobblestone details
  const renderCobblestones = () => {
    const stones: React.ReactNode[] = [];
    
    // Add scattered small decorative circles on sidewalks
    for (let i = 0; i < 20; i++) {
      const x = 1 + Math.random() * (gridSize - 2);
      const y = 1 + Math.random() * (gridSize - 2);
      const pos = toIso(x, y);
      stones.push(
        <circle
          key={`stone-${i}`}
          cx={pos.x}
          cy={pos.y}
          r={1.5 + Math.random() * 1.5}
          fill={CARTOON_PALETTE.ground.pathDark}
          opacity={0.15}
        />
      );
    }
    
    return stones;
  };

  return (
    <g className="street-layer">
      {streetTiles.map(renderStreetTile)}
      {renderCobblestones()}
      {renderRoadMarkings()}
    </g>
  );
}
