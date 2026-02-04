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
  onClaimPlot?: () => void;
  onOpenBuilder?: () => void;
  isAdmin?: boolean;
}

export function RegionHUD({
  region,
  viewState,
  onZoomIn,
  onZoomOut,
  onResetView,
  onNavigateHome,
  onClaimPlot,
  onOpenBuilder,
  isAdmin = false,
}: RegionHUDProps) {
  const occupiedPlots = region.plots.filter(p => p.plotType === 'city').length;
  const totalFacilities = region.facilities.length;

  const selectedPlot = viewState.selectedPlotId
    ? region.plots.find(p => p.id === viewState.selectedPlotId)
    : null;

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

      {/* Bottom Center - Action Buttons */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-none">
        {selectedPlot?.plotType === 'empty' && onClaimPlot && (
          <button
            onClick={onClaimPlot}
            className="pointer-events-auto bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4"
          >
            <Home className="w-5 h-5" />
            建立我的城市
          </button>
        )}

        {isAdmin && onOpenBuilder && (
          <button
            onClick={onOpenBuilder}
            className="pointer-events-auto bg-secondary text-secondary-foreground px-6 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2"
          >
            <Users className="w-5 h-5" />
            建設公共設施 (Admin)
          </button>
        )}
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
