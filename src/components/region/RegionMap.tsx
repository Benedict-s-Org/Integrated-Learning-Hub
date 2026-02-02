import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { RegionData, RegionViewState, PublicFacility } from '@/types/region';
import { REGION_CONFIG, REGION_THEME_COLORS } from '@/constants/regionConfig';
import { CityPlot } from './CityPlot';
import { PublicFacilityMarker } from './PublicFacilityMarker';
import { RegionHUD } from './RegionHUD';
import { FacilityModal } from './FacilityModal';

interface RegionMapProps {
  region: RegionData;
  onNavigateToCity: (ownerId: string) => void;
  onNavigateHome: () => void;
}

export function RegionMap({ region, onNavigateToCity, onNavigateHome }: RegionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState<RegionViewState>({
    selectedPlotId: null,
    hoveredPlotId: null,
    selectedFacilityId: null,
    cameraOffset: { x: 0, y: 0 },
    zoom: REGION_CONFIG.defaultZoom,
    showFacilityModal: null,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedFacility, setSelectedFacility] = useState<PublicFacility | null>(null);

  const themeColors = REGION_THEME_COLORS[region.theme];
  const { tileWidth, tileHeight, minZoom, maxZoom } = REGION_CONFIG;

  // Calculate map dimensions
  const mapWidth = region.gridSize * tileWidth * 2;
  const mapHeight = region.gridSize * tileHeight * 2;

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom + 0.2, maxZoom),
    }));
  }, [maxZoom]);

  const handleZoomOut = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom - 0.2, minZoom),
    }));
  }, [minZoom]);

  const handleResetView = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      cameraOffset: { x: 0, y: 0 },
      zoom: REGION_CONFIG.defaultZoom,
    }));
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setViewState(prev => ({
      ...prev,
      zoom: Math.min(Math.max(prev.zoom + delta, minZoom), maxZoom),
    }));
  }, [minZoom, maxZoom]);

  // Handle pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewState.cameraOffset.x, y: e.clientY - viewState.cameraOffset.y });
    }
  }, [viewState.cameraOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setViewState(prev => ({
        ...prev,
        cameraOffset: {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        },
      }));
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle plot selection
  const handleSelectPlot = useCallback((plotId: string) => {
    const plot = region.plots.find(p => p.id === plotId);
    if (plot?.plotType === 'city' && plot.ownerId) {
      onNavigateToCity(plot.ownerId);
    }
    setViewState(prev => ({
      ...prev,
      selectedPlotId: plotId,
      selectedFacilityId: null,
    }));
  }, [region.plots, onNavigateToCity]);

  const handleHoverPlot = useCallback((plotId: string | null) => {
    setViewState(prev => ({
      ...prev,
      hoveredPlotId: plotId,
    }));
  }, []);

  // Handle facility selection
  const handleSelectFacility = useCallback((facilityId: string) => {
    const facility = region.facilities.find(f => f.id === facilityId);
    if (facility) {
      setSelectedFacility(facility);
    }
    setViewState(prev => ({
      ...prev,
      selectedFacilityId: facilityId,
      selectedPlotId: null,
    }));
  }, [region.facilities]);

  const handleHoverFacility = useCallback((facilityId: string | null) => {
    setViewState(prev => ({
      ...prev,
      hoveredPlotId: null,
    }));
  }, []);

  const handleCloseFacilityModal = useCallback(() => {
    setSelectedFacility(null);
    setViewState(prev => ({
      ...prev,
      selectedFacilityId: null,
    }));
  }, []);

  const handleVisitFacility = useCallback(() => {
    // TODO: Implement facility visit logic
    console.log('Visiting facility:', selectedFacility?.id);
    handleCloseFacilityModal();
  }, [selectedFacility, handleCloseFacilityModal]);

  // Create ground grid pattern
  const renderGroundGrid = () => {
    const gridLines = [];
    const gridSize = region.gridSize;
    
    for (let i = 0; i <= gridSize; i++) {
      // Horizontal lines (in isometric space)
      const hx1 = (0 - i) * (tileWidth / 2);
      const hy1 = (0 + i) * (tileHeight / 2);
      const hx2 = (gridSize - i) * (tileWidth / 2);
      const hy2 = (gridSize + i) * (tileHeight / 2);
      
      // Vertical lines (in isometric space)
      const vx1 = (i - 0) * (tileWidth / 2);
      const vy1 = (i + 0) * (tileHeight / 2);
      const vx2 = (i - gridSize) * (tileWidth / 2);
      const vy2 = (i + gridSize) * (tileHeight / 2);

      gridLines.push(
        <line
          key={`h-${i}`}
          x1={hx1}
          y1={hy1}
          x2={hx2}
          y2={hy2}
          stroke={themeColors.road}
          strokeWidth={0.5}
          opacity={0.3}
        />,
        <line
          key={`v-${i}`}
          x1={vx1}
          y1={vy1}
          x2={vx2}
          y2={vy2}
          stroke={themeColors.road}
          strokeWidth={0.5}
          opacity={0.3}
        />
      );
    }
    return gridLines;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: themeColors.ground }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* SVG Map */}
      <svg
        width="100%"
        height="100%"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <g
          transform={`
            translate(${mapWidth / 2 + viewState.cameraOffset.x}, ${100 + viewState.cameraOffset.y})
            scale(${viewState.zoom})
          `}
        >
          {/* Ground grid */}
          <g>{renderGroundGrid()}</g>

          {/* City plots */}
          <g>
            {region.plots.map(plot => (
              <CityPlot
                key={plot.id}
                plot={plot}
                isSelected={viewState.selectedPlotId === plot.id}
                isHovered={viewState.hoveredPlotId === plot.id}
                onSelect={handleSelectPlot}
                onHover={handleHoverPlot}
              />
            ))}
          </g>

          {/* Public facilities */}
          <g>
            {region.facilities.map(facility => (
              <PublicFacilityMarker
                key={facility.id}
                facility={facility}
                isSelected={viewState.selectedFacilityId === facility.id}
                isHovered={false}
                onSelect={handleSelectFacility}
                onHover={handleHoverFacility}
              />
            ))}
          </g>
        </g>
      </svg>

      {/* HUD Overlay */}
      <RegionHUD
        region={region}
        viewState={viewState}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onNavigateHome={onNavigateHome}
      />

      {/* Facility Modal */}
      {selectedFacility && (
        <FacilityModal
          facility={selectedFacility}
          onClose={handleCloseFacilityModal}
          onVisit={handleVisitFacility}
        />
      )}
    </div>
  );
}
