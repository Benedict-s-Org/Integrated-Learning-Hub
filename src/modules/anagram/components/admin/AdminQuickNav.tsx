import { useState, useRef, useEffect } from "react";
import { Home, RefreshCcw, ChevronLeft, ChevronRight, Settings, Move } from "lucide-react";

interface Props {
  onBackToAdmin: () => void;
  onRefreshContent: () => void;
  onNextPhase: () => void;
  onPrevPhase: () => void;
  currentPhase: string;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
}

export default function AdminQuickNav({ 
  onBackToAdmin, 
  onRefreshContent, 
  onNextPhase, 
  onPrevPhase,
  currentPhase,
  isDemoMode,
  onToggleDemoMode
}: Props) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - offsetRef.current.x,
        y: e.clientY - offsetRef.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      ref={dragRef}
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-500"
    >
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-2xl px-5 py-2.5 shadow-2xl flex items-center gap-4 text-white min-w-[400px] select-none">
        {/* Drag Handle */}
        <div 
          onMouseDown={handleMouseDown}
          className="p-1.5 hover:bg-slate-800 rounded-lg cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 transition-colors"
          title="Drag to move"
        >
          <Move size={16} />
        </div>

        <div className="flex flex-col min-w-[80px]">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HUD</span>
          <span className="text-xs font-bold text-indigo-400 truncate max-w-[100px] capitalize">{currentPhase.replace(/_/g, ' ')}</span>
        </div>

        <div className="h-8 w-px bg-slate-700/50" />

        <div className="flex items-center gap-1.5">
          <button 
            onClick={onPrevPhase}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            title="Previous Phase"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={onNextPhase}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            title="Next Phase"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="h-8 w-px bg-slate-700/50" />

        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleDemoMode}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all text-[11px] font-bold border ${
              isDemoMode 
                ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300"
            }`}
            title="Toggle Demo Mode (Auto-fill support)"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isDemoMode ? "bg-amber-400 animate-pulse" : "bg-slate-600"}`} />
            <span>Demo</span>
          </button>

          <button 
            onClick={onRefreshContent}
            className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-800 rounded-lg transition-colors text-[11px] font-bold"
            title="Reload CMS Content"
          >
            <RefreshCcw size={14} className="text-emerald-400" />
            <span>Sync</span>
          </button>
          
          <button 
            onClick={onBackToAdmin}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all text-[11px] font-extrabold shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Settings size={14} />
            <span>Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}
