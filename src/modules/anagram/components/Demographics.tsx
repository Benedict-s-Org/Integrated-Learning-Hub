import { useState, useEffect } from "react";
import type { Demographics as DemographicsData } from "../types/experiment";

interface Props {
  onComplete: (data: DemographicsData) => void;
  content?: any;
}

export default function Demographics({ onComplete, content }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});

  // Initialize form state when content loads
  useEffect(() => {
    if (content?.fields && Array.isArray(content.fields)) {
      const initialForm: Record<string, string> = {};
      content.fields.forEach((field: any) => {
        initialForm[field.id] = "";
      });
      setForm(initialForm);
    }
  }, [content]);

  const update = (fieldId: string, value: string) => {
    setForm((prev) => ({ ...prev, [fieldId]: value }));
  };

  const parseOptions = (optionsStr: string) => {
    if (!optionsStr) return [];
    const delimiter = optionsStr.includes('\n') ? '\n' : ',';
    return optionsStr.split(delimiter).map((s) => s.trim()).filter(Boolean);
  };

  const isValid = content?.fields?.every((field: any) => Boolean(form[field.id]));

  // Question Block Component
  const QuestionBlock = ({ label, children }: any) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
      <label className="block text-base font-bold text-slate-800 tracking-tight" dangerouslySetInnerHTML={{ __html: label }} />
      <div className="animate-in fade-in slide-in-from-top-1 duration-300">
        {children}
      </div>
    </div>
  );

  const renderFieldInput = (field: any) => {
    const value = form[field.id] || "";
    const options = parseOptions(field.options || "");

    switch (field.type) {
      case 'number':
        return (
          <input
            type="number"
            min="1"
            max="120"
            value={value}
            onChange={(e) => update(field.id, e.target.value)}
            placeholder={field.placeholder || "Enter number"}
            className="w-full md:w-1/3 px-0 py-2 border-b-2 border-slate-100 focus:border-indigo-600 focus:outline-none transition-all text-lg font-medium bg-transparent"
          />
        );
      
      case 'short_text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => update(field.id, e.target.value)}
            placeholder={field.placeholder || "Type your answer..."}
            className="w-full md:w-2/3 px-0 py-2 border-b-2 border-slate-100 focus:border-indigo-600 focus:outline-none transition-all text-lg font-medium bg-transparent"
          />
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {options.map((opt) => (
              <label 
                key={opt} 
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                  value === opt.toLowerCase() 
                    ? "border-indigo-600 bg-indigo-50" 
                    : "border-slate-50 hover:bg-slate-50"
                }`}
                onClick={() => update(field.id, opt.toLowerCase())}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  value === opt.toLowerCase() ? "border-indigo-600" : "border-slate-300"
                }`}>
                  {value === opt.toLowerCase() && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                </div>
                <span className={`text-slate-700 font-bold ${value === opt.toLowerCase() ? "text-indigo-950" : ""}`}>{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'dropdown':
        return (
          <select
            value={value}
            onChange={(e) => update(field.id, e.target.value)}
            className="w-full md:w-2/3 px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-600 focus:outline-none transition-all bg-white text-slate-700 font-bold appearance-none shadow-sm"
          >
            <option value="">Choose...</option>
            {options.map((opt) => (
              <option key={opt} value={opt.toLowerCase()}>{opt}</option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
        
        {/* Main Header Block */}
        <div className="bg-white rounded-2xl border-t-[10px] border-t-indigo-600 border border-slate-200 p-8 space-y-4 shadow-sm">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter" dangerouslySetInnerHTML={{ __html: content?.title || "Background Information" }} />
          <div className="h-1 w-full bg-slate-100 rounded-full" />
          <p className="text-slate-600 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: content?.subtitle || "Please provide some basic information before we begin." }} />
          <p className="text-red-500 text-xs font-bold uppercase tracking-widest mt-4 flex items-center gap-1">
            * Required
          </p>
        </div>

        {/* Render Dynamic Questions */}
        {content?.fields?.map((field: any) => (
          <QuestionBlock key={field.id} label={field.label}>
            {renderFieldInput(field)}
          </QuestionBlock>
        ))}

        {/* Submit Block */}
        <div className="flex flex-col items-center gap-4 py-6">
          {!isValid && (
             <p className="text-red-500 text-sm font-black italic animate-pulse" dangerouslySetInnerHTML={{ __html: content?.validation_error || "Please fill in all fields" }} />
          )}
          <button
            onClick={() => onComplete(form)}
            disabled={!isValid}
            className={`w-full md:w-auto px-12 py-4 rounded-2xl font-black text-xl transition-all shadow-xl active:scale-95 ${
              isValid
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                : "bg-white text-slate-300 border-2 border-slate-100 cursor-not-allowed"
            }`}
          >
            <span dangerouslySetInnerHTML={{ __html: content?.button_text || "Continue →" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
