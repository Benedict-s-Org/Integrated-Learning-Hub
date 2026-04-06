import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, Users, Type, Plus, Trash2, GripVertical } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

type QuestionType = 'number' | 'multiple_choice' | 'dropdown' | 'short_text';

interface DemoField {
  id: string;
  label: string;
  type: QuestionType;
  options?: string;
  placeholder?: string;
}

export default function DemographicsEditor() {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent("anagram_demographics");
      
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

      if (data && data.content) {
        let fields: DemoField[] = [];
        
        // Migration logic for Object to Array
        if (Array.isArray(data.content.fields)) {
          fields = data.content.fields;
        } else if (data.content.fields && typeof data.content.fields === 'object') {
          // Map old object keys to array
          fields = Object.entries(data.content.fields).map(([key, val]: [string, any]) => ({
            id: key,
            ...val,
            // Ensure options are newline-separated
            options: val.options?.includes(',') && !val.options?.includes('\n') 
              ? val.options.split(',').map((s: string) => s.trim()).join('\n')
              : val.options
          }));
        } else {
          fields = defaultFields;
        }

        setContent({
          ...data.content,
          fields
        });
      } else {
        setContent({
          title: "Background Information",
          subtitle: "Please provide some basic information before we begin.",
          button_text: "Continue →",
          validation_error: "Please fill in all fields",
          fields: defaultFields
        });
      }
    };
    load();
  }, [getContent]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateContent("anagram_demographics", content, "Updated demographics with dynamic fields");
    setIsSaving(false);
    alert("Demographics settings updated!");
  };

  const addQuestion = () => {
    const newId = `custom_${Math.random().toString(36).substring(2, 7)}`;
    const newField: DemoField = {
      id: newId,
      label: "New Question",
      type: 'short_text',
      placeholder: "Type your answer..."
    };
    setContent({
      ...content,
      fields: [...content.fields, newField]
    });
  };

  const deleteQuestion = (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    setContent({
      ...content,
      fields: content.fields.filter((f: DemoField) => f.id !== id)
    });
  };

  const updateField = (id: string, updates: Partial<DemoField>) => {
    setContent({
      ...content,
      fields: content.fields.map((f: DemoField) => f.id === id ? { ...f, ...updates } : f)
    });
  };

  if (!content) return <div className="p-8 text-center text-slate-500 font-medium"><Loader2 className="animate-spin inline-block mr-2" /> Loading Designer...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Block */}
      <div className="bg-white rounded-3xl border-t-[12px] border-t-indigo-600 border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight italic flex items-center gap-3">
              <Type className="text-indigo-600" size={32} />
              Demographics Designer
            </h2>
            <p className="text-slate-500 text-sm font-medium">Design your participant background information screen.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            <span>Save Designer</span>
          </button>
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-100">
          <RichTextEditor
            label="Form Title"
            value={content.title}
            onChange={(v) => setContent({ ...content, title: v })}
          />
          <RichTextEditor
            label="Form Description"
            multiline
            rows={2}
            value={content.subtitle}
            onChange={(v) => setContent({ ...content, subtitle: v })}
          />
        </div>
      </div>

      {/* Question Blocks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Question List</h3>
          <button 
            onClick={addQuestion}
            className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full"
          >
            <Plus size={14} /> Add Question
          </button>
        </div>

        {content.fields.map((field: DemoField) => (
          <div key={field.id} className="bg-white rounded-2xl border-l-[6px] border-l-indigo-500 border border-slate-200 shadow-sm overflow-hidden group transition-all hover:shadow-md">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-400 transition-colors">
                    <GripVertical size={20} />
                  </div>
                  <div className="flex items-center gap-2">
                     <input 
                        value={field.id}
                        onChange={(e) => updateField(field.id, { id: e.target.value })}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-slate-50 border-none rounded px-1.5 py-0.5 w-max focus:ring-1 focus:ring-indigo-300"
                        title="Internal ID used for data export"
                     />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                    <select 
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value as QuestionType })}
                      className="text-xs font-bold text-slate-700 bg-slate-50 border-none rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="number">Numeric</option>
                      <option value="short_text">Short Text</option>
                      <option value="multiple_choice">Buttons</option>
                      <option value="dropdown">Dropdown</option>
                    </select>
                  </div>
                  <button 
                    onClick={() => deleteQuestion(field.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                    title="Remove Question"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <RichTextEditor
                  label="Question Label"
                  value={field.label}
                  onChange={(v) => updateField(field.id, { label: v })}
                />

                {(field.type === 'multiple_choice' || field.type === 'dropdown') && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Options (One per line)
                    </label>
                    <textarea
                      className="w-full min-h-[100px] p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none transition-all font-medium text-slate-700 text-sm"
                      placeholder="Option 1&#10;Option 2&#10;Option 3"
                      value={field.options || ""}
                      onChange={(e) => updateField(field.id, { options: e.target.value })}
                    />
                  </div>
                )}

                {(field.type === 'number' || field.type === 'short_text') && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Placeholder Text
                    </label>
                    <input
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none transition-all font-medium text-slate-700 text-sm"
                      placeholder="e.g. Enter your age"
                      value={field.placeholder || ""}
                      onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <button 
          onClick={addQuestion}
          className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-slate-50 transition-all font-bold flex items-center justify-center gap-2 group"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all">
            <Plus size={20} />
          </div>
          Add Another Question
        </button>
      </div>

      {/* Button Customization */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 tracking-tight">Form Settings</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submit & Validation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RichTextEditor
            label="Submit Button Text"
            value={content.button_text}
            onChange={(v) => setContent({ ...content, button_text: v })}
          />
          <RichTextEditor
            label="Validation Error Message"
            value={content.validation_error}
            onChange={(v) => setContent({ ...content, validation_error: v })}
          />
        </div>
      </div>
    </div>
  );
}
