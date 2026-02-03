import React, { useState } from "react";
import { Loader2, X } from "lucide-react";
import { MemoryPalaceProvider, useMemoryPalaceContext } from "@/contexts/MemoryPalaceContext";
import { useInventory } from "@/hooks/useInventory";
import { useRoomInteraction } from "@/hooks/useRoomInteraction";
import { useMemoryPoints } from "@/hooks/useMemoryPoints";
import { useStudySession } from "@/hooks/useStudySession";
import { Sidebar } from "@/components/sidebar";
import { IsometricRoom } from "@/components/room/IsometricRoom";
import { DevPanel } from "@/components/DevPanel";
import { FurnitureStudio } from "@/components/furniture/FurnitureStudio";
import { FurnitureUploader } from "@/components/furniture/FurnitureUploader";
import { FurnitureEditor } from "@/components/editor/FurnitureEditor";
import { SpaceDesignCenter } from "@/components/SpaceDesignCenter";
import { CityEditorModal } from "@/components/admin/CityEditorModal";
import { AssetUploadCenter } from "@/components/ui-builder/AssetUploadCenter";

// Inner component to consume context
function MemoryPalaceContent({ onExit }: { onExit?: () => void }) {
  const context = useMemoryPalaceContext();
  console.log("MemoryPalaceContent: Context", context);
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
    isAdmin,
    setCustomCatalog,
    setCustomModels,
    setCustomWalls,
    setCustomFloors,
  } = context;

  // Deriving active wall/floor objects from ID
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
    removeWallPlacement
  } = useRoomInteraction();

  const {
    memoryPoints,
    // handled inside room if passed
    // handleMemoryClick wrapper? Room expects onMemoryClick
  } = useMemoryPoints();

  const {
    dueCount,
    isStudyMode,
    toggleStudyMode,
    hasDueCard
    // Room expects onStudyClick
  } = useStudySession();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<"intro" | "encoding" | "recall" | "result">("intro");

  // Modals state
  const [showUploader, setShowUploader] = useState(false);
  const [showStudio, setShowStudio] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showSpaceDesign, setShowSpaceDesign] = useState(false);
  const [showCityEditor, setShowCityEditor] = useState(false);
  const [showAssetUpload, setShowAssetUpload] = useState(false);
  const [uiAssets, setUiAssets] = useState<any[]>([]);

  // Grid state
  const [showGrid, setShowGrid] = useState(true);
  const [tileSize, setTileSize] = useState(60);
  const [gridMode, setGridMode] = useState<"floor" | "full" | "pixel">("floor");

  // Helper to match Sidebar's expected signature
  const handleTargetsName = (_type: string, id: string) => {
    // Simple stub for now
    return id;
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
      <div className="w-20 md:w-64 h-full bg-white border-r relative shrink-0">
        <Sidebar
          isOpen={sidebarOpen}
          toggle={() => setSidebarOpen(!sidebarOpen)}
          onExit={onExit}
          coins={coins}
          onStart={() => setCurrentPhase("encoding")}
          onShop={() => {/* TODO: Implement shop modal */ }}
          onCity={() => {/* TODO: Implement town map */ }}
          currentPhase={currentPhase}
          isAdmin={isAdmin}
          inventory={inventory}
          onDragStart={handleDragStart as any}
          isRemoveMode={isRemoveMode}
          toggleRemoveMode={() => toggleRemoveMode(!isRemoveMode)}
          confirmRemove={confirmRemove}
          cancelRemove={cancelRemove}
          hasSelection={!!removalSelectedId}
          onOpenUploader={() => setShowUploader(true)}
          onOpenStudio={() => setShowStudio(true)}
          onOpenEditor={() => setShowEditor(true)}
          onOpenSpaceDesign={() => setShowSpaceDesign(true)}
          onOpenCityEditor={() => setShowCityEditor(true)}
          onOpenAssetUpload={() => setShowAssetUpload(true)}
          globalHistory={globalHistory as any[]}
          onRestoreHistory={restoreHistory as any}
          fullCatalog={fullCatalog as any}
          customWalls={customWalls as any}
          customFloors={customFloors as any}
          activeWallId={activeWallId}
          activeFloorId={activeFloorId}
          onSelectWall={setActiveWallId}
          onSelectFloor={setActiveFloorId}
          isMemoryMode={false}
          toggleMemoryMode={() => { }}
          isStudyMode={isStudyMode}
          toggleStudyMode={toggleStudyMode}
          dueCount={dueCount}
          memoryPoints={memoryPoints}
          onAddMemory={() => {/* TODO */ }}
          onEditMemory={() => {/* TODO */ }}
          onDeleteMemory={() => {/* TODO */ }}
          onViewMemory={() => {/* TODO */ }}
          getTargetName={handleTargetsName}
        />
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
            isMemoryMode={false}
            onMemoryClick={(type, id) => console.log('Memory Click', type, id)}
            memoryPoints={memoryPoints}
            // hasTileMemoryPoint
            isStudyMode={isStudyMode}
            onStudyClick={(id) => console.log('Study Click', id)}
            hasDueCard={hasDueCard}
            onRemoveWallPlacement={removeWallPlacement}
            showGrid={showGrid}
          />
        </div>
      </div>

      {/* Admin Modals */}
      {showStudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden">
            <FurnitureStudio
              onClose={() => setShowStudio(false)}
              onSave={(item, model) => {
                setCustomCatalog((prev: any[]) => [...prev, item]);
                setCustomModels((prev: any) => ({ ...prev, [item.id]: model }));
                setShowStudio(false);
              }}
            />
          </div>
        </div>
      )}

      {showUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden">
            <FurnitureUploader
              onClose={() => setShowUploader(false)}
              onSave={(item) => {
                setCustomCatalog((prev: any[]) => [...prev, item]);
                setShowUploader(false);
              }}
            />
          </div>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden">
            <div className="h-full flex flex-col p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xl">家具編輯器</h3>
                <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <FurnitureEditor
                  onClose={() => setShowEditor(false)}
                  customCatalog={fullCatalog as any[]}
                  onUpdate={(item: any) => setCustomCatalog((prev: any[]) => prev.map(i => i.id === item.id ? item : i))}
                  onDelete={(id: string) => setCustomCatalog((prev: any[]) => prev.filter(i => i.id !== id))}
                  customWalls={customWalls as any[]}
                  customFloors={customFloors as any[]}
                  onUpdateWall={(wall: any) => setCustomWalls((prev: any[]) => prev.map(w => w.id === wall.id ? wall : w))}
                  onUpdateFloor={(floor: any) => setCustomFloors((prev: any[]) => prev.map(f => f.id === floor.id ? floor : f))}
                  onDeleteWall={(id: string) => setCustomWalls((prev: any[]) => prev.filter(w => w.id !== id))}
                  onDeleteFloor={(id: string) => setCustomFloors((prev: any[]) => prev.filter(f => f.id !== id))}
                  onEnterTransformMode={(id) => console.log('Enter transform', id)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {showSpaceDesign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full h-full bg-white flex flex-col">
            <SpaceDesignCenter
              onClose={() => setShowSpaceDesign(false)}
              fullCatalog={fullCatalog as any[]}
              activeWall={activeWallObj}
              activeFloor={activeFloorObj}
              customWalls={customWalls as any[]}
              customFloors={customFloors as any[]}
              activeWallId={activeWallId}
              activeFloorId={activeFloorId}
              onSelectWall={setActiveWallId}
              onSelectFloor={setActiveFloorId}
            />
          </div>
        </div>
      )}

      <CityEditorModal
        isOpen={showCityEditor}
        onClose={() => setShowCityEditor(false)}
      />

      {showAssetUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-xl">素材上傳中心</h3>
                <button onClick={() => setShowAssetUpload(false)} className="p-2 hover:bg-slate-200 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <AssetUploadCenter
                  assets={uiAssets}
                  onAddAsset={(asset) => setUiAssets(prev => [...prev, asset])}
                  onRemoveAsset={(id) => setUiAssets(prev => prev.filter(a => a.id !== id))}
                  onLinkAssets={(src, tgt) => console.log('Link', src, tgt)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
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
        <MemoryPalaceProvider>
          <MemoryPalaceContent onExit={onExit} />
        </MemoryPalaceProvider>
      </div>
    </ErrorBoundary>
  );
}
