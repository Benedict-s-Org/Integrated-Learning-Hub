import React, { useState } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { useMemoryPalaceContext } from "@/contexts/MemoryPalaceContext";
import { useInventory } from "@/hooks/useInventory";
import { useRoomInteraction } from "@/hooks/useRoomInteraction";
import { useMemoryPoints } from "@/hooks/useMemoryPoints";
import { useCityLayout } from "@/hooks/useCityLayout";
import { useRegion } from "@/hooks/useRegion";
import { SidebarFurniture, SidebarMemory } from "@/components/sidebar";
import { IsometricRoom } from "@/components/room/IsometricRoom";
import { CityMap } from "@/components/city/CityMap";
import { RegionMap } from "@/components/region/RegionMap";
import { DevPanel } from "@/components/DevPanel";
import { MemoryPointModal } from "@/components/MemoryPointModal";
import { MemoryPoint } from "@/hooks/useMemoryPoints";
import { SidebarHistory } from "@/components/sidebar/SidebarHistory";

// Inner component to consume context
function MemoryPalaceContent({ }: { onExit?: () => void }) {
  const context = useMemoryPalaceContext();
  const {
    isLoading,
    roomError,
    coins,
    houseLevel,
    placements,
    wallPlacements,
    fullCatalog,
    fullModels,
    activeWallId,
    activeFloorId,
    setActiveWallId,
    setActiveFloorId,
    customWalls,
    customFloors,
    history: globalHistory,
    restoreHistory,
    // UI State from Context
    uiState,
    toggleShop,
    toggleFurniturePanel,
    toggleHistoryPanel,
    toggleMemoryPanel,
    toggleMemoryMode,
    setView,
    studySession
  } = context;

  const {
    showFurniturePanel,
    showHistoryPanel,
    showMemoryPanel,
    isMemoryMode,
    view
  } = uiState;

  // Derive active wall/floor objects
  const activeWallObj = customWalls.find((w: any) => w.id === activeWallId) || null;
  const activeFloorObj = customFloors.find((f: any) => f.id === activeFloorId) || null;

  const {
    inventory
  } = useInventory();

  const {
    draggingItem,
    setDraggingRotation,
    draggingRotation,
    movingPlacementId,
    handleDragStart,
    handleFurnitureMouseDown,
    handleCommitPlacement,
    handleCommitWallPlacement,
    handleFurnitureClick,
    isRemoveMode,
    toggleRemoveMode,
    confirmRemove,
    cancelRemove,
    removalSelectedId,
    removeWallPlacement,
    updateVariant
  } = useRoomInteraction();

  const {
    memoryPoints,
    addMemoryPoint,
    updateMemoryPoint,
    deleteMemoryPoint,
    hasTileMemoryPoint,
  } = useMemoryPoints();

  const {
    isStudyMode,
    hasDueCard
  } = studySession;

  // Local state for modals that need data not in global UI state
  const [memoryModalData, setMemoryModalData] = useState<{
    isOpen: boolean;
    targetInfo: { type: 'furniture' | 'wall' | 'floor' | 'tile'; id: string; name: string; image?: string };
    existingPoint?: MemoryPoint;
    extra?: any;
  }>({
    isOpen: false,
    targetInfo: { type: 'tile', id: '', name: '' }
  });



  // City data
  const { buildings: cityBuildings, decorations: cityDecorations, cityLevel } = useCityLayout();
  // Region data
  const { region: regionData } = useRegion();

  // Grid state
  const [showGrid, setShowGrid] = useState(true);
  const [tileSize, setTileSize] = useState(60);
  const [gridMode, setGridMode] = useState<"floor" | "full" | "pixel">("floor");

  // Helper to match Sidebar's expected signature
  const handleTargetsName = (_type: string, id: string) => {
    return id;
  };

  const handleOpenAddMemory = (type: string, id: string, name: string, image?: string, extra?: any) => {
    setMemoryModalData({
      isOpen: true,
      targetInfo: { type: type as any, id, name, image },
      extra
    });
  };

  const handleOpenEditMemory = (point: MemoryPoint) => {
    let name = point.title;
    let image = undefined;

    if (point.targetType === 'furniture') {
      const placement = placements.find(p => p.id === point.targetId);
      if (placement) {
        const item = fullCatalog.find(i => i.id === placement.furnitureId);
        if (item) {
          name = item.name;
          image = item.icon;
        }
      }
    }

    setMemoryModalData({
      isOpen: true,
      targetInfo: { type: point.targetType, id: point.targetId, name, image },
      existingPoint: point
    });
  };

  const handleSaveMemory = async (data: { title: string; content: string }) => {
    if (memoryModalData.existingPoint) {
      await updateMemoryPoint(memoryModalData.existingPoint.id, data);
    } else {
      const { type, id } = memoryModalData.targetInfo;
      const position = type === 'tile' ? memoryModalData.extra?.position : undefined;
      await addMemoryPoint(type, id, data.title, data.content, position);
    }
    setMemoryModalData(prev => ({ ...prev, isOpen: false }));
  };

  const handleDeleteMemory = async () => {
    if (memoryModalData.existingPoint) {
      await deleteMemoryPoint(memoryModalData.existingPoint.id);
      setMemoryModalData(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleEntityMemoryClick = (type: string, id: string, extra?: any) => {
    if (isMemoryMode) {
      const existing = memoryPoints.find(p => p.targetType === type && p.targetId === id);
      if (existing) {
        handleOpenEditMemory(existing);
      } else {
        let name = "未知物件";
        let image = undefined;

        if (type === 'furniture') {
          const placement = placements.find(p => p.id === id);
          if (placement) {
            const item = fullCatalog.find(i => i.id === placement.furnitureId);
            if (item) {
              name = item.name;
              image = item.icon;
            }
          }
        } else if (type === 'tile' && extra?.position) {
          name = `地板格子 (${extra.position.x}, ${extra.position.y})`;
        }

        handleOpenAddMemory(type, id, name, image, extra);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-10 z-50 relative">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-white text-xl">Loading Memory Palace...</p>
        </div>
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="p-8 bg-red-50 text-red-500 border border-red-200 m-8 rounded">
        <h2 className="font-bold text-lg mb-2">Error Loading Room</h2>
        {roomError}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden relative">
      {/* Furniture Panel Drawer */}
      <div className={`absolute top-0 left-0 h-full bg-white shadow-xl transform transition-transform duration-300 z-40 w-80 border-r ${showFurniturePanel ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-amber-50">
            <h3 className="font-bold text-amber-800 flex items-center gap-2">
              <span className="text-xl">🛋️</span>
              Inventory
            </h3>
            <button onClick={toggleFurniturePanel} className="p-1 hover:bg-amber-100 rounded-full text-amber-600">
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SidebarFurniture
              isOpen={true}
              inventory={inventory}
              fullCatalog={fullCatalog as any[]}
              customWalls={customWalls as any[]}
              customFloors={customFloors as any[]}
              activeWallId={activeWallId}
              activeFloorId={activeFloorId}
              onSelectWall={setActiveWallId}
              onSelectFloor={setActiveFloorId}
              onDragStart={handleDragStart as any}
              isRemoveMode={isRemoveMode}
              toggleRemoveMode={() => toggleRemoveMode(!isRemoveMode)}
              confirmRemove={confirmRemove}
              cancelRemove={cancelRemove}
              hasSelection={!!removalSelectedId}
              currentPhase="intro"
            />
          </div>
        </div>
      </div>

      {/* History Panel Drawer */}
      <div className={`absolute top-0 left-0 h-full bg-white shadow-xl transform transition-transform duration-300 z-40 w-72 border-r ${showHistoryPanel ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-blue-50">
            <h3 className="font-bold text-blue-800 flex items-center gap-2">
              <span className="text-xl">📜</span>
              History
            </h3>
            <button onClick={toggleHistoryPanel} className="p-1 hover:bg-blue-100 rounded-full text-blue-600">
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SidebarHistory
              isOpen={true}
              globalHistory={globalHistory as any[]}
              onRestoreHistory={restoreHistory as any}
            />
          </div>
        </div>
      </div>

      {/* Memory Panel Drawer */}
      <div className={`absolute top-0 left-0 h-full bg-white shadow-xl transform transition-transform duration-300 z-40 w-80 border-r ${showMemoryPanel ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-purple-50">
            <h3 className="font-bold text-purple-800 flex items-center gap-2">
              <span className="text-xl">🧠</span>
              Memory Points
            </h3>
            <button onClick={toggleMemoryPanel} className="p-1 hover:bg-purple-100 rounded-full text-purple-600">
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SidebarMemory
              isOpen={true}
              memoryPoints={memoryPoints}
              onAddMemory={() => handleEntityMemoryClick('tile', '')}
              onEditMemory={handleOpenEditMemory}
              onDeleteMemory={deleteMemoryPoint}
              onViewMemory={handleOpenEditMemory}
              getTargetName={handleTargetsName}
              isMemoryMode={isMemoryMode}
              toggleMemoryMode={toggleMemoryMode}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        <DevPanel
          tileSize={tileSize}
          onTileSizeChange={setTileSize}
          showGrid={showGrid}
          onShowGridChange={setShowGrid}
          gridMode={gridMode}
          onGridModeChange={setGridMode}
        />
        <div className="flex-1 w-full h-full relative bg-slate-200">
          {view === "room" ? (
            <IsometricRoom
              houseLevel={houseLevel}
              placements={placements}
              wallPlacements={wallPlacements}
              onCommitPlacement={handleCommitPlacement}
              onCommitWallPlacement={handleCommitWallPlacement}
              draggingItem={draggingItem}
              setDraggingRotation={setDraggingRotation}
              draggingRotation={draggingRotation}
              isRemoveMode={isRemoveMode}
              removalSelectedId={removalSelectedId}
              onFurnitureClick={handleFurnitureClick}
              onFurnitureMouseDown={handleFurnitureMouseDown}
              movingPlacementId={movingPlacementId}
              fullCatalog={fullCatalog}
              fullModels={fullModels}
              activeWall={activeWallObj as any}
              activeFloor={activeFloorObj as any}
              tileWidth={tileSize}
              tileHeight={tileSize / 2}
              isMemoryMode={isMemoryMode}
              onMemoryClick={handleEntityMemoryClick}
              memoryPoints={memoryPoints}
              hasTileMemoryPoint={hasTileMemoryPoint}
              isStudyMode={isStudyMode}
              onStudyClick={(id) => console.log('Study Click', id)}
              hasDueCard={hasDueCard}
              onRemoveWallPlacement={removeWallPlacement}
              showGrid={showGrid}
              onVariantChange={updateVariant}
            />
          ) : view === "map" ? (
            <CityMap
              buildings={cityBuildings}
              decorations={cityDecorations}
              cityLevel={cityLevel}
              coins={coins}
              onBuildingClick={() => setView("room")}
              onOpenShop={toggleShop}
              onBackToRoom={() => setView("room")}
            />
          ) : (
            regionData && (
              <RegionMap
                region={regionData}
                onNavigateToCity={(ownerId) => {
                  console.log("Navigating to city of owner:", ownerId);
                  setView("map");
                }}
                onNavigateHome={() => setView("map")}
              />
            )
          )}
        </div>

        {memoryModalData.isOpen && (
          <MemoryPointModal
            isOpen={memoryModalData.isOpen}
            onClose={() => setMemoryModalData(prev => ({ ...prev, isOpen: false }))}
            targetInfo={memoryModalData.targetInfo}
            existingData={memoryModalData.existingPoint ? {
              title: memoryModalData.existingPoint.title,
              content: memoryModalData.existingPoint.content
            } : undefined}
            onSave={handleSaveMemory}
            onDelete={memoryModalData.existingPoint ? handleDeleteMemory : undefined}
          />
        )}
      </div>
    </div>
  );
}

// Simple Error Boundary implementation
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Memory Palace UI Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-100 text-red-900 min-h-screen">
          <h1 className="text-3xl font-bold mb-4">Something went wrong.</h1>
          <p className="font-bold">{this.state.error?.toString()}</p>
          <pre className="mt-4 p-4 bg-white border border-red-300 overflow-auto text-sm">
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export function MemoryPalacePage({ onExit }: { onExit?: () => void }) {
  return (
    <ErrorBoundary>
      <div className="h-full w-full bg-slate-50">
        <MemoryPalaceContent onExit={onExit} />
      </div>
    </ErrorBoundary>
  );
}
