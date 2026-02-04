import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { RegionData, RegionViewState, PublicFacility, FacilityType } from '@/types/region';
import { REGION_CONFIG, REGION_THEME_COLORS } from '@/constants/regionConfig';
import { CityPlot } from './CityPlot';
import { PublicFacilityMarker } from './PublicFacilityMarker';
import { RegionHUD } from './RegionHUD';
import { FacilityModal } from './FacilityModal';
import { FacilityBuilderModal } from './FacilityBuilderModal';
import { useRegion } from '@/hooks/useRegion';

interface RegionMapProps {
  region: RegionData;
  onNavigateToCity: (ownerId: string) => void;
  onNavigateHome: () => void;
}

export function RegionMap({ region: initialRegion, onNavigateToCity, onNavigateHome }: RegionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Use the hook to get actions, but rely on props for data to avoid double fetch if possible
  const { claimPlot, visitFacility, createPublicFacility } = useRegion(initialRegion.id);

  // We'll use local state for immediate UI feedback, but ideally sync with server
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
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // TODO: Get actual admin status
  const isAdmin = true;

  const themeColors = REGION_THEME_COLORS[initialRegion.theme];
  const { tileWidth, tileHeight, minZoom, maxZoom } = REGION_CONFIG;

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setViewState(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.2, maxZoom) }));
  }, [maxZoom]);

  const handleZoomOut = useCallback(() => {
    setViewState(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.2, minZoom) }));
  }, [minZoom]);

  const handleResetView = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      cameraOffset: { x: 0, y: 0 },
      zoom: REGION_CONFIG.defaultZoom,
    }));
  }, []);

  // Handle wheel zoom with non-passive listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setViewState(prev => ({
        ...prev,
        zoom: Math.min(Math.max(prev.zoom + delta, minZoom), maxZoom),
      }));
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
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
    const plot = initialRegion.plots.find(p => p.id === plotId);
    if (plot?.plotType === 'city' && plot.ownerId) {
      onNavigateToCity(plot.ownerId);
    }
    setViewState(prev => ({
      ...prev,
      selectedPlotId: plotId,
      selectedFacilityId: null,
    }));
  }, [initialRegion.plots, onNavigateToCity]);

  const handleHoverPlot = useCallback((plotId: string | null) => {
    setViewState(prev => ({
      ...prev,
      hoveredPlotId: plotId,
    }));
  }, []);

  // Handle facility selection
  const handleSelectFacility = useCallback((facilityId: string) => {
    const facility = initialRegion.facilities.find(f => f.id === facilityId);
    if (facility) {
      setSelectedFacility(facility);
    }
    setViewState(prev => ({
      ...prev,
      selectedFacilityId: facilityId,
      selectedPlotId: null,
    }));
  }, [initialRegion.facilities]);

  const handleHoverFacility = useCallback((facilityId: string | null) => {
    setViewState(prev => ({
      ...prev,
      hoveredPlotId: null,
    }));
  }, []);

  const handleCloseFacilityModal = useCallback(() => {
    setSelectedFacility(null);
    setViewState(prev => ({ ...prev, selectedFacilityId: null }));
  }, []);

  // Action Handlers
  const handleClaimPlot = async () => {
    if (!viewState.selectedPlotId) return;
    if (isClaiming) return;

    try {
      setIsClaiming(true);
      const success = await claimPlot(viewState.selectedPlotId, '我的新城市');
      if (success) {
        alert('成功建立城市！');
        setViewState(prev => ({ ...prev, selectedPlotId: null }));
      } else {
        alert('建立城市失敗，請稍後再試');
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const handleVisitFacility = async () => {
    if (!selectedFacility) return;

    const result = await visitFacility(selectedFacility.id);
    if (result.success) {
      alert(result.message);
    } else {
      alert(result.message);
    }
    handleCloseFacilityModal();
  };

  const handleBuildFacility = async (type: FacilityType, name: string) => {
    const position = { x: Math.floor(Math.random() * 5) + 2, y: Math.floor(Math.random() * 5) + 2 };

    const success = await createPublicFacility(type, name, position);
    if (success) {
      alert(`成功建設 ${name}`);
      setShowBuilderModal(false);
    }
  };

  // Create ground grid pattern
  const renderGroundGrid = () => {
    const gridLines = [];
    const gridSize = initialRegion.gridSize;

    for (let i = 0; i <= gridSize; i++) {
      const hx1 = (0 - i) * (tileWidth / 2);
      const hy1 = (0 + i) * (tileHeight / 2);
      const hx2 = (gridSize - i) * (tileWidth / 2);
      const hy2 = (gridSize + i) * (tileHeight / 2);

      const vx1 = (i - 0) * (tileWidth / 2);
      const vy1 = (i + 0) * (tileHeight / 2);
      const vx2 = (i - gridSize) * (tileWidth / 2);
      const vy2 = (i + gridSize) * (tileHeight / 2);

      gridLines.push(
        <line key={`h-${i}`} x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke={themeColors.road} strokeWidth={0.5} opacity={0.3} />,
        <line key={`v-${i}`} x1={vx1} y1={vy1} x2={vx2} y2={vy2} stroke={themeColors.road} strokeWidth={0.5} opacity={0.3} />
      );
    }
    return gridLines;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden bg-region-ground"
      style={{
        backgroundColor: themeColors?.ground || '#FDF6E3',
        transition: 'background-color 0.5s ease'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* SVG Map */}
      <svg
        width="100%"
        height="100%"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${(containerRef.current?.clientWidth ?? 1000) / 2 + viewState.cameraOffset.x}, ${(containerRef.current?.clientHeight ?? 800) / 2 + viewState.cameraOffset.y}) scale(${viewState.zoom})`}>
          {/* Ground grid */}
          <g>{renderGroundGrid()}</g>

          {/* City plots */}
          <g>
            {initialRegion.plots.map(plot => (
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
            {initialRegion.facilities.map(facility => (
              <PublicFacilityMarker
                key={facility.id}
                facility={facility}
                isSelected={viewState.selectedFacilityId === facility.id}
                isHovered={false}
                onSelect={handleSelectFacility}
                onHover={(fid) => handleHoverFacility(fid)}
              />
            ))}
          </g>
        </g>
      </svg>

      {/* HUD Overlay */}
      <RegionHUD
        region={initialRegion}
        viewState={viewState}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onNavigateHome={onNavigateHome}
        onClaimPlot={handleClaimPlot}
        onOpenBuilder={() => setShowBuilderModal(true)}
        isAdmin={isAdmin}
      />

      {/* Facility Visit Modal */}
      {selectedFacility && (
        <FacilityModal
          facility={selectedFacility}
          onClose={handleCloseFacilityModal}
          onVisit={handleVisitFacility}
        />
      )}

      {/* Facility Builder Modal */}
      {showBuilderModal && (
        <FacilityBuilderModal
          onClose={() => setShowBuilderModal(false)}
          onBuild={handleBuildFacility}
        />
      )}
    </div>
  );
}
