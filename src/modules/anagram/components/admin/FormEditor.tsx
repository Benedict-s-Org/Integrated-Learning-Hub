import { useState, useEffect } from "react";
import { useCMS } from "../../../../hooks/useCMS";
import { Save, Loader2, AlertTriangle, Eye, EyeOff, Code } from "lucide-react";
import type { FormDefinition } from "../../types/forms";
import FormRenderer from "../forms/FormRenderer";

interface Props {
  cmsKey: string;
  title: string;
  defaultForm?: FormDefinition;
}

export default function FormEditor({ cmsKey, title, defaultForm }: Props) {
  const { getContent, updateContent } = useCMS();
  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const parsedForm: FormDefinition | null = (() => {
    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  })();

  const updateForm = (updater: (draft: FormDefinition) => void) => {
    if (!parsedForm) return;
    const clone = JSON.parse(JSON.stringify(parsedForm)) as FormDefinition;
    updater(clone);
    setJsonText(JSON.stringify(clone, null, 2));
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getContent(cmsKey);
        if (data?.content) {
          setJsonText(JSON.stringify(data.content, null, 2));
        } else if (defaultForm) {
          setJsonText(JSON.stringify(defaultForm, null, 2));
        }
      } catch {
        if (defaultForm) {
          setJsonText(JSON.stringify(defaultForm, null, 2));
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [getContent, cmsKey, defaultForm]);

  // Live parse validation
  useEffect(() => {
    try {
      JSON.parse(jsonText);
      setParseError(null);
    } catch (err: any) {
      setParseError(err.message);
    }
  }, [jsonText]);

  const handleSave = async () => {
    let parsed: FormDefinition;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      setParseError(err.message);
      return;
    }
    setIsSaving(true);
    await updateContent(cmsKey, parsed, `Form definition for ${title}`);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Replaced previewDef block with parsedForm inline computation

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        <Loader2 className="animate-spin inline-block mr-2" /> Loading Form Editor...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="bg-white rounded-3xl border-t-[12px] border-t-purple-600 border border-slate-200 shadow-sm p-8 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1 flex-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <Code className="text-purple-600" size={28} />
              {title}
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              CMS Key: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs font-bold">{cmsKey}</code>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all active:scale-95"
            >
              {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !!parseError}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black transition-all shadow-lg shadow-purple-100 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-bold animate-in fade-in">
            ✅ Saved successfully!
          </div>
        )}
      </div>

      {/* Editor Tabs Workspace */}
      <div className="space-y-4">
        {/* Editor Mode Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-200 shadow-inner">
          <button
            onClick={() => setEditorMode("visual")}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
              editorMode === "visual" ? "bg-white text-purple-700 shadow flex items-center gap-2" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Visual Builder
          </button>
          <button
            onClick={() => setEditorMode("json")}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${
              editorMode === "json" ? "bg-white text-purple-700 shadow flex items-center gap-2" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Advanced JSON
          </button>
        </div>

        {editorMode === "json" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 animate-in fade-in">
            <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">Raw JSON Definition</h3>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={24}
              spellCheck={false}
              className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 resize-y transition-all"
              style={{ tabSize: 2 }}
            />
            {parseError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>JSON error: {parseError}</span>
              </div>
            )}
          </div>
        )}

        {editorMode === "visual" && parsedForm && (
          <div className="space-y-4 animate-in fade-in">
            {/* Form Settings */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase border-b border-slate-100 pb-2">Form-Level Settings</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative flex items-center mt-0.5">
                    <input
                      type="checkbox"
                      checked={parsedForm.navigation?.mode === "sections"}
                      onChange={(e) => updateForm((draft) => {
                        draft.navigation = draft.navigation || { mode: "single_page" };
                        draft.navigation.mode = e.target.checked ? "sections" : "single_page";
                      })}
                      className="peer h-[20px] w-[20px] cursor-pointer appearance-none rounded border-2 border-slate-300 checked:border-purple-600 checked:bg-purple-600 transition-all"
                    />
                    <svg className="absolute left-[3px] top-[3px] h-3.5 w-3.5 stroke-white opacity-0 transition-opacity peer-checked:opacity-100 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <span className="text-sm text-slate-700 font-bold">Enable Pagination (Sections mode)</span>
                </label>
              </div>
            </div>

            {/* Sections Manager */}
            <div className="flex xl:flex-row flex-col gap-6 items-start">
              {/* Left sidebar: Sections List */}
              <div className="xl:w-1/3 w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm min-h-[300px]">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Sections</h3>
                <div className="space-y-2">
                  {parsedForm.sections.map((sec, idx) => (
                    <button
                      key={sec.id}
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-bold transition-all truncate ${
                        selectedSectionId === sec.id 
                          ? "bg-white border-purple-300 text-purple-700 shadow-sm ring-1 ring-purple-100" 
                          : "bg-white border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800 shadow-sm"
                      }`}
                    >
                      {idx + 1}. {sec.title || "Untitled Section"}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const newId = `sec_${Date.now()}`;
                      updateForm(draft => {
                        draft.sections.push({ id: newId, title: "New Section", items: [] });
                      });
                      setSelectedSectionId(newId);
                    }}
                    className="w-full text-center px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50 text-sm font-bold transition-all"
                  >
                    + Add Section
                  </button>
                </div>
              </div>

              {/* Right Panel: Selected Section */}
              <div className="xl:w-2/3 w-full">
                {selectedSectionId ? (
                  (() => {
                    const secIndex = parsedForm.sections.findIndex(s => s.id === selectedSectionId);
                    const sec = parsedForm.sections[secIndex];
                    if (!sec) return <div className="text-slate-500 p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 border-dashed">Section not found. Select another.</div>;
                    
                    return (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                          <h3 className="text-lg font-black text-slate-800">Section Settings</h3>
                          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md font-mono">{sec.id}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Title</label>
                            <input 
                              type="text" 
                              value={sec.title || ""} 
                              onChange={(e) => updateForm(draft => { draft.sections[secIndex].title = e.target.value; })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium text-slate-800 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all"
                              placeholder="Section title"
                            />
                          </div>
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                            <textarea 
                              value={sec.description || ""} 
                              onChange={(e) => updateForm(draft => { draft.sections[secIndex].description = e.target.value; })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium text-slate-800 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all resize-none"
                              rows={2}
                              placeholder="Optional description"
                            />
                          </div>
                          {parsedForm.navigation?.mode === "sections" && (
                            <>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Next Button Text</label>
                                <input 
                                  type="text" 
                                  value={sec.nextButtonText || ""} 
                                  onChange={(e) => updateForm(draft => { draft.sections[secIndex].nextButtonText = e.target.value; })}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium text-slate-800 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all"
                                  placeholder="e.g. Continue"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Back Button Text</label>
                                <input 
                                  type="text" 
                                  value={sec.backButtonText || ""} 
                                  onChange={(e) => updateForm(draft => { draft.sections[secIndex].backButtonText = e.target.value; })}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-medium text-slate-800 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all"
                                  placeholder="e.g. Go Back"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                          <p className="text-sm font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                            {sec.items.length} item{sec.items.length !== 1 ? 's' : ''} in this section
                          </p>
                          <button
                            onClick={() => {
                              updateForm(draft => {
                                draft.sections[secIndex].items.push({
                                  type: "short_text",
                                  id: `item_${Date.now()}`,
                                  title: "New Question",
                                  required: false
                                });
                              });
                            }}
                            className="bg-purple-100 text-purple-700 hover:bg-purple-200 hover:text-purple-800 px-4 py-2 font-bold text-sm rounded-xl transition-colors shadow-sm"
                          >
                            + Add Question
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center animate-in fade-in">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                      <Code size={32} />
                    </div>
                    <h4 className="text-lg font-black text-slate-600">No Section Selected</h4>
                    <p className="text-slate-400 text-sm font-medium mt-1">Select a section from the left sidebar to edit its settings and add questions.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {editorMode === "visual" && !parsedForm && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-600 font-bold">
            <AlertTriangle size={32} className="mx-auto mb-3 opacity-80" />
            Cannot load Visual Builder due to JSON errors. <br/> Please switch to Advanced JSON mode and fix the errors first.
          </div>
        )}
      </div>

      {/* Preview */}
      {showPreview && parsedForm && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 pt-6 mt-6 border-t-[3px] border-slate-200 border-dashed">
          <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase px-1">Live Preview</h3>
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xl">
            <FormRenderer
              definition={parsedForm}
              onSubmit={(data) => {
                console.log("[FormEditor Preview] Submit:", data);
                alert("Preview submit logged to console.");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
