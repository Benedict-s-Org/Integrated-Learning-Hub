import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { Edit2, Target, HelpCircle } from "lucide-react";

interface Props {
  taskName?: string;
  taskDescription?: string;
  targetLabel: string;
  onConfirm: (seconds: number) => void;
  cmsContent?: any;
}

export default function PredictionScreen({
  taskName,
  taskDescription,
  targetLabel,
  onConfirm,
  cmsContent,
}: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { isAdmin } = useAuth();

  // Use CMS content if available, prioritize CMS content as it represents the researcher's edits
  const finalTaskName = cmsContent?.task_name || taskName || "Anagram Task";
  const finalTaskDescription = cmsContent?.task_description || taskDescription || "Please predict the time needed.";

  const numValue = parseInt(value);
  const minVal = cmsContent?.min_val ?? 1;
  const maxVal = cmsContent?.max_val ?? 600;
  const isValid = !isNaN(numValue) && numValue >= minVal && numValue <= maxVal;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (isValid) onConfirm(numValue);
  };

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#f1f3f4" }}>
      <div className="max-w-[720px] mx-auto space-y-3 relative group">
        {/* Admin Edit Shortcut */}
        {isAdmin && (
          <div className="absolute -top-3 -right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => window.alert(`Navigate to Admin Panel -> Content Editing -> ${finalTaskName?.includes('1') ? 'Task 1' : 'Task 2'} Prediction to edit this page`)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#4285f4] text-white rounded-[4px] text-xs font-medium shadow-sm hover:bg-blue-600 transition-all"
              title="Edit Page Content"
            >
              <Edit2 size={12} />
              <span>Edit Page</span>
            </button>
          </div>
        )}
        
        {/* Main Header Block */}
        <div className="bg-white rounded-[8px] border overflow-hidden" style={{ borderColor: "#dadce0" }}>
          <div className="h-[10px]" style={{ backgroundColor: "#673ab7" }} />
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl">⏱️</div>
              <h1 className="text-3xl font-normal text-[#202124]" dangerouslySetInnerHTML={{ __html: cmsContent?.title || "Time Prediction" }} />
            </div>
          </div>
        </div>

        {/* Section 1: Task Identification - Standalone Card */}
        <div className="bg-white rounded-[12px] border overflow-hidden shadow-sm" style={{ borderColor: "#dadce0" }}>
          <div className="bg-[#f8f9fa] px-5 py-4 border-b border-[#dadce0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
               <Target size={18} />
            </div>
            <div>
              <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">Task Identification</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Section 1</p>
            </div>
          </div>
          <div className="p-6">
            <div className="border-2 border-[#e8f0fe] rounded-xl overflow-hidden bg-[#f8f9fa]">
              <div className="bg-[#e8f0fe] px-4 py-2 border-b border-[#d2e3fc] flex items-center justify-between">
                <span className="text-[10px] font-black text-[#1967d2] uppercase tracking-widest">Upcoming Exercise</span>
                <div className="w-2 h-2 rounded-full bg-[#1967d2] animate-pulse" />
              </div>
              <div className="p-5 space-y-4">
                <div 
                  className="text-2xl font-black text-[#202124] leading-tight tracking-tight italic" 
                  dangerouslySetInnerHTML={{ __html: finalTaskName }} 
                />
                {(finalTaskDescription && finalTaskDescription !== "<p></p>" && finalTaskDescription !== "<p><br></p>") ? (
                  <div 
                    className="text-[17px] text-[#4a4a4a] font-semibold leading-relaxed border-t border-slate-200/60 pt-3" 
                    dangerouslySetInnerHTML={{ __html: finalTaskDescription }} 
                  />
                ) : (
                  <div className="text-[17px] text-slate-400 italic font-medium border-t border-slate-200/60 pt-3">
                    No task description provided.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Question Block (Section 2) */}
        <div className="bg-white rounded-[12px] border overflow-hidden shadow-sm" style={{ borderColor: "#dadce0" }}>
          <div className="bg-[#f8f9fa] px-5 py-4 border-b border-[#dadce0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
               <HelpCircle size={18} />
            </div>
            <div>
              <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight">Prediction Guidance</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Section 2</p>
            </div>
          </div>
          <div className="p-6 space-y-8">
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#202124] leading-relaxed">
                {(cmsContent?.question_text || "How many <strong>seconds</strong> do you think <strong class=\"text-[#673ab7]\">[target]</strong> will need to solve <strong>each puzzle</strong>?").split('[target]').map((part: string, i: number, arr: any[]) => (
                  <span key={i}>
                    <span dangerouslySetInnerHTML={{ __html: part.replace(/text-indigo-600/g, "text-[#673ab7]") }} />
                    {i < arr.length - 1 && <strong className="text-[#673ab7]">{targetLabel}</strong>}
                  </span>
                ))}
                <span className="text-[#d93025] ml-1">*</span>
              </h2>
            </div>

            <div className="flex items-center gap-3 w-full">
              <input
                ref={inputRef}
                type="number"
                min={1}
                max={maxVal}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                placeholder={cmsContent?.input_placeholder || "Your answer"}
                className={`w-32 px-0 py-1.5 border-b focus:border-b-2 focus:outline-none transition-colors text-sm bg-transparent ${
                  isValid ? "border-[#673ab7] text-[#202124]" :
                  value.length > 0 ? "border-[#d93025] text-[#d93025]" : "border-gray-300 text-[#202124]"
                }`}
              />
              <span className="text-[#5f6368] text-sm" dangerouslySetInnerHTML={{ __html: cmsContent?.unit_label || "seconds/puzzle" }} />
            </div>

            {/* Validation hint */}
            {value.length > 0 && !isValid && (
              <p className="text-sm text-[#d93025] flex items-center gap-1 mt-1">
                <svg aria-hidden="true" className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>
                <span dangerouslySetInnerHTML={{ __html: (cmsContent?.validation_error_template || "Please enter a number between {min} and {max}").replace("{min}", minVal.toString()).replace("{max}", maxVal.toString()) }} />
              </p>
            )}
          </div>
        </div>

        {/* Submit Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className={`px-6 py-2 rounded-[4px] font-medium text-sm transition-colors ${
                isValid
                  ? "bg-[#673ab7] text-white hover:bg-purple-700 active:bg-purple-800"
                  : "bg-[#e8eaed] text-[#9aa0a6] cursor-not-allowed border border-transparent"
              }`}
            >
              <span dangerouslySetInnerHTML={{ __html: cmsContent?.confirm_button ? cmsContent.confirm_button.replace("→", "").trim() : "Submit" }} />
            </button>
            
            <div className="flex-1 flex justify-end">
               {isValid && (
                 <div className="text-[#5f6368] text-sm">
                   <span dangerouslySetInnerHTML={{ __html: (cmsContent?.result_preview_template || "Predicted: <strong class=\"text-[#673ab7]\">{val}s</strong> / puzzle").replace("{val}", numValue.toString()) }} />
                 </div>
               )}
            </div>
          </div>

      </div>
    </div>
  );
}
