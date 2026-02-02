import React from "react";
import { Brain, MousePointer, Move, RotateCcw } from "lucide-react";
import { FurnitureItem } from "@/types/furniture";

interface RoomHelpOverlayProps {
  isMemoryMode: boolean;
  isRemoveMode: boolean;
  draggingItem: FurnitureItem | null;
}

export const RoomHelpOverlay: React.FC<RoomHelpOverlayProps> = ({
  isMemoryMode,
  isRemoveMode,
  draggingItem,
}) => {
  return (
    <div className="absolute top-4 right-4 text-xs text-slate-500 bg-white/80 backdrop-blur px-3 py-2 rounded-lg border border-slate-200 pointer-events-none shadow-sm flex flex-col gap-1 items-end">
      {isMemoryMode ? (
        <>
          <div className="flex items-center gap-1 text-purple-600 font-bold">
            <Brain size={12} /> 記憶模式
          </div>
          <div className="flex items-center gap-1 text-gray-600">點擊物件添加記憶點</div>
        </>
      ) : isRemoveMode ? (
        <>
          <div className="flex items-center gap-1 text-red-600 font-bold">
            <MousePointer size={12} /> 點擊紅色傢俱選擇
          </div>
          <div className="flex items-center gap-1 text-gray-600">再點擊側邊欄確認</div>
        </>
      ) : draggingItem ? (
        <>
          <div className="flex items-center gap-1 text-indigo-600 font-bold">
            <Move size={12} /> 放開左鍵放置
          </div>
          <div className="flex items-center gap-1 text-orange-600 font-bold">
            <RotateCcw size={12} /> 按右鍵旋轉方向
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <MousePointer size={12} /> <span className="font-bold">左鍵拖曳</span> 平移 / 移動傢俱
          </div>
          <div className="flex items-center gap-1">
            <RotateCcw size={12} /> <span className="font-bold">右鍵拖曳</span> 旋轉
          </div>
        </>
      )}
    </div>
  );
};
