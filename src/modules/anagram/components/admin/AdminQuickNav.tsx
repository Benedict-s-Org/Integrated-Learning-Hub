import { Home, RefreshCcw, ChevronLeft, ChevronRight, Settings } from "lucide-react";

interface Props {
  onBackToAdmin: () => void;
  onRefreshContent: () => void;
  onNextPhase: () => void;
  onPrevPhase: () => void;
  currentPhase: string;
}

export default function AdminQuickNav({ 
  onBackToAdmin, 
  onRefreshContent, 
  onNextPhase, 
  onPrevPhase,
  currentPhase 
}: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 text-white min-w-[400px]">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin HUD</span>
          <span className="text-xs font-bold text-indigo-400 truncate max-w-[120px] capitalize">{currentPhase.replace(/_/g, ' ')}</span>
        </div>

        <div className="h-8 w-px bg-slate-700" />

        <div className="flex items-center gap-2">
          <button 
            onClick={onPrevPhase}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
            title="Previous Phase"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={onNextPhase}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
            title="Next Phase"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="h-8 w-px bg-slate-700" />

        <div className="flex items-center gap-2">
          <button 
            onClick={onRefreshContent}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 rounded-lg transition-colors text-sm font-bold"
            title="Reload CMS Content from Database"
          >
            <RefreshCcw size={16} className="text-emerald-400" />
            <span>Sync</span>
          </button>
          
          <button 
            onClick={onBackToAdmin}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all text-sm font-extrabold shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Settings size={16} />
            <span>Back to CMS</span>
          </button>
        </div>
      </div>
    </div>
  );
}
