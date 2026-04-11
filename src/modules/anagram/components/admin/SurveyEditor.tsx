import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, ClipboardCheck, Info, MessageSquare, HelpCircle, Type, Plus, Trash2, GripVertical, CheckCircle2, AlertCircle } from "lucide-react";
import RichTextEditor from "./RichTextEditor";

interface CustomQuestion {
  id: string;
  label: string;
  min: number;
  max: number;
  lowLabel: string;
  highLabel: string;
  enabled: boolean;
}

const DesignerCard = ({ icon: Icon, title, sectionId, children, borderColor = "border-l-indigo-500" }: any) => (
  <div className={`bg-white rounded-2xl border-l-[6px] ${borderColor} border border-slate-200 shadow-sm overflow-hidden group transition-all hover:shadow-md`}>
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
            <Icon size={18} />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800 tracking-tight">{title}</h4>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sectionId}</span>
          </div>
        </div>
      </div>
      <div className="space-y-4 pt-2">
        {children}
      </div>
    </div>
  </div>
);

export default function SurveyEditor() {
  const { getContent, updateContent } = useCMS();
  const [content, setContent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const data = await getContent("anagram_survey");
      const defaultContent = {
        title: "Post-Task Questionnaire",
        subtitle: "Please answer the following questions honestly. There are no right or wrong answers.",
        sections: {
          optimism: {
            title: "🌟 Optimism Scale",
            description: "Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)"
          },
          thinking: {
            title: "🧠 Thinking Style",
            description: "Rate how much you agree with each statement (1 = Strongly Disagree, 7 = Strongly Agree)"
          },
          perception: {
            title: "📊 Task Perception",
            description: "How difficult did you find each task? (1 = Very Easy, 7 = Very Difficult)"
          },
          experience: {
            title: "📚 Past Experience",
            description: "Tell us about your previous background."
          },

        },
        option_self: "Myself",
        option_other: "Other Students",
        option_unsure: "I'm not sure",
        customQuestions: [],
        button_text: "Complete & View Analysis →"
      };

      if (data && data.content) {
        // Deep merge/ensure nested structure exists
        const merged = { ...defaultContent, ...data.content };
        merged.sections = { ...defaultContent.sections, ...data.content.sections };
        setContent(merged);
      } else {
        setContent(defaultContent);
      }
    };
    load();
  }, [getContent]);

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    const result = await updateContent("anagram_survey", content, "Updated survey with advanced sections and custom questions");
    setIsSaving(false);
    
    if (result.success) {
      setSaveStatus({ type: 'success', message: "Survey settings updated successfully!" });
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus({ type: 'error', message: `Failed to save: ${result.error || 'Unknown error'}` });
    }
  };

  const addCustomQuestion = () => {
    const newId = `q_${Math.random().toString(36).substring(2, 7)}`;
    const newField: CustomQuestion = {
      id: newId,
      label: "My Custom Question",
      min: 1,
      max: 7,
      lowLabel: "Disagree",
      highLabel: "Agree",
      enabled: true
    };
    setContent({
      ...content,
      customQuestions: [...(content.customQuestions || []), newField]
    });
  };

  const deleteCustomQuestion = (id: string) => {
    if (!confirm("Remove this custom question?")) return;
    setContent({
      ...content,
      customQuestions: content.customQuestions.filter((q: CustomQuestion) => q.id !== id)
    });
  };

  const updateCustomQuestion = (id: string, updates: Partial<CustomQuestion>) => {
    setContent({
      ...content,
      customQuestions: content.customQuestions.map((q: CustomQuestion) => q.id === id ? { ...q, ...updates } : q)
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
              <ClipboardCheck className="text-indigo-600" size={32} />
              Advanced Survey Designer
            </h2>
            <p className="text-slate-500 text-sm font-medium">Design the psychometric scales and custom questions.</p>
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

        {saveStatus && (
          <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 overflow-hidden ${
            saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              saveStatus.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'
            }`}>
              {saveStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </div>
            <p className="text-sm font-black">{saveStatus.message}</p>
          </div>
        )}

        <div className="space-y-6 pt-6 border-t border-slate-100">
          <RichTextEditor
            label="Survey Title"
            value={content.title}
            onChange={(v) => setContent({ ...content, title: v })}
          />
          <RichTextEditor
            label="Survey Subtitle"
            multiline
            rows={2}
            value={content.subtitle}
            onChange={(v) => setContent({ ...content, subtitle: v })}
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Core Sections List */}
        {[
          { key: 'optimism', icon: Info, title: "Optimism Scale", border: "border-l-blue-500" },
          { key: 'thinking', icon: HelpCircle, title: "Thinking Style (NFC)", border: "border-l-emerald-500" },
          { key: 'perception', icon: MessageSquare, title: "Task Perception", border: "border-l-amber-500" },
          { key: 'experience', icon: Type, title: "Past Experience", border: "border-l-violet-500" }
        ].map((sec, idx) => (
          <DesignerCard key={sec.key} icon={sec.icon} title={sec.title} sectionId={`Core Section ${idx + 1}`} borderColor={sec.border}>
             <RichTextEditor
                label="Section Display Title"
                value={content.sections[sec.key].title}
                onChange={(v) => setContent({ 
                    ...content, 
                    sections: { ...content.sections, [sec.key]: { ...content.sections[sec.key], title: v } }
                })}
              />
              <RichTextEditor
                label="Section Instruction Description"
                multiline
                rows={2}
                value={content.sections[sec.key].description}
                onChange={(v) => setContent({ 
                    ...content, 
                    sections: { ...content.sections, [sec.key]: { ...content.sections[sec.key], description: v } }
                })}
              />

          </DesignerCard>
        ))}

        {/* Custom Questions Section */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Custom Researcher Questions</h3>
            <button 
              onClick={addCustomQuestion}
              className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full"
            >
              <Plus size={14} /> Add Question
            </button>
          </div>

          {(content.customQuestions || []).map((q: CustomQuestion) => (
            <div key={q.id} className="bg-white rounded-2xl border-l-[6px] border-l-slate-300 border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <GripVertical className="text-slate-200 cursor-grab" size={20} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{q.id}</span>
                  </div>
                  <button 
                    onClick={() => deleteCustomQuestion(q.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="space-y-4">
                  <RichTextEditor
                    label="Question Label"
                    value={q.label}
                    onChange={(v) => updateCustomQuestion(q.id, { label: v })}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Min Value</label>
                      <input 
                        type="number"
                        value={q.min}
                        onChange={(e) => updateCustomQuestion(q.id, { min: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Value</label>
                      <input 
                        type="number"
                        value={q.max}
                        onChange={(e) => updateCustomQuestion(q.id, { max: parseInt(e.target.value) || 7 })}
                        className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm"
                      />
                    </div>
                    <RichTextEditor
                      label="Low Label"
                      value={q.lowLabel}
                      onChange={(v) => updateCustomQuestion(q.id, { lowLabel: v })}
                    />
                    <RichTextEditor
                      label="High Label"
                      value={q.highLabel}
                      onChange={(v) => updateCustomQuestion(q.id, { highLabel: v })}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button 
            onClick={addCustomQuestion}
            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-slate-50 transition-all font-bold flex items-center justify-center gap-2 group"
          >
            <Plus size={20} /> Add Another Question
          </button>
        </div>

        {/* Submit Setting Card */}
        <DesignerCard icon={Save} title="Finalization" sectionId="Section 3" borderColor="border-l-emerald-500">
           <RichTextEditor
              label="Complete Button Text"
              value={content.button_text}
              onChange={(v) => setContent({ ...content, button_text: v })}
            />
        </DesignerCard>
      </div>

      {/* Info Tip */}
      <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-start gap-4 text-indigo-700">
        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm">
           <Info size={24} className="text-indigo-600" />
        </div>
        <div className="space-y-1">
          <h5 className="font-extrabold tracking-tight">Psychometric Note</h5>
          <p className="text-sm font-medium leading-relaxed opacity-80">
            Psychometric scales (Optimism and Thinking) are used to correlate personality traits with the observed planning fallacy. Ensure the instruction labels are clear to participants.
          </p>
        </div>
      </div>
    </div>
  );
}
