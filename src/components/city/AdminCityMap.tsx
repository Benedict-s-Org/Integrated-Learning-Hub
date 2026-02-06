import React, { useState, useCallback, useMemo, useRef } from "react";
import { useDefaultAssets } from "@/hooks/useDefaultAssets";
import { Coins, Move } from "lucide-react";
import type { Building, CityDecoration, CityViewState } from "@/types/city";
import { BuildingExterior } from "./BuildingExterior";
import { CityDecorations } from "./CityDecorations";
import { StreetRenderer } from "./StreetRenderer";
import { CITY_LEVELS, INITIAL_CITY_LAYOUT } from "@/constants/cityLevels";
import { CARTOON_PALETTE } from "@/constants/cityStyleGuide";

interface AdminCityMapProps {
  buildings?: Building[];
  decorations?: CityDecoration[];
  cityLevel?: number;
  coins?: number;
  selectedBuildingId?: string | null;
  selectedDecorationId?: string | null;
  onBuildingClick?: (building: Building) => void;
  onDecorationClick?: (decoration: CityDecoration) => void;
  onDecorationDrag?: (id: string, newPosition: { x: number; y: number }) => void;
  onBuildingDrag?: (id: string, newPosition: { x: number; y: number }) => void;
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

export function AdminCityMap({
  buildings = INITIAL_CITY_LAYOUT.buildings,
  decorations = INITIAL_CITY_LAYOUT.decorations,
  cityLevel = 0,
  coins = 0,
  selectedBuildingId,
  selectedDecorationId,
  onBuildingClick,
  onDecorationClick,
  onDecorationDrag,
  onBuildingDrag,
}: AdminCityMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { defaultTerrain } = useDefaultAssets();

  const [viewState, setViewState] = useState<CityViewState>({
    selectedBuildingId: null,
    hoveredBuildingId: null,
    isPlacingBuilding: false,
    placingBuildingType: null,
    cameraOffset: { x: 0, y: 0 },
    zoom: 1,
  });

  // Drag state
  const [draggingDecoration, setDraggingDecoration] = useState<string | null>(null);
  const [draggingBuilding, setDraggingBuilding] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  // Convert screen coordinates back to grid coordinates
  const fromIso = useCallback((screenX: number, screenY: number) => {
    const relX = screenX - centerX;
    const relY = screenY - centerY;

    const gridX = (relX / (tileWidth / 2) + relY / (tileHeight / 2)) / 2;
    const gridY = (relY / (tileHeight / 2) - relX / (tileWidth / 2)) / 2;

    return {
      x: Math.round(gridX),
      y: Math.round(gridY),
    };
  }, [centerX, centerY, tileWidth, tileHeight]);

  // Get SVG coordinates from mouse event
  const getSVGCoords = useCallback((e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

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
            fill={defaultTerrain ? "url(#admin-grass-pattern)" : fillColor}
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
    if (onBuildingClick) {
      onBuildingClick(building);
    }
  }, [onBuildingClick]);

  // Handle decoration click
  const handleDecorationClick = useCallback((decoration: CityDecoration, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDecorationClick) {
      onDecorationClick(decoration);
    }
  }, [onDecorationClick]);

