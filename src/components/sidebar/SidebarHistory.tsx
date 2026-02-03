import React from "react";
import { History, Clock, RotateCcw as UndoIcon } from "lucide-react";

interface HistoryRecord {
  id: string;
  name: string;
  timestamp: string;
  data: any[];
}

interface SidebarHistoryProps {
  isOpen: boolean;
  globalHistory: HistoryRecord[];
  onRestoreHistory: (record: HistoryRecord) => void;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  isOpen,
  globalHistory,
  onRestoreHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="flex-1 p-4 overflow-y-auto" data-component-name="SidebarHistory" data-source-file="src/components/sidebar/SidebarHistory.tsx">
      {globalHistory.length === 0 ? (
        <div className="text-center text-gray-400 text-xs py-4">暫無佈置紀錄</div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-slate-400 font-bold uppercase mb-2">最近 30 筆操作</div>
          {globalHistory.map((record) => (
            <div
              key={record.id}
              className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm hover:border-indigo-300 transition-all cursor-pointer group"
              onClick={() => onRestoreHistory(record)}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-slate-700 text-sm">{record.name}</span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock size={10} /> {record.timestamp}
                </span>
              </div>
              <div className="text-xs text-slate-500">物件數: {record.data.length}</div>
              <div className="text-xs text-indigo-600 mt-2 opacity-0 group-hover:opacity-100 font-bold flex items-center gap-1">
                <UndoIcon size={12} /> 點擊還原此狀態
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
