import { useState, useEffect } from "react";
import type { Demographics as DemographicsData } from "../types/experiment";

interface DemoField {
  id: string;
  label: string;
  type: 'number' | 'multiple_choice' | 'dropdown' | 'short_text';
  options?: string;
  placeholder?: string;
}

interface Props {
  onComplete: (data: DemographicsData) => void;
  content?: {
    title?: string;
    subtitle?: string;
    button_text?: string;
    validation_error?: string;
    fields?: DemoField[] | Record<string, any>;
  };
}

export default function Demographics({ onComplete, content }: Props) {
  const [form, setForm] = useState<Record<string, string>>({});

  const defaultFields: DemoField[] = [
    {
      id: "age",
      label: "Age",
      type: 'number',
      placeholder: "Enter your age"
    },
    {
      id: "gender",
      label: "Gender",
      type: 'multiple_choice',
      options: "Male\nFemale\nOther"
    },
    {
      id: "education",
      label: "Education Level",
      type: 'dropdown',
      options: "Secondary school\nUndergraduate student\nBachelor's degree\nMaster's student / degree\nPhD student / degree\nOther"
    },
    {
      id: "language",
      label: "Native Language",
      type: 'dropdown',
      options: "English\nChinese (Mandarin / Cantonese)\nSpanish\nHindi\nArabic\nFrench\nJapanese\nKorean\nOther"
    },
    {
      id: "proficiency",
      label: "English Proficiency",
      type: 'multiple_choice',
      options: "Native speaker\nAdvanced (C1–C2)\nUpper-intermediate (B2)\nIntermediate (B1)\nElementary (A2)\nBeginner (A1)"
    }
  ];

  // Derive active fields with migration logic
  const activeFields: DemoField[] = (() => {
    if (!content?.fields) return defaultFields;
    
    if (Array.isArray(content.fields)) {
      return content.fields;
    }
    
    if (typeof content.fields === 'object') {
      return Object.entries(content.fields).map(([key, val]: [string, any]) => ({
        id: key,
        ...val,
        options: val.options?.includes(',') && !val.options?.includes('\n') 
          ? val.options.split(',').map((s: string) => s.trim()).join('\n')
          : val.options
      }));
    }
    
    return defaultFields;
  })();

  const displayContent = {
    title: content?.title || "Background Information",
    subtitle: content?.subtitle || "Please provide some basic information before we begin.",
    button_text: content?.button_text || "Continue →",
    validation_error: content?.validation_error || "Please fill in all fields",
    fields: activeFields
  };

  // Initialize form state when content loads
  useEffect(() => {
    const initialForm: Record<string, string> = {};
    activeFields.forEach((field: DemoField) => {
      initialForm[field.id] = "";
    });
    setForm(initialForm);
  }, [content, activeFields.length]);

  const update = (fieldId: string, value: string) => {
    setForm((prev) => ({ ...prev, [fieldId]: value }));
  };

  const parseOptions = (optionsStr: string) => {
    if (!optionsStr) return [];
    const delimiter = optionsStr.includes('\n') ? '\n' : ',';
    return optionsStr.split(delimiter).map((s) => s.trim()).filter(Boolean);
  };

  const isValid = displayContent.fields.length > 0 && 
                  displayContent.fields.every((field: DemoField) => Boolean(form[field.id]));

  // Question Block Component
  const QuestionBlock = ({ label, children }: any) => (
    <div className="bg-white rounded-[8px] border p-6 space-y-4 transition-colors" style={{ borderColor: "#dadce0" }}>
      <label className="block text-base font-medium text-[#202124] tracking-tight">
        <span dangerouslySetInnerHTML={{ __html: label }} />
        <span className="text-[#d93025] ml-1">*</span>
      </label>
      <div>
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
            placeholder={field.placeholder || "Your answer"}
            className="w-full md:w-1/2 px-0 py-1.5 border-b border-gray-300 focus:border-[#673ab7] focus:border-b-2 focus:outline-none transition-colors text-sm text-[#202124] bg-transparent"
          />
        );
      
      case 'short_text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => update(field.id, e.target.value)}
            placeholder={field.placeholder || "Your answer"}
            className="w-full md:w-2/3 px-0 py-1.5 border-b border-gray-300 focus:border-[#673ab7] focus:border-b-2 focus:outline-none transition-colors text-sm text-[#202124] bg-transparent"
          />
        );

      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {options.map((opt) => (
              <label 
                key={opt} 
                className={`flex items-center gap-3 py-1 cursor-pointer hover:bg-[#f8f9fa] rounded-md px-2 -mx-2 transition-colors`}
                onClick={() => update(field.id, opt.toLowerCase())}
              >
                <div className="relative flex items-center shrink-0">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    value === opt.toLowerCase() ? "border-[#673ab7]" : "border-[#5f6368]"
                  }`}>
                    {value === opt.toLowerCase() && <div className="w-2.5 h-2.5 rounded-full bg-[#673ab7]" />}
                  </div>
                </div>
                <span className="text-sm text-[#202124]">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'dropdown':
        return (
          <select
            value={value}
            onChange={(e) => update(field.id, e.target.value)}
            className="w-full md:w-1/2 px-3 py-2.5 border border-gray-300 rounded focus:border-[#673ab7] focus:border-2 focus:outline-none transition-all bg-white text-sm text-[#202124] appearance-none"
          >
            <option value="">Choose</option>
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
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "#f1f3f4" }}>
      <div className="max-w-[720px] mx-auto space-y-3">
        
        {/* Main Header Block */}
        <div className="bg-white rounded-[8px] border overflow-hidden" style={{ borderColor: "#dadce0" }}>
          <div className="h-[10px]" style={{ backgroundColor: "#673ab7" }} />
          <div className="p-6 space-y-3">
            <h1 className="text-3xl font-normal text-[#202124]" dangerouslySetInnerHTML={{ __html: displayContent.title }} />
            <p className="text-sm text-[#202124]" dangerouslySetInnerHTML={{ __html: displayContent.subtitle }} />
            <div className="pt-2 border-t border-gray-100 mt-4">
              <p className="text-[#d93025] text-sm font-medium">
                * Indicates required question
              </p>
            </div>
          </div>
        </div>

        {/* Render Dynamic Questions */}
        {displayContent.fields.map((field: DemoField) => (
          <QuestionBlock key={field.id} label={field.label}>
            {renderFieldInput(field)}
          </QuestionBlock>
        ))}

        {/* Submit Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <button
            onClick={() => onComplete(form)}
            disabled={!isValid}
            className={`px-6 py-2 rounded-[4px] font-medium text-sm transition-colors ${
              isValid
                ? "bg-[#673ab7] text-white hover:bg-purple-700 active:bg-purple-800"
                : "bg-[#e8eaed] text-[#9aa0a6] cursor-not-allowed"
            }`}
          >
            <span dangerouslySetInnerHTML={{ __html: content?.button_text ? content.button_text.replace("→", "").trim() : "Submit" }} />
          </button>
          
          <div className="flex-1 flex justify-end">
             {!isValid && (
               <div className="text-[#d93025] text-sm flex items-center gap-1">
                 <svg aria-hidden="true" className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>
                 <span dangerouslySetInnerHTML={{ __html: content?.validation_error || "Please fill in all required fields" }} />
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
