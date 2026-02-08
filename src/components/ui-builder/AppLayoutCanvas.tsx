import { useState, useCallback } from 'react';
import {
  PanelLeftClose,
  PanelLeft,
  Monitor,
  Smartphone,
  Tablet,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Lock,
  Home,
} from 'lucide-react';
import type { AppLayoutConfig, UIElement } from '@/types/ui-builder';
import { LayoutRegionRenderer } from './LayoutRegionRenderer';

interface AppLayoutCanvasProps {
  layout: AppLayoutConfig;
  selectedRegionId: string | null;
  selectedElementId: string | null;
  onSelectRegion: (regionId: string | null) => void;
  onSelectElement: (elementId: string | null, shiftKey?: boolean) => void;
  onUpdateRegion: (regionId: string, elements: UIElement[]) => void;
  onElementAction?: (element: UIElement, actionResult: string) => void;
}

type ViewMode = 'desktop' | 'tablet' | 'mobile';

export function AppLayoutCanvas({
  layout,
  selectedRegionId,
  selectedElementId,
  onSelectRegion,
  onSelectElement,
  onUpdateRegion,
  onElementAction,
}: AppLayoutCanvasProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [zoom, setZoom] = useState(100);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('menu');
  const [actionToast, setActionToast] = useState<string | null>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));
  const handleZoomReset = () => setZoom(100);

  const getCanvasWidth = () => {
    switch (viewMode) {
      case 'mobile': return 375;
      case 'tablet': return 768;
      default: return '100%';
    }
  };

  const handleCanvasClick = () => {
    onSelectRegion(null);
    onSelectElement(null);
  };

  // Handle double-click actions
  const handleElementDoubleClick = useCallback((element: UIElement) => {
    if (!element.action) return;

    const { type, target } = element.action;
    let resultMessage = '';

    switch (type) {
      case 'navigate-tab':
        setActiveTab(target || 'menu');
        resultMessage = `切換至「${target}」標籤`;
        break;
      case 'trigger-function':
        resultMessage = `觸發功能：${target}`;
        break;
      case 'link':
        resultMessage = `開啟連結：${target}`;
        break;
      case 'edit-text':
        resultMessage = '進入文字編輯模式';
        break;
      default:
        resultMessage = `執行動作：${type}`;
    }

    // Show toast notification
    setActionToast(resultMessage);
    setTimeout(() => setActionToast(null), 2000);

    // Notify parent
    onElementAction?.(element, resultMessage);
  }, [onElementAction]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[hsl(var(--muted)/0.2)]">
      {/* Canvas Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[hsl(var(--background))] border-b border-[hsl(var(--border))]">
        {/* Left: View Mode */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-[hsl(var(--muted-foreground))] mr-2">預覽:</span>
          {[
            { mode: 'desktop' as ViewMode, icon: Monitor, label: '桌面' },
            { mode: 'tablet' as ViewMode, icon: Tablet, label: '平板' },
            { mode: 'mobile' as ViewMode, icon: Smartphone, label: '手機' },
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-1.5 rounded transition-colors ${viewMode === mode
                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
                }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Center: Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
            disabled={zoom <= 50}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="w-12 text-center text-xs text-[hsl(var(--foreground))]">{zoom}%</span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
            disabled={zoom >= 150}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomReset}
            className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
            title="重設縮放"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Sidebar Toggle */}
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="p-1.5 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
          title={sidebarExpanded ? '收合側邊欄' : '展開側邊欄'}
        >
          {sidebarExpanded ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Canvas Area */}
      <div
        className="flex-1 overflow-auto p-6"
        onClick={handleCanvasClick}
      >
        <div
          className="mx-auto bg-[hsl(var(--background))] rounded-xl shadow-xl border border-[hsl(var(--border))] overflow-hidden transition-all duration-300"
          style={{
            width: getCanvasWidth(),
            maxWidth: viewMode === 'desktop' ? '1200px' : undefined,
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* Simulated App Layout */}
          <div className="flex h-[600px]">
            {/* Sidebar Simulation */}
            <div
              className={`
                flex flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]
                transition-all duration-300
                ${sidebarExpanded ? 'w-72' : 'w-16'}
                ${viewMode === 'mobile' && !sidebarExpanded ? 'hidden' : ''}
              `}
            >
              {/* Sidebar Header Region */}
              <div
                className={`p-3 border-b border-[hsl(var(--border))] ${selectedRegionId === 'sidebar-header' ? 'bg-[hsl(var(--primary)/0.1)]' : ''
                  }`}
                onClick={(e) => { e.stopPropagation(); onSelectRegion('sidebar-header'); }}
              >
                <LayoutRegionRenderer
                  region={layout.regions.sidebar.header}
                  isSelected={selectedRegionId === 'sidebar-header'}
                  selectedElementId={selectedElementId}
                  onSelectRegion={onSelectRegion}
                  onSelectElement={onSelectElement}
                  onUpdateElements={onUpdateRegion}
                  onElementDoubleClick={handleElementDoubleClick}
                  compact={!sidebarExpanded}
                />
              </div>

              {/* Sidebar Tabs Region - Highlight active tab */}
              <div
                className={`p-2 border-b border-[hsl(var(--border))] ${selectedRegionId === 'sidebar-tabs' ? 'bg-[hsl(var(--primary)/0.1)]' : ''
                  }`}
                onClick={(e) => { e.stopPropagation(); onSelectRegion('sidebar-tabs'); }}
              >
                <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-1 px-1">
                  當前: {activeTab}
                </div>
                <LayoutRegionRenderer
                  region={layout.regions.sidebar.tabs}
                  isSelected={selectedRegionId === 'sidebar-tabs'}
                  selectedElementId={selectedElementId}
                  onSelectRegion={onSelectRegion}
                  onSelectElement={onSelectElement}
                  onUpdateElements={onUpdateRegion}
                  onElementDoubleClick={handleElementDoubleClick}
                  compact={!sidebarExpanded}
                />
              </div>

              {/* Sidebar Content Region */}
              <div
                className={`flex-1 overflow-auto p-3 ${selectedRegionId === 'sidebar-content' ? 'bg-[hsl(var(--primary)/0.1)]' : ''
                  }`}
                onClick={(e) => { e.stopPropagation(); onSelectRegion('sidebar-content'); }}
              >
                {sidebarExpanded && (
                  <LayoutRegionRenderer
                    region={layout.regions.sidebar.content}
                    isSelected={selectedRegionId === 'sidebar-content'}
                    selectedElementId={selectedElementId}
                    onSelectRegion={onSelectRegion}
                    onElementDoubleClick={handleElementDoubleClick}
                    onSelectElement={onSelectElement}
                    onUpdateElements={onUpdateRegion}
                  />
                )}
              </div>

              {/* Sidebar Footer Region */}
              <div
                className={`p-3 border-t border-[hsl(var(--border))] ${selectedRegionId === 'sidebar-footer' ? 'bg-[hsl(var(--primary)/0.1)]' : ''
                  }`}
                onClick={(e) => { e.stopPropagation(); onSelectRegion('sidebar-footer'); }}
              >
                <LayoutRegionRenderer
                  region={layout.regions.sidebar.footer}
                  isSelected={selectedRegionId === 'sidebar-footer'}
                  selectedElementId={selectedElementId}
                  onSelectRegion={onSelectRegion}
                  onSelectElement={onSelectElement}
                  onUpdateElements={onUpdateRegion}
                  onElementDoubleClick={handleElementDoubleClick}
                  compact={!sidebarExpanded}
                />
              </div>
            </div>

            {/* Main Area Simulation */}
            <div className="flex-1 flex flex-col relative">
              {/* Main Header Region */}
              <div
                className={`p-4 border-b border-[hsl(var(--border))] ${selectedRegionId === 'main-header' ? 'bg-[hsl(var(--primary)/0.1)]' : ''
                  }`}
                onClick={(e) => { e.stopPropagation(); onSelectRegion('main-header'); }}
              >
                <LayoutRegionRenderer
                  region={layout.regions.main.header}
                  isSelected={selectedRegionId === 'main-header'}
                  selectedElementId={selectedElementId}
                  onSelectRegion={onSelectRegion}
                  onSelectElement={onSelectElement}
                  onUpdateElements={onUpdateRegion}
                  onElementDoubleClick={handleElementDoubleClick}
                />
              </div>

              {/* Main Content Region (Fixed/Read-only) */}
              <div
                className={`flex-1 relative ${selectedRegionId === 'main-content' ? 'ring-2 ring-[hsl(var(--muted-foreground))]' : ''
                  }`}
                onClick={(e) => { e.stopPropagation(); onSelectRegion('main-content'); }}
              >
                {/* Isometric Room Placeholder */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[hsl(var(--muted)/0.3)] to-[hsl(var(--muted)/0.1)]">
                  <div className="text-center">
                    <Home className="w-16 h-16 mx-auto mb-3 text-[hsl(var(--muted-foreground)/0.5)]" />
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">等距房間預覽區</p>
                    <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-[hsl(var(--muted-foreground)/0.7)]">
                      <Lock className="w-3 h-3" />
                      <span>固定內容 - 無法編輯</span>
                    </div>
                  </div>
                </div>

                {/* Floating Elements Overlay */}
                <div
                  className={`absolute inset-0 pointer-events-none ${selectedRegionId === 'main-floatingElements' ? 'bg-[hsl(var(--primary)/0.05)]' : ''
                    }`}
                >
                  <div
                    className="absolute top-4 right-4 pointer-events-auto"
                    onClick={(e) => { e.stopPropagation(); onSelectRegion('main-floatingElements'); }}
                  >
                    <LayoutRegionRenderer
                      region={layout.regions.main.floatingElements}
                      isSelected={selectedRegionId === 'main-floatingElements'}
                      selectedElementId={selectedElementId}
                      onSelectRegion={onSelectRegion}
                      onSelectElement={onSelectElement}
                      onUpdateElements={onUpdateRegion}
                      onElementDoubleClick={handleElementDoubleClick}
                      compact
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Toast Notification */}
        {actionToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 
                          bg-[hsl(var(--foreground))] text-[hsl(var(--background))] 
                          px-4 py-2 rounded-lg shadow-lg text-sm font-medium
                          animate-in fade-in slide-in-from-bottom-4 duration-300">
            {actionToast}
          </div>
        )}
      </div>
    </div>
  );
}

export default AppLayoutCanvas;