  // Handle decoration drag start
  const handleDecorationDragStart = useCallback((decoration: CityDecoration, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDecorationDrag) return;

    setDraggingDecoration(decoration.id);
    const svgCoords = getSVGCoords(e);
    const isoPos = toIso(decoration.position.x, decoration.position.y);
    setDragOffset({
      x: svgCoords.x - isoPos.x,
      y: svgCoords.y - isoPos.y,
    });
  }, [onDecorationDrag, getSVGCoords, toIso]);

  // Handle building drag start
  const handleBuildingDragStart = useCallback((building: Building, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onBuildingDrag) return;

    setDraggingBuilding(building.id);
    const svgCoords = getSVGCoords(e);
    const isoPos = toIso(building.position.x + building.size.width / 2, building.position.y + building.size.depth / 2);
    setDragOffset({
      x: svgCoords.x - isoPos.x,
      y: svgCoords.y - isoPos.y,
    });
  }, [onBuildingDrag, getSVGCoords, toIso]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingDecoration && !draggingBuilding) return;

    const svgCoords = getSVGCoords(e);
    const adjustedCoords = {
      x: svgCoords.x - dragOffset.x,
      y: svgCoords.y - dragOffset.y,
    };
    const gridPos = fromIso(adjustedCoords.x, adjustedCoords.y);

    // Clamp to grid bounds
    const clampedPos = {
      x: Math.max(0, Math.min(gridSize - 1, gridPos.x)),
      y: Math.max(0, Math.min(gridSize - 1, gridPos.y)),
    };

    if (draggingDecoration && onDecorationDrag) {
      onDecorationDrag(draggingDecoration, clampedPos);
    }

    if (draggingBuilding && onBuildingDrag) {
      onBuildingDrag(draggingBuilding, clampedPos);
    }
  }, [draggingDecoration, draggingBuilding, getSVGCoords, dragOffset, fromIso, gridSize, onDecorationDrag, onBuildingDrag]);

  // Handle mouse up to end dragging
  const handleMouseUp = useCallback(() => {
    setDraggingDecoration(null);
    setDraggingBuilding(null);
  }, []);

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

      {/* Drag mode indicator */}
      {(draggingDecoration || draggingBuilding) && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg animate-pulse">
          <Move size={16} />
          <span className="text-sm font-medium">拖動中...</span>
        </div>
      )}

      {/* Zoom controls - cute rounded style */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
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
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: `scale(${viewState.zoom})`, transformOrigin: "center", cursor: draggingDecoration || draggingBuilding ? 'grabbing' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Patterns and Definitions */}
        <defs>
          {defaultTerrain && (
            <pattern
              id="admin-grass-pattern"
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

        {/* Decorations layer with drag support */}
        <g className="decorations-layer">
          {sortedDecorations.map((decoration) => {
            const pos = toIso(decoration.position.x, decoration.position.y);
            const isSelected = selectedDecorationId === decoration.id;
            const isDragging = draggingDecoration === decoration.id;

            return (
              <g
                key={decoration.id}
                style={{ cursor: onDecorationDrag ? 'grab' : 'pointer' }}
                onMouseDown={(e) => handleDecorationDragStart(decoration, e)}
                onClick={(e) => handleDecorationClick(decoration, e)}
              >
                {/* Selection/drag highlight */}
                {(isSelected || isDragging) && (
                  <circle
                    cx={pos.x}
                    cy={pos.y + 10}
                    r={25}
                    fill="none"
                    stroke={isDragging ? "#10b981" : "#3b82f6"}
                    strokeWidth={2}
                    strokeDasharray={isDragging ? "none" : "4 2"}
                    className={isDragging ? "" : "animate-pulse"}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Actual decoration visuals */}
        <CityDecorations decorations={sortedDecorations} toIso={toIso} />

        {/* Buildings layer with drag support */}
        <g className="buildings-layer">
          {sortedBuildings.map((building) => {
            const isoPos = toIso(
              building.position.x + building.size.width / 2,
              building.position.y + building.size.depth / 2
            );
            const isSelected = selectedBuildingId === building.id;
            const isDragging = draggingBuilding === building.id;

            return (
              <g
                key={building.id}
                style={{ cursor: onBuildingDrag ? 'grab' : 'pointer' }}
                onMouseDown={(e) => handleBuildingDragStart(building, e)}
              >
                {/* Selection/drag highlight for buildings */}
                {(isSelected || isDragging) && (
                  <ellipse
                    cx={isoPos.x}
                    cy={isoPos.y + 20}
                    rx={building.size.width * tileWidth / 2}
                    ry={building.size.depth * tileHeight / 2}
                    fill="none"
                    stroke={isDragging ? "#10b981" : "#3b82f6"}
                    strokeWidth={3}
                    strokeDasharray={isDragging ? "none" : "6 3"}
                    className={isDragging ? "" : "animate-pulse"}
                  />
                )}
                <BuildingExterior
                  building={building}
                  isoX={isoPos.x}
                  isoY={isoPos.y}
                  tileWidth={tileWidth}
                  tileHeight={tileHeight}
                  isHovered={viewState.hoveredBuildingId === building.id}
                  isSelected={isSelected}
                  onClick={() => handleBuildingClick(building)}
                  onMouseEnter={() => setViewState(s => ({ ...s, hoveredBuildingId: building.id }))}
                  onMouseLeave={() => setViewState(s => ({ ...s, hoveredBuildingId: null }))}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 z-10 px-4 py-2 bg-slate-900/80 text-white text-sm rounded-lg backdrop-blur-sm">
        💡 點擊選擇，拖動可移動位置
      </div>
    </div>
  );
}
