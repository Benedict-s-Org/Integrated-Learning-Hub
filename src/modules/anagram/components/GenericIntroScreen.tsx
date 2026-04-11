import { Play } from "lucide-react";

interface Props {
  cmsContent: {
    title?: string;
    description?: string;
    button_text?: string;
  };
  onStart: () => void;
}

export default function GenericIntroScreen({ cmsContent, onStart }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-8 space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 mb-2">
          <Play size={40} />
        </div>
        <h2 
          className="text-3xl font-black text-slate-800 tracking-tight" 
          dangerouslySetInnerHTML={{ __html: cmsContent?.title || "Next Phase" }} 
        />
        <div 
          className="text-slate-600 leading-relaxed font-medium" 
          dangerouslySetInnerHTML={{ __html: cmsContent?.description || "Get ready for the next part of the experiment." }} 
        />
        <button
          onClick={onStart}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95"
        >
          <span dangerouslySetInnerHTML={{ __html: cmsContent?.button_text || "Continue →" }} />
        </button>
      </div>
    </div>
  );
}
