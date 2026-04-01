import React, { useState, useRef } from "react";
import { 
  Volume2, 
  Sparkles, 
  Play, 
  Trash2, 
  Loader2, 
  ChevronLeft, 
  Database,
  Info,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  Plus,
  X
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { fetchCloudAudio, ACCENT_OPTIONS, PREMIUM_VOICES } from "../../utils/voiceManager";
import { usePhonicsMappings } from "../../hooks/usePhonicsMappings";

interface PhonicsGeneratorProps {
  onBack: () => void;
}

interface PhonicsItem {
  id: string;
  grapheme: string;
  phoneme: string;
  category: "vowel" | "consonant" | "digraph" | "blend";
  level: number;
  status: "pending" | "generating" | "ready" | "saving" | "saved" | "error";
  audioUrl?: string;
  error?: string;
}

const IPA_MAPPINGS: Record<string, string> = {
  "a": "æ",
  "e": "ɛ",
  "i": "ɪ",
  "o": "ɒ",
  "u": "ʌ",
  "sh": "ʃ",
  "ch": "tʃ",
  "th_unvoiced": "θ",
  "th_voiced": "ð",
  "ng": "ŋ",
  "zh": "ʒ"
};

export const PhonicsDashboard: React.FC<PhonicsGeneratorProps> = ({ onBack }) => {
  useAuth();
  const [activeTab, setActiveTab] = useState<"generator" | "manager">("generator");
  const [inputText, setInputText] = useState("");
  const [items, setItems] = useState<PhonicsItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [accent, setAccent] = useState("en-GB");
  const [voiceName, setVoiceName] = useState("en-GB-Neural2-B");
  const [speakingRate, setSpeakingRate] = useState(0.8);
  const [globalCategory, setGlobalCategory] = useState<PhonicsItem["category"]>("vowel");
  const [globalLevel, setGlobalLevel] = useState(1);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [linkingItem, setLinkingItem] = useState<PhonicsItem | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const handleParseInput = () => {
    const lines = inputText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const newItems: PhonicsItem[] = lines.map(line => {
      const parts = line.split("|").map(p => p.trim());
      return {
        id: crypto.randomUUID(),
        grapheme: parts[0],
        phoneme: parts.length > 1 ? parts[1] : parts[0],
        category: (parts.length > 2 && ["vowel", "consonant", "digraph", "blend"].includes(parts[2])) 
          ? parts[2] as any 
          : globalCategory,
        level: (parts.length > 3 && !isNaN(parseInt(parts[3]))) 
          ? parseInt(parts[3]) 
          : globalLevel,
        status: "pending"
      };
    });
    setItems(prev => [...prev, ...newItems]);
    setInputText("");
  };

  const getSSMLForPhoneme = (phoneme: string) => {
    // If it already looks like a complex IPA string or SSML, we might just wrap it
    // But for simplicity, we assume the user provides the IPA symbol or we map it
    const ipa = IPA_MAPPINGS[phoneme.toLowerCase()] || phoneme;
    return `<speak><phoneme alphabet="ipa" ph="${ipa}">${ipa}</phoneme></speak>`;
  };

  const generateSingleItem = async (index: number) => {
    const item = items[index];
    if (item.status === "generating") return;

    const newItems = [...items];
    newItems[index].status = "generating";
    setItems(newItems);

    try {
      const ssml = getSSMLForPhoneme(item.phoneme);
      const audioUrl = await fetchCloudAudio(ssml, accent, voiceName, speakingRate, true);
      
      if (audioUrl) {
        const finalItems = [...items];
        finalItems[index].audioUrl = audioUrl;
        finalItems[index].status = "ready";
        setItems(finalItems);
      } else {
        throw new Error("Failed to fetch audio");
      }
    } catch (err: any) {
      const finalItems = [...items];
      finalItems[index].status = "error";
      finalItems[index].error = err.message;
      setItems(finalItems);
    }
  };

  const handleGenerateAll = async () => {
    setIsProcessing(true);
    setProgress(0);
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].status === "ready" || items[i].status === "saved") continue;
        await generateSingleItem(i);
        setProgress(((i + 1) / items.length) * 100);
    }
    
    setIsProcessing(false);
  };

  const handleSaveToDB = async () => {
    const readyItems = items.filter(i => i.status === "ready" && i.audioUrl);
    if (readyItems.length === 0) return;

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const { error } = await (supabase as any).from("phonics_mappings").upsert(
        readyItems.map(item => ({
          grapheme: item.grapheme,
          phoneme: item.phoneme,
          category: item.category,
          level: item.level,
          audio_url: item.audioUrl,
        })),
        { onConflict: "grapheme,phoneme,category,level" }
      );

      if (error) throw error;

      setItems(prev => prev.map(item => 
        item.status === "ready" ? { ...item, status: "saved" } : item
      ));
      
      setStatusMessage({ type: "success", text: `Successfully saved ${readyItems.length} items to database.` });
    } catch (err: any) {
      console.error("Save to DB failed:", err);
      setStatusMessage({ type: "error", text: `Failed to save: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayPreview = (url: string) => {
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play();
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const clearAll = () => {
    if (window.confirm("Clear all items?")) {
      setItems([]);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-8 pb-32">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Shared Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                <Volume2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Phonics Dashboard</h1>
                <p className="text-slate-500 text-sm">Unified tool for generating and managing phonics audio</p>
              </div>
            </div>
          </div>
          
          {activeTab === "generator" && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={clearAll} disabled={items.length === 0 || isProcessing}>
                Clear List
              </Button>
              <Button 
                variant="gold" 
                onClick={handleGenerateAll} 
                disabled={items.length === 0 || isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                Generate All
              </Button>
            </div>
          )}
        </div>
        {/* Tabs */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit mx-auto">
          <button 
            onClick={() => setActiveTab("generator")}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "generator" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Audio Generator
          </button>
          <button 
            onClick={() => setActiveTab("manager")}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === "manager" ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sound Wall Manager
          </button>
        </div>

        {activeTab === "generator" ? (
          <>
            {/* Status Messages */}
            {isProcessing && progress > 0 && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between text-sm mb-2 text-slate-600">
                  <span>Generating Audio...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300 ease-in-out" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {statusMessage && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in duration-300 ${
                statusMessage.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {statusMessage.type === "success" ? <CheckCircle2 size={20} /> : <Info size={20} />}
                <p className="text-sm font-medium">{statusMessage.text}</p>
                <button className="ml-auto" onClick={() => setStatusMessage(null)}>×</button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input & Settings Panel */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Sound Input</h2>
                  <p className="text-xs text-slate-500 mb-3">Format: <code className="bg-slate-100 px-1 py-0.5 rounded">grapheme \| phoneme_or_ipa \| category \| level</code></p>
                  
                  <textarea
                    className="w-full h-40 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium text-slate-700 mb-4 text-sm"
                    placeholder="a | æ | vowel | 1&#10;sh | ʃ | digraph | 1"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Default Cat.</label>
                      <select 
                        value={globalCategory} 
                        onChange={e => setGlobalCategory(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="vowel">Vowel</option>
                        <option value="consonant">Consonant</option>
                        <option value="digraph">Digraph</option>
                        <option value="blend">Blend</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Default Level</label>
                      <select 
                        value={globalLevel} 
                        onChange={e => setGlobalLevel(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="1">L1 Beginner</option>
                        <option value="2">L2 Intermediate</option>
                        <option value="3">L3 Advanced</option>
                        <option value="4">L4 Mastery</option>
                      </select>
                    </div>
                  </div>

                  <Button 
                    variant="primary" 
                    className="w-full"
                    onClick={handleParseInput}
                    disabled={!inputText.trim()}
                  >
                    Add to List
                  </Button>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Voice Settings</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Accent</label>
                      <select 
                        value={accent} 
                        onChange={e => {
                          setAccent(e.target.value);
                          setVoiceName(PREMIUM_VOICES[e.target.value]?.[0]?.id || "");
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {ACCENT_OPTIONS.map(opt => (
                          <option key={opt.code} value={opt.code}>{opt.flag} {opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Neural Voice</label>
                      <select 
                        value={voiceName} 
                        onChange={e => setVoiceName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {(PREMIUM_VOICES[accent] || []).map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Speaking Rate: {speakingRate}</label>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="1.5" 
                      step="0.1" 
                      value={speakingRate} 
                      onChange={e => setSpeakingRate(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* List Panel */}
            <div className="lg:col-span-2 flex flex-col min-h-0">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    Generated Items
                    <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs">
                      {items.length}
                    </span>
                  </h3>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      className="flex items-center gap-2"
                      onClick={handleSaveToDB}
                      disabled={isProcessing || !items.some(i => i.status === "ready")}
                    >
                      <Database size={14} />
                      Sync to Database
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-[400px] max-h-[600px]">
                  {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                      <Volume2 size={48} className="mb-4 opacity-20" />
                      <p>No items added yet</p>
                      <p className="text-xs">Use the input panel on the left to start</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className={`p-3 rounded-xl border flex items-center gap-4 transition-all ${
                            item.status === "saved" ? "bg-green-50 border-green-100" : "bg-white border-slate-100"
                          }`}
                        >
                          <div className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 text-xs font-bold rounded-lg shrink-0">
                            {idx + 1}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-slate-800">{item.grapheme}</span>
                              <span className="text-indigo-500 font-mono text-sm">/{item.phoneme}/</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">{item.category}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400">Level {item.level}</span>
                              {item.status === "saved" && (
                                <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                  <CheckCircle2 size={10} /> Saved
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(item.status === "ready" || item.status === "saved") && (
                              <button
                                onClick={() => setLinkingItem(item)}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                                title="Link to Sound Wall"
                              >
                                <Plus size={18} />
                              </button>
                            )}

                            {item.status === "ready" || item.status === "saved" ? (
                              <button
                                onClick={() => handlePlayPreview(item.audioUrl!)}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                              >
                                <Play size={18} fill="currentColor" />
                              </button>
                            ) : item.status === "generating" ? (
                              <div className="p-2">
                                <Loader2 className="animate-spin text-indigo-400" size={18} />
                              </div>
                            ) : item.status === "error" ? (
                              <div className="group relative">
                                <Info className="text-red-400 cursor-help" size={18} />
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.error}
                                </div>
                              </div>
                            ) : null}

                            <button 
                              onClick={() => removeItem(item.id)}
                              className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors rounded-lg"
                              disabled={isProcessing}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <PhonicsManager onPlayPreview={handlePlayPreview} />
      )}
      </div>

      <audio ref={audioRef} className="hidden" />

      {linkingItem && (
        <ManualLinkingModal 
          item={linkingItem} 
          onClose={() => setLinkingItem(null)} 
          onSuccess={() => {
            setLinkingItem(null);
            setStatusMessage({ type: "success", text: "Successfully linked phonemes!" });
          }}
        />
      )}
    </div>
  );
};

export default PhonicsDashboard;

// ─── Sub-Component: Phonics Manager ───

const PhonicsManager: React.FC<{ onPlayPreview: (url: string) => void }> = ({ onPlayPreview }) => {
  const { fetchAllMappings, mappings, isLoading } = usePhonicsMappings();
  const [searchTerm, setSearchTerm] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  React.useEffect(() => {
    fetchAllMappings();
  }, [fetchAllMappings]);

  const filteredMappings = mappings.filter(m => 
    m.grapheme.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.phoneme.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAutoLink = async () => {
    const unlinked = mappings.filter(m => !m.audio_url);
    if (unlinked.length === 0) {
      alert("All mappings already have audio!");
      return;
    }

    if (!window.confirm(`Attempt to auto-link ${unlinked.length} sounds from cache?`)) return;

    setIsLinking(true);
    setSyncStatus("Searching cache...");
    let linkedCount = 0;

    try {
      for (const mapping of unlinked) {
        // Use the global IPA_MAPPINGS
        const ipa = IPA_MAPPINGS[mapping.phoneme.toLowerCase()] || mapping.phoneme;
        const ssml = `<speak><phoneme alphabet="ipa" ph="${ipa}">${ipa}</phoneme></speak>`;

        // Look for this SSML in tts_cache
        const { data: cacheData } = await (supabase as any)
          .from("tts_cache")
          .select("audio_url")
          .eq("text", ssml)
          .maybeSingle();

        if (cacheData?.audio_url) {
          // Link it!
          await (supabase as any)
            .from("phonics_mappings")
            .update({ audio_url: cacheData.audio_url })
            .eq("id", mapping.id);
          linkedCount++;
        }
      }
      
      setSyncStatus(`Successfully linked ${linkedCount} sounds!`);
      fetchAllMappings();
    } catch (err) {
      console.error("Auto-link failed:", err);
      setSyncStatus("Sync failed. Check console.");
    } finally {
      setIsLinking(false);
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Sound Wall Manager</h2>
            <p className="text-slate-500 text-sm">Verify and link audio for all Phonics Wall tiles</p>
          </div>
          
          <div className="flex gap-2">
            <Button 
                variant="secondary" 
                onClick={() => fetchAllMappings()} 
                disabled={isLoading}
                className="flex items-center gap-2"
            >
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
              Refresh
            </Button>
            <Button 
                variant="gold" 
                onClick={handleAutoLink} 
                disabled={isLinking || isLoading}
                className="flex items-center gap-2"
            >
              {isLinking ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Auto-Link Cache
            </Button>
          </div>
        </div>

        {syncStatus && (
          <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl text-sm font-medium flex items-center gap-2">
            <Info size={16} />
            {syncStatus}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search grapheme or phoneme..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-sm font-medium text-slate-500">
            {filteredMappings.length} / {mappings.length} items
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Level</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Sound</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Audio Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                    <p className="text-slate-400">Loading mappings...</p>
                  </td>
                </tr>
              ) : filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <p className="text-slate-400">No mappings found matching your search</p>
                  </td>
                </tr>
              ) : (
                filteredMappings.map(mapping => (
                  <tr key={mapping.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                        Level {mapping.level}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-slate-800">{mapping.grapheme}</span>
                        <span className="text-indigo-500 font-mono text-sm">/{mapping.phoneme}/</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-xs font-semibold text-slate-500 capitalize">{mapping.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      {mapping.audio_url ? (
                        <div className="flex items-center gap-2 text-green-600 text-xs font-bold">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          Linked
                          <button 
                            onClick={() => onPlayPreview(mapping.audio_url!)}
                            className="p-1 hover:bg-green-100 rounded transition-colors"
                          >
                            <Volume2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                          Missing Audio
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Plus size={18} />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <ExternalLink size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-Component: Manual Linking Modal ───

const ManualLinkingModal: React.FC<{ 
  item: PhonicsItem; 
  onClose: () => void; 
  onSuccess: () => void;
}> = ({ item, onClose, onSuccess }) => {
  const { mappings, fetchAllMappings, isLoading } = usePhonicsMappings();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLinking, setIsLinking] = useState(false);

  React.useEffect(() => {
    fetchAllMappings();
  }, [fetchAllMappings]);

  const filteredMappings = mappings.filter(m => 
    m.grapheme.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.phoneme.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLink = async () => {
    if (selectedIds.size === 0) return;
    setIsLinking(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await (supabase as any)
        .from("phonics_mappings")
        .update({ audio_url: item.audioUrl })
        .in("id", idsArray);

      if (error) throw error;
      onSuccess();
    } catch (err) {
      console.error("Manual linking failed:", err);
      alert("Failed to link phonics. Check console.");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Link to Sound Wall</h3>
            <p className="text-sm text-slate-500">Pick which tiles should play this audio for /{item.phoneme}/</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search grapheme or phoneme..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center text-slate-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Loading Sound Wall...</p>
            </div>
          ) : filteredMappings.length === 0 ? (
            <div className="py-12 text-center text-slate-400">No matching phonemes found</div>
          ) : (
            filteredMappings.map(m => (
              <label 
                key={m.id} 
                className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedIds.has(m.id) ? "bg-indigo-50 border-indigo-200 shadow-sm" : "bg-white border-slate-100 hover:border-slate-300"
                }`}
              >
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selectedIds.has(m.id)}
                  onChange={() => toggleSelection(m.id)}
                />
                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                  selectedIds.has(m.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"
                }`}>
                  {selectedIds.has(m.id) && <CheckCircle2 size={14} strokeWidth={3} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-800">{m.grapheme}</span>
                    <span className="text-indigo-500 font-mono">/{m.phoneme}/</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">{m.category}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Level {m.level}</span>
                    {m.audio_url && (
                      <span className="text-[10px] text-green-600 font-bold ml-auto opacity-70 flex items-center gap-1">
                        <Volume2 size={10} /> Already Linked
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isLinking}>
            Cancel
          </Button>
          <Button 
            variant="gold" 
            className="flex-1 flex items-center justify-center gap-2" 
            onClick={handleLink}
            disabled={selectedIds.size === 0 || isLinking}
          >
            {isLinking && <Loader2 size={18} className="animate-spin" />}
            Link {selectedIds.size} Phoneme{selectedIds.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
};

