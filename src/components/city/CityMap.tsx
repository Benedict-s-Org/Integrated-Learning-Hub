import React, { useState, useCallback, useMemo } from "react";
import { useDefaultAssets } from "@/hooks/useDefaultAssets";
import { useNavigate } from "react-router-dom";
import { Coins } from "lucide-react";
import type { Building, CityDecoration, CityViewState } from "@/types/city";
import { BuildingExterior } from "./BuildingExterior";
import { CityDecorations } from "./CityDecorations";
import { StreetRenderer } from "./StreetRenderer";
import { CITY_LEVELS, INITIAL_CITY_LAYOUT } from "@/constants/cityLevels";
import { CARTOON_PALETTE } from "@/constants/cityStyleGuide";

interface CityMapProps {
  buildings?: Building[];
  decorations?: CityDecoration[];
  cityLevel?: number;
  coins?: number;
  onBuildingClick?: (building: Building) => void;
  onOpenShop?: () => void;
  onBackToRoom?: () => void;
}

// Fluffy cloud component
function FluffyCloud({ x, y, scale = 1, delay = 0 }: { x: number; y: number; scale?: number; delay?: number }) {
  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      className="animate-float-slow"
      style={{ animationDelay: `${delay}s` }}
    >
      <ellipse cx={0} cy={0} rx={45} ry={22} fill={CARTOON_PALETTE.clouds.main} />
      <ellipse cx={-30} cy={5} rx={30} ry={18} fill={CARTOON_PALETTE.clouds.shadow} />
      <ellipse cx={35} cy={8} rx={35} ry={20} fill={CARTOON_PALETTE.clouds.shadow} />
      <ellipse cx={-15} cy={-8} rx={25} ry={16} fill={CARTOON_PALETTE.clouds.highlight} />
      <ellipse cx={20} cy={-5} rx={28} ry={18} fill={CARTOON_PALETTE.clouds.highlight} />
    </g>
  );
}

