import React from 'react';
import { ZoomIn, ZoomOut, Home, Map, Users } from 'lucide-react';
import type { RegionData, RegionViewState } from '@/types/region';

interface RegionHUDProps {
  region: RegionData;
  viewState: RegionViewState;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onNavigateHome: () => void;
}

export function RegionHUD({
  region,
  viewState,
  onZoomIn,
  onZoomOut,
  onResetView,
  onNavigateHome,
}: RegionHUDProps) {
  const occupiedPlots = region.plots.filter(p => p.plotType === 'city').length;
  const totalFacilities = region.facilities.length;

  return (
    <>
      {/* Top bar - Region info */}
      <div className="absolute top-4 left-4 flex items-center gap-4">
        <div className="bg-card/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">{region.name}</span>
          </div>
        </div>

        <div className="bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Home className="w-4 h-4" />
              <span>{occupiedPlots} 城市</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{totalFacilities} 設施</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={onZoomIn}
          className="bg-card/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border hover:bg-accent transition-colors"
          title="放大"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={onZoomOut}
          className="bg-card/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border hover:bg-accent transition-colors"
          title="縮小"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={onResetView}
          className="bg-card/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border hover:bg-accent transition-colors"
          title="重置視圖"
        >
          <Map className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom left - Navigation */}
      <div className="absolute bottom-4 left-4">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>返回我的城市</span>
        </button>
      </div>

      {/* Bottom right - Zoom indicator */}
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-1 shadow-lg border text-sm text-muted-foreground">
        {Math.round(viewState.zoom * 100)}%
      </div>
    </>
  );
}
