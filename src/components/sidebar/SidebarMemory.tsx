import React from "react";
import { Brain } from "lucide-react";
import { MemoryPalacePanel } from "@/components/MemoryPalacePanel";
import { MemoryPoint } from "@/hooks/useMemoryPoints";

interface SidebarMemoryProps {
  isOpen: boolean;
  isMemoryMode: boolean;
  toggleMemoryMode: () => void;
  memoryPoints: MemoryPoint[];
  onAddMemory: (type: string) => void;
  onEditMemory: (point: MemoryPoint) => void;
  onDeleteMemory: (id: string) => void;
  onViewMemory: (point: MemoryPoint) => void;
  getTargetName: (type: string, id: string) => string;
}

export const SidebarMemory: React.FC<SidebarMemoryProps> = ({
  isOpen,
  isMemoryMode,
  toggleMemoryMode,
  memoryPoints,
  onAddMemory,
  onEditMemory,
  onDeleteMemory,
  onViewMemory,
  getTargetName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <button
          onClick={toggleMemoryMode}
          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            isMemoryMode
              ? "bg-purple-600 text-white"
              : "bg-purple-100 text-purple-700 hover:bg-purple-200"
          }`}
        >
          <Brain size={18} />
          {isMemoryMode ? "退出記憶模式" : "進入記憶模式"}
        </button>
        {isMemoryMode && (
          <p className="text-xs text-purple-600 text-center mt-2">
            點擊房間中的物件添加記憶點
          </p>
        )}
      </div>
      <MemoryPalacePanel
        memoryPoints={memoryPoints}
        onAddMemory={onAddMemory}
        onEditMemory={onEditMemory}
        onDeleteMemory={onDeleteMemory}
        onViewMemory={onViewMemory}
        getTargetName={getTargetName}
      />
    </div>
  );
};
