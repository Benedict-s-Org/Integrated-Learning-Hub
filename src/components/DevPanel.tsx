import { useState } from 'react';
import { ChevronLeft, ChevronRight, GitBranch, Activity, FileText, Sliders, Grid, Eye, EyeOff, ChevronDown, Bot } from 'lucide-react';
import { AIDebugPanel } from '@/components/ai-debug';
import { useAIDebug } from '@/hooks/useAIDebug';

type GridMode = "floor" | "full" | "pixel";

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'change' | 'error';
  message: string;
}

interface Connection {
  id: string;
  from: string;
  to: string;
  type: 'imports' | 'renders' | 'calls';
}

interface DevPanelProps {
  tileSize: number;
  onTileSizeChange: (value: number) => void;
  showGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  gridMode: GridMode;
  onGridModeChange: (value: GridMode) => void;
}

const mockLogs: LogEntry[] = [
  { id: '1', timestamp: '12:34:56', type: 'change', message: 'Furniture placement updated' },
  { id: '2', timestamp: '12:34:55', type: 'info', message: 'Game phase changed to intro' },
  { id: '3', timestamp: '12:34:54', type: 'change', message: 'DevPanel integrated' },
  { id: '4', timestamp: '12:34:53', type: 'info', message: 'IsometricRoom rendered' },
  { id: '5', timestamp: '12:34:52', type: 'change', message: 'Sidebar state toggled' },
];

const mockConnections: Connection[] = [
  { id: '1', from: 'MemoryPalaceTycoon', to: 'Sidebar', type: 'renders' },
  { id: '2', from: 'MemoryPalaceTycoon', to: 'IsometricRoom', type: 'renders' },
  { id: '3', from: 'MemoryPalaceTycoon', to: 'DevPanel', type: 'renders' },
  { id: '4', from: 'Sidebar', to: 'useGameProgress', type: 'calls' },
  { id: '5', from: 'IsometricRoom', to: 'FURNITURE_MODELS', type: 'imports' },
  { id: '6', from: 'MemoryPalaceTycoon', to: 'EncodingView', type: 'renders' },
  { id: '7', from: 'MemoryPalaceTycoon', to: 'RecallView', type: 'renders' },
];

const getModeLabel = (mode: GridMode): string => {
  switch (mode) {
    case "floor":
      return "地板模式 (Floor Only)";
    case "full":
      return "全空間模式 (Full Isometric)";
    case "pixel":
      return "像素模式 (Game 26.6°)";
  }
};

const getModeDescription = (mode: GridMode): string => {
  switch (mode) {
    case "floor":
      return "30°/150° 菱形網格 - 對齊地毯、床、矮櫃";
    case "full":
      return "30°/150°/90° 三角網格 - 對齊高櫃、壁掛裝飾";
    case "pixel":
      return "26.565° (2:1) 網格 - 復古像素風檢查";
  }
};

import { RouteOverlay } from '@/components/debug/RouteOverlay';

