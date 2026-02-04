import React, { useState } from "react";
import { Package, Square, Grid } from "lucide-react";
import { FurnitureTab } from "./FurnitureTab";
import { WallTab } from "./WallTab";
import { FloorTab } from "./FloorTab";
import { FurnitureItem } from "@/types/furniture";
import { CustomWall, CustomFloor } from "@/types/room";

interface FurnitureEditorProps {
  onClose: () => void;
  customCatalog: FurnitureItem[];
  onUpdate: (item: FurnitureItem) => void;
  onDelete: (id: string) => void;
  customWalls: CustomWall[];
  customFloors: CustomFloor[];
  onUpdateWall: (wall: CustomWall) => void;
  onUpdateFloor: (floor: CustomFloor) => void;
  onDeleteWall: (id: string) => void;
  onDeleteFloor: (id: string) => void;
  onEnterTransformMode: (id: string) => void;
  customModels: Record<string, any>;
}

export const FurnitureEditor: React.FC<FurnitureEditorProps> = ({
  onClose,
  customCatalog,
  onUpdate,
  onDelete,
  customWalls,
  customFloors,
  onUpdateWall,
  onUpdateFloor,
  onDeleteWall,
  onDeleteFloor,
  onEnterTransformMode,
  customModels,
}) => {
  const [editorTab, setEditorTab] = useState<"furniture" | "wall" | "floor">("furniture");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setEditorTab("furniture")}
          className={`flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${editorTab === "furniture"
            ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
        >
          <Package size={16} /> 家具
        </button>
        <button
          onClick={() => setEditorTab("wall")}
          className={`flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${editorTab === "wall"
            ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
        >
          <Square size={16} /> 牆壁
        </button>
        <button
          onClick={() => setEditorTab("floor")}
          className={`flex-1 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${editorTab === "floor"
            ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
        >
          <Grid size={16} /> 地板
        </button>
      </div>

      {/* Tab Content */}
      {editorTab === "furniture" && (
        <FurnitureTab
          customCatalog={customCatalog}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onEnterTransformMode={onEnterTransformMode}
          onClose={onClose}
          customModels={customModels}
        />
      )}

      {editorTab === "wall" && (
        <WallTab
          customWalls={customWalls}
          onUpdateWall={onUpdateWall}
          onDeleteWall={onDeleteWall}
          onClose={onClose}
        />
      )}

      {editorTab === "floor" && (
        <FloorTab
          customFloors={customFloors}
          onUpdateFloor={onUpdateFloor}
          onDeleteFloor={onDeleteFloor}
          onClose={onClose}
        />
      )}
    </div>
  );
};