export function CityMap({
  buildings = INITIAL_CITY_LAYOUT.buildings,
  decorations = INITIAL_CITY_LAYOUT.decorations,
  cityLevel = 0,
  coins = 0,
  onBuildingClick,
  onOpenShop,
  onBackToRoom,
}: CityMapProps) {
  const navigate = useNavigate();
  const { defaultTerrain } = useDefaultAssets();

  const [viewState, setViewState] = useState<CityViewState>({
    selectedBuildingId: null,
    hoveredBuildingId: null,
    isPlacingBuilding: false,
    placingBuildingType: null,
    cameraOffset: { x: 0, y: 0 },
    zoom: 1,
  });

  // Get grid size based on city level
  const currentLevel = CITY_LEVELS[cityLevel] || CITY_LEVELS[0];
  const gridSize = currentLevel.cityGridSize;

  // Tile dimensions for isometric view (2:1 ratio for 30° isometric)
  const tileWidth = 40;
  const tileHeight = 20;

  // Calculate center offset for SVG
  const svgWidth = 800;
  const svgHeight = 600;
  const centerX = svgWidth / 2 + viewState.cameraOffset.x;
  const centerY = 100 + viewState.cameraOffset.y;

  // Convert grid coordinates to isometric screen coordinates
  const toIso = useCallback((x: number, y: number) => {
    return {
      x: centerX + (x - y) * (tileWidth / 2),
      y: centerY + (x + y) * (tileHeight / 2),
    };
  }, [centerX, centerY, tileWidth, tileHeight]);

  // Generate ground tiles with cute cartoon colors
  const groundTiles = useMemo(() => {
    const tiles: React.ReactNode[] = [];

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const p1 = toIso(x, y);
        const p2 = toIso(x + 1, y);
        const p3 = toIso(x + 1, y + 1);
        const p4 = toIso(x, y + 1);

        // Alternate grass shades for visual interest
        const isLightTile = (x + y) % 2 === 0;
        const fillColor = isLightTile
          ? CARTOON_PALETTE.ground.grass
          : CARTOON_PALETTE.ground.grassLight;

        tiles.push(
          <polygon
            key={`ground-${x}-${y}`}
            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
            fill={defaultTerrain ? "url(#grass-pattern)" : fillColor}
            stroke={defaultTerrain ? "transparent" : CARTOON_PALETTE.ground.grassDark}
            strokeWidth={0.3}
          />
        );
      }
    }

    return tiles;
  }, [gridSize, toIso, defaultTerrain]);

  // Handle building click
  const handleBuildingClick = useCallback((building: Building) => {
    if (!building.isUnlocked) {
      // Show unlock dialog or toast
      console.log("Building locked:", building.name);
      return;
    }

    if (onBuildingClick) {
      onBuildingClick(building);
    } else {
      // Default: navigate to room interior
      navigate(`/room/${building.id}`);
    }
  }, [navigate, onBuildingClick]);

  // Ensure arrays are valid before sorting
  const buildingsArray = Array.isArray(buildings) ? buildings : INITIAL_CITY_LAYOUT.buildings;
  const decorationsArray = Array.isArray(decorations) ? decorations : INITIAL_CITY_LAYOUT.decorations;

  // Sort buildings by depth for proper rendering order
  const sortedBuildings = useMemo(() => {
    return [...buildingsArray].sort((a, b) => {
      const depthA = a.position.x + a.position.y;
      const depthB = b.position.x + b.position.y;
      return depthA - depthB;
    });
  }, [buildingsArray]);

  // Sort decorations by depth
  const sortedDecorations = useMemo(() => {
    return [...decorationsArray].sort((a, b) => {
      const depthA = a.position.x + a.position.y;
      const depthB = b.position.x + b.position.y;
      return depthA - depthB;
    });
  }, [decorationsArray]);

  return (
    <div className="w-full h-full overflow-hidden relative">
      {/* Warm cartoon sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, 
            ${CARTOON_PALETTE.sky.top} 0%, 
            ${CARTOON_PALETTE.sky.middle} 40%, 
            ${CARTOON_PALETTE.sky.bottom} 100%
          )`
        }}
      />

      {/* City Title */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-2xl font-bold text-foreground drop-shadow-lg">
          🏙️ {currentLevel.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          等級 {cityLevel} • {buildingsArray.length}/{currentLevel.maxBuildings} 建築
        </p>
      </div>

      {/* Coins display - cute style */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div
          className="flex items-center gap-2 px-5 py-2.5 rounded-full font-bold shadow-lg border-2"
          style={{
            background: 'linear-gradient(135deg, hsl(45, 90%, 85%) 0%, hsl(40, 85%, 75%) 100%)',
            borderColor: 'hsl(35, 80%, 65%)',
            color: 'hsl(30, 70%, 35%)',
          }}
        >
          <Coins size={20} />
          <span className="text-lg">{coins}</span>
        </div>
      </div>

      {/* Zoom controls - cute rounded style */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={() => setViewState(s => ({ ...s, zoom: Math.min(2, s.zoom + 0.1) }))}
          className="w-11 h-11 bg-white/90 border-2 border-[hsl(30,40%,80%)] rounded-xl flex items-center justify-center hover:bg-white hover:scale-105 transition-all shadow-md text-lg font-bold text-[hsl(30,50%,45%)]"
        >
          +
        </button>
        <button
          onClick={() => setViewState(s => ({ ...s, zoom: Math.max(0.5, s.zoom - 0.1) }))}
          className="w-11 h-11 bg-white/90 border-2 border-[hsl(30,40%,80%)] rounded-xl flex items-center justify-center hover:bg-white hover:scale-105 transition-all shadow-md text-lg font-bold text-[hsl(30,50%,45%)]"
        >
          −
        </button>
      </div>

      {/* Main SVG Canvas */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: `scale(${viewState.zoom})`, transformOrigin: "center" }}
      >
        {/* Patterns and Definitions */}
        <defs>
          {defaultTerrain && (
            <pattern
              id="grass-pattern"
              patternUnits="userSpaceOnUse"
              width={tileWidth}
              height={tileHeight}
              viewBox={`0 0 ${tileWidth} ${tileHeight}`}
            >
              <image
                href={defaultTerrain.image_url}
                width={tileWidth}
                height={tileHeight}
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          )}
        </defs>

        {/* Fluffy clouds layer */}
        <g className="clouds-layer">
          <FluffyCloud x={100} y={50} scale={0.8} delay={0} />
          <FluffyCloud x={650} y={35} scale={1} delay={2} />
          <FluffyCloud x={400} y={70} scale={0.6} delay={4} />
          <FluffyCloud x={750} y={80} scale={0.7} delay={1} />
        </g>

        {/* Ground layer */}
        <g className="ground-layer">
          {groundTiles}
        </g>

        {/* Streets layer */}
        <StreetRenderer gridSize={gridSize} toIso={toIso} />

        {/* Decorations layer (trees, lamps, etc.) - rendered before buildings for depth */}
        <CityDecorations decorations={sortedDecorations} toIso={toIso} />

        {/* Buildings layer */}
        <g className="buildings-layer">
          {sortedBuildings.map((building) => {
            const isoPos = toIso(
              building.position.x + building.size.width / 2,
              building.position.y + building.size.depth / 2
            );

            return (
              <BuildingExterior
                key={building.id}
                building={building}
                isoX={isoPos.x}
                isoY={isoPos.y}
                tileWidth={tileWidth}
                tileHeight={tileHeight}
                isHovered={viewState.hoveredBuildingId === building.id}
                isSelected={viewState.selectedBuildingId === building.id}
                onClick={() => handleBuildingClick(building)}
                onMouseEnter={() => setViewState(s => ({ ...s, hoveredBuildingId: building.id }))}
                onMouseLeave={() => setViewState(s => ({ ...s, hoveredBuildingId: null }))}
              />
            );
          })}
        </g>
      </svg>

      {/* Bottom HUD - cute rounded buttons */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-3">
        <button
          onClick={onBackToRoom || (() => navigate("/"))}
          className="px-5 py-2.5 bg-white/95 border-2 border-[hsl(30,40%,80%)] rounded-xl text-sm font-semibold hover:bg-white hover:scale-105 transition-all flex items-center gap-2 shadow-lg text-[hsl(30,50%,40%)]"
        >
          🏠 回到我的房間
        </button>
        <button
          onClick={onOpenShop}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold hover:scale-105 transition-all flex items-center gap-2 shadow-lg border-2"
          style={{
            background: 'linear-gradient(135deg, hsl(15, 70%, 65%) 0%, hsl(25, 75%, 60%) 100%)',
            borderColor: 'hsl(20, 65%, 50%)',
            color: 'white',
          }}
        >
          🏗️ 購買建築
        </button>
      </div>
    </div>
  );
}