export function DevPanel({ tileSize, onTileSizeChange, showGrid, onShowGridChange, gridMode, onGridModeChange }: DevPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'connections' | 'logs'>('settings');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showRouteOverlay, setShowRouteOverlay] = useState(false);
  const aiDebug = useAIDebug();

  return (
    <>
      <RouteOverlay enabled={showRouteOverlay} />
      <div
        className={`fixed right-0 top-0 h-full flex flex-col border-l border-slate-200 bg-white/95 backdrop-blur-sm shadow-xl transition-all duration-300 z-40 debug-panel-ignore ${isOpen ? 'w-80' : 'w-0'
          }`}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -left-8 top-4 flex h-8 w-8 items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
        >
          {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {isOpen && (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-700">Developer Panel</h2>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex flex-1 items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${activeTab === 'settings'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Sliders className="h-3 w-3" />
                Settings
              </button>
              <button
                onClick={() => setActiveTab('connections')}
                className={`flex flex-1 items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${activeTab === 'connections'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <GitBranch className="h-3 w-3" />
                Connections
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex flex-1 items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${activeTab === 'logs'
                  ? 'border-b-2 border-indigo-500 text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <FileText className="h-3 w-3" />
                Logs
              </button>
            </div>

            {/* AI Debug Button */}
            <button
              onClick={() => aiDebug.setIsOpen(true)}
              className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Bot size={16} />
              AI 除錯助手
            </button>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  {/* Debug Tools Section */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      除錯工具 (Debug Tools)
                    </h3>
                  </div>

                  {/* Route Overlay Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100 mb-4">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={showRouteOverlay}
                        onChange={(e) => setShowRouteOverlay(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-10 h-5 rounded-full transition-colors ${showRouteOverlay ? "bg-purple-500" : "bg-slate-300"}`}>
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showRouteOverlay ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-slate-700 flex items-center gap-2">
                      <Bot size={14} className="text-purple-500" />
                      顯示連結路徑 (Show Routes)
                    </span>
                  </label>

                  {/* Grid Overlay Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Grid size={14} className="text-indigo-500" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        輔助網格 (Grid Overlay)
                      </h3>
                      <span className="text-xs text-slate-400 ml-auto">按 G 切換</span>
                    </div>

                    {/* Grid Toggle */}
                    <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={showGrid}
                          onChange={(e) => onShowGridChange(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition-colors ${showGrid ? "bg-indigo-500" : "bg-slate-300"}`}>
                          <div
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showGrid ? "translate-x-5" : "translate-x-0"}`}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-slate-700 flex items-center gap-2">
                        {showGrid ? <Eye size={14} /> : <EyeOff size={14} />}
                        顯示輔助網格
                      </span>
                    </label>

                    {/* Grid Mode Dropdown */}
                    <div>
                      <label className="text-xs text-slate-500 block mb-1.5">網格模式</label>
                      <div className="relative">
                        <button
                          onClick={() => setShowDropdown(!showDropdown)}
                          disabled={!showGrid}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-all flex items-center justify-between ${showGrid
                            ? "bg-white border-slate-200 text-slate-700 hover:border-indigo-400"
                            : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            }`}
                        >
                          <div>
                            <div className="text-sm font-medium">{getModeLabel(gridMode)}</div>
                          </div>
                          <ChevronDown size={16} className={`transition-transform ${showDropdown ? "rotate-180" : ""}`} />
                        </button>

                        {showDropdown && showGrid && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-lg z-50">
                            {(["floor", "full", "pixel"] as GridMode[]).map((mode) => (
                              <button
                                key={mode}
                                onClick={() => {
                                  onGridModeChange(mode);
                                  setShowDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors ${gridMode === mode ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
                                  }`}
                              >
                                <div className="text-sm font-medium text-slate-700">{getModeLabel(mode)}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{getModeDescription(mode)}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Grid Size Display */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                      <label className="text-xs text-slate-500">網格密度</label>
                      <span className="text-xs font-mono text-indigo-600">26.565px (固定)</span>
                    </div>
                  </div>

                  <hr className="border-slate-200" />

                  {/* Tile Settings Section */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      瓷磚大小設定 (Tile Size)
                    </h3>

                    {/* Unified Tile Size Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-medium text-slate-700">大小</label>
                        <input
                          type="number"
                          min="30"
                          max="100"
                          value={tileSize}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(30, Number(e.target.value) || 30));
                            onTileSizeChange(val);
                          }}
                          className="w-20 px-2 py-1 text-sm font-mono text-right border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="100"
                        value={tileSize}
                        onChange={(e) => onTileSizeChange(Number(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>30</span>
                        <span>100</span>
                      </div>
                    </div>

                    {/* Calculated Dimensions Display */}
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">寬度 (Width)</span>
                        <span className="font-mono text-indigo-600">{tileSize}px</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">高度 (Height)</span>
                        <span className="font-mono text-indigo-600">{tileSize / 2}px</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-200 pt-1.5 mt-1.5">
                        <span className="text-slate-500">比例 (W:H)</span>
                        <span className="font-mono font-bold text-slate-700">2:1 (固定)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'connections' && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Component Interactions
                  </h3>
                  {mockConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{conn.from}</span>
                        <Activity className="h-3 w-3 text-indigo-500" />
                        <span className="font-medium text-slate-700">{conn.to}</span>
                      </div>
                      <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                        {conn.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Recent Changes
                  </h3>
                  {mockLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-medium ${log.type === 'change'
                            ? 'text-emerald-600'
                            : log.type === 'error'
                              ? 'text-red-600'
                              : 'text-slate-400'
                            }`}
                        >
                          {log.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">{log.timestamp}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{log.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* AI Debug Panel */}
        <AIDebugPanel
          isOpen={aiDebug.isOpen}
          onClose={() => aiDebug.setIsOpen(false)}
          messages={aiDebug.messages}
          isLoading={aiDebug.isLoading}
          error={aiDebug.error}
          onSend={aiDebug.sendMessage}
          onClear={aiDebug.clearHistory}
        />
      </div>
    </>
  );
}
