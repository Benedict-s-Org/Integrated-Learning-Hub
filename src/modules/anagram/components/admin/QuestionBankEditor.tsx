import { useState, useEffect, useRef } from "react";
import { fetchQuestions, NotionQuestion, updateValidAnswers } from "../../services/notionLogger";
import {
  Loader2, Brain, Sparkles, Info, ExternalLink,
  RefreshCw, Database, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Copy, Check, X, ArrowUp
} from "lucide-react";
import { AnagramAssistant } from "./AnagramAssistant";
import { findAnagramsBulk, isPotentialSimpleInflection } from "../../../../utils/anagramFinder";
import { checkWord } from "../../../../utils/dictionaryApi";

const STORAGE_KEY = "anagram_notion_db_id";
const DEFAULT_DB_ID = "d7ea40d03cde4e54b8a6226ac75130cc";

type FetchStatus = "idle" | "loading" | "success" | "error";

export default function QuestionBankEditor() {
  const [content, setContent] = useState<{ easy: NotionQuestion[]; hard: NotionQuestion[] } | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeSet, setActiveSet] = useState<"easy" | "hard">("easy");
  
  // Bulk Scan State
  const [isBulkScanning, setIsBulkScanning] = useState(false);
  const [bulkResults, setBulkResults] = useState<Record<string, string[]> | null>(null);
  const [acceptedRows, setAcceptedRows] = useState<Record<string, "pending" | "done" | "error">>({});

  // DB ID state — seed from localStorage, fall back to hardcoded default
  const [dbId, setDbId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_DB_ID);
  const [inputId, setInputId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_DB_ID);
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-fetch on first mount using the stored/default DB ID
  useEffect(() => {
    handleFetch(dbId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetch = async (idToUse?: string) => {
    const id = (idToUse ?? inputId).trim().replace(/-/g, "");
    if (!id) return;

    setFetchStatus("loading");
    setErrorMsg("");

    // Persist the new ID
    localStorage.setItem(STORAGE_KEY, id);
    setDbId(id);

    try {
      const [warmup, easy, hard] = await Promise.all([
        fetchQuestions("Warm-up", 50, true, id),
        fetchQuestions("Easy", 100, true, id),
        fetchQuestions("Hard", 100, true, id),
      ]);

      if (warmup.length === 0 && easy.length === 0 && hard.length === 0) {
        throw new Error("No questions found. Check the Database ID and make sure the integration has access.");
      }

      setContent({ easy: [...warmup, ...easy], hard });
      setFetchStatus("success");
    } catch (err: any) {
      console.error("Error loading Notion questions:", err);
      setErrorMsg(err?.message || "Unknown error. Check the console for details.");
      setFetchStatus("error");
    }
  };

  const handleBulkScan = async () => {
    if (!content || !content[activeSet]) return;
    
    setIsBulkScanning(true);
    setBulkResults(null);
    
    try {
      const questionsToScan = content[activeSet].map(q => ({
        id: q.questionId,
        letters: q.letters,
        known: q.validAnswers
      }));
      
      const results = await findAnagramsBulk(questionsToScan);
      setBulkResults(results);
    } catch (err) {
      console.error("Bulk scan failed:", err);
    } finally {
      setIsBulkScanning(false);
    }
  };

  const scrollToQuestion = (id: string) => {
    const el = document.getElementById(`q-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-4');
      setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-4'), 3000);
    }
  };

  const handleAcceptRow = async (questionId: string, newWords: string[]) => {
    const qArr = content?.[activeSet] || [];
    const q = qArr.find(item => item.questionId === questionId);
    if (!q) return;

    setAcceptedRows(prev => ({ ...prev, [questionId]: "pending" }));

    try {
      // 1. Verify words matching user's inflection rules
      const filteredWords: string[] = [];
      
      for (const word of newWords) {
        if (!isPotentialSimpleInflection(word)) {
          filteredWords.push(word);
          continue;
        }

        // It looks like an inflection, check API
        const dict = await checkWord(word);
        if (!dict.isValid) continue;

        const pos = dict.partsOfSpeech || [];
        
        // Rule: ing form as noun
        if (word.endsWith('ing') && pos.includes('noun')) {
          filteredWords.push(word);
        }
        // Rule: ed form as adjective
        else if (word.endsWith('ed') && pos.includes('adjective')) {
          filteredWords.push(word);
        }
        // Rule: Plurals - allow only if they are distinct (heuristic: keep if no base exists?)
        // For now, we follow the user's specific examples (ed/ing). 
        // If it's a plural -s, we check if it's a noun.
        else if (word.endsWith('s') && pos.includes('noun')) {
          // If it's ONLY a noun and also a plural, it's often okay, but user said 'Switch back to inflection is not allowed'
          // We'll skip simple plurals for now to be safe.
          // filteredWords.push(word);
        }
      }

      if (filteredWords.length === 0) {
        setAcceptedRows(prev => ({ ...prev, [questionId]: "done" }));
        // Remove from list anyway as there's nothing valid to add
        setBulkResults(prev => {
          if (!prev) return prev;
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        return;
      }

      // 2. Merge existing + filtered new, deduplicate
      const merged = Array.from(new Set([...q.validAnswers, ...filteredWords]));

      const result = await updateValidAnswers(questionId, merged);

      if (result.success) {
        setAcceptedRows(prev => ({ ...prev, [questionId]: "done" }));
        // Update local state so the card reflects the new answers immediately
        setContent(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            [activeSet]: prev[activeSet].map(item =>
              item.questionId === questionId
                ? { ...item, validAnswers: merged }
                : item
            ),
          };
        });
        // Remove from bulk results
        setBulkResults(prev => {
          if (!prev) return prev;
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
      } else {
        setAcceptedRows(prev => ({ ...prev, [questionId]: "error" }));
      }
    } catch (err) {
      console.error("Row acceptance failed:", err);
      setAcceptedRows(prev => ({ ...prev, [questionId]: "error" }));
    }
  };

  const handleDeleteDiscoveredWord = (questionId: string, word: string) => {
    if (!window.confirm(`Are you sure you want to dismiss the word "${word.toUpperCase()}" for this question? It will not be added to Notion.`)) {
      return;
    }

    setBulkResults(prev => {
      if (!prev || !prev[questionId]) return prev;
      
      const newWords = prev[questionId].filter(w => w !== word);
      
      // If no words left, remove the whole question row from results
      if (newWords.length === 0) {
        const next = { ...prev };
        delete next[questionId];
        return next;
      }

      return {
        ...prev,
        [questionId]: newWords
      };
    });
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(dbId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const notionDbUrl = `https://www.notion.so/${dbId.replace(/-/g, "")}`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Question Bank</h2>
          <p className="text-slate-500 text-sm font-medium">Fetch from any Notion database by ID.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setPanelOpen((v) => !v);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all text-sm"
          >
            <Database size={16} />
            Change Database
            {panelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={handleBulkScan}
            disabled={isBulkScanning || !content}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold transition-all text-sm border border-blue-100"
          >
            {isBulkScanning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isBulkScanning ? "Scanning..." : "Bulk Assistant"}
          </button>
          <button
            onClick={() => handleFetch()}
            disabled={fetchStatus === "loading"}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-200 active:scale-95"
          >
            {fetchStatus === "loading" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {fetchStatus === "loading" ? "Syncing…" : "Refresh"}
          </button>
          <a
            href={notionDbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-lg shadow-slate-200 active:scale-95"
          >
            <ExternalLink size={16} />
            Edit in Notion
          </a>
        </div>
      </div>

      {/* ─── Database ID Panel ─── */}
      {panelOpen && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-blue-600" />
            <h3 className="font-extrabold text-slate-800">Notion Database ID</h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Enter the 32-character ID from your Notion database URL:
            <br />
            <span className="font-mono text-slate-400">notion.so/workspace/</span>
            <span className="font-mono font-bold bg-blue-50 text-blue-700 px-1 rounded">
              d7ea40d03cde4e54b8a6226ac75130cc
            </span>
            <span className="font-mono text-slate-400">?v=…</span>
            <br />
            Hyphens are stripped automatically. The ID is saved in your browser across sessions.
          </p>

          {/* Current active ID display */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Active:</span>
            <code className="text-xs font-mono text-blue-700 flex-1 truncate">{dbId || "—"}</code>
            <button
              onClick={handleCopyId}
              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
              title="Copy ID"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Input for new ID */}
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleFetch();
                  setPanelOpen(false);
                }
              }}
              placeholder="Paste new Database ID…"
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
            <button
              onClick={() => {
                handleFetch();
                setPanelOpen(false);
              }}
              disabled={fetchStatus === "loading" || !inputId.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all text-sm"
            >
              Apply & Fetch
            </button>
          </div>
        </div>
      )}

      {/* ─── Status Banner ─── */}
      {fetchStatus === "loading" && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-blue-800 text-sm font-medium">
          <Loader2 size={18} className="animate-spin shrink-0" />
          Syncing with Notion…
        </div>
      )}
      {fetchStatus === "error" && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl animate-in fade-in">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800 text-sm">Fetch Failed</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}
      {fetchStatus === "success" && (
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm font-medium animate-in fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          Synced successfully from Notion.
        </div>
      )}

      {/* ─── Idle Placeholder ─── */}
      {fetchStatus === "idle" && (
        <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-medium">
          <Database size={32} className="mx-auto mb-3 opacity-30" />
          Enter a Database ID and click <strong>Refresh</strong> to load questions.
        </div>
      )}

      {/* ─── Bulk Results Banner (Option B) ─── */}
      {bulkResults && Object.keys(bulkResults).length > 0 && (
        <div 
          id="bulk-results-container"
          className="sticky top-6 z-50 bg-blue-600 rounded-3xl p-6 text-white shadow-2xl shadow-blue-200 animate-in slide-in-from-top-4 duration-500"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-black text-lg">Bulk Scan Results</h3>
                <p className="text-blue-100 text-xs font-bold">Found {Object.keys(bulkResults).length} questions with missing answers.</p>
              </div>
            </div>
            <button 
              onClick={() => setBulkResults(null)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="overflow-x-auto bg-white/10 rounded-2xl border border-white/20">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/20 bg-white/5">
                  <th className="px-4 py-3 font-black uppercase tracking-widest opacity-70">Question</th>
                  <th className="px-4 py-3 font-black uppercase tracking-widest opacity-70">New Words Found</th>
                  <th className="px-4 py-3 text-right font-black uppercase tracking-widest opacity-70">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {Object.entries(bulkResults).map(([id, words]) => {
                  const qArr = content?.[activeSet] || [];
                  const q = qArr.find(item => item.questionId === id);
                  return (
                    <tr key={id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-100 italic uppercase">
                        {q?.letters || id.split('-')[0]}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <div className="flex flex-wrap gap-1.5">
                          {words.map(w => (
                            <button 
                              key={w} 
                              onClick={() => handleDeleteDiscoveredWord(id, w)}
                              title="Click to remove from this list"
                              className="bg-white/10 hover:bg-red-500/30 hover:border-red-400/50 px-2.5 py-0.5 rounded text-[10px] border border-white/10 uppercase tracking-wider font-extrabold transition-all group/word flex items-center gap-1"
                            >
                              {w}
                              <X size={10} className="opacity-0 group-hover/word:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => scrollToQuestion(id)}
                            className="px-3 py-1 bg-white/20 text-white rounded-lg font-black text-[10px] hover:bg-white/30 transition-all uppercase tracking-tighter border border-white/20"
                          >
                            View
                          </button>
                          {acceptedRows[id] === "done" ? (
                            <span className="flex items-center gap-1 text-emerald-200 text-[10px] font-black">
                              <Check size={12} /> Saved
                            </span>
                          ) : acceptedRows[id] === "error" ? (
                            <span className="text-red-200 text-[10px] font-black">Failed</span>
                          ) : (
                            <button
                              onClick={() => handleAcceptRow(id, words)}
                              disabled={acceptedRows[id] === "pending"}
                              className="px-3 py-1 bg-emerald-400 hover:bg-emerald-300 text-emerald-900 rounded-lg font-black text-[10px] transition-all uppercase tracking-tighter disabled:opacity-50"
                            >
                              {acceptedRows[id] === "pending" ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                "Accept"
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bulkResults && Object.keys(bulkResults).length === 0 && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-bold animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-500" />
          Bulk Scan Complete: No missing common words found in current set.
        </div>
      )}

      {/* ─── Content ─── */}
      {content && fetchStatus !== "idle" && (
        <>
          {/* Tabs */}
          <div className="flex p-1.5 bg-slate-200/50 rounded-2xl w-fit">
            <button
              onClick={() => setActiveSet("easy")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${
                activeSet === "easy" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sparkles size={16} />
              Task 1 (Easy)
            </button>
            <button
              onClick={() => setActiveSet("hard")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${
                activeSet === "hard" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Brain size={16} />
              Task 2 (Hard)
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${activeSet === "easy" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                {activeSet === "easy" ? <Sparkles size={20} /> : <Brain size={20} />}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-widest">
                  {activeSet === "easy" ? "Easy Set" : "Hard Set"}
                </h3>
                <p className="text-[10px] font-bold text-slate-400">
                  Total Active: {content[activeSet].length} Questions
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(content[activeSet] || []).map((q) => (
                <div 
                  key={q.questionId} 
                  id={`q-${q.questionId}`}
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm group hover:border-blue-200 transition-all flex flex-col gap-4 scroll-mt-24"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 font-black text-slate-400 text-[10px] uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg">
                        <span>Notion ID</span>
                        <span className="text-blue-500 text-[8px]">{q.questionId.split("-")[0]}…</span>
                      </div>
                      {q.tier && (
                        <div className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest ${
                          q.tier === "Warm-up" ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                        }`}>
                          {q.tier}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const banner = document.getElementById('bulk-results-container');
                          if (banner) {
                            banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          } else {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Back to Results"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <a
                        href={q.questionPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="View in Notion"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Scrambled Letters</label>
                      <div className="w-full px-4 py-2.5 bg-slate-50 rounded-2xl font-black text-slate-800 text-center tracking-widest text-lg">
                        {q.letters}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Valid Answers</label>
                      <div className="w-full px-4 py-2 bg-slate-50 rounded-xl font-bold text-slate-600 text-sm uppercase tracking-wide">
                        {q.validAnswers.join(", ") || "No correct answers set"}
                      </div>
                    </div>
                    
                    {/* Anagram Assistant Integration */}
                    <AnagramAssistant 
                      letters={q.letters} 
                      knownAnswers={q.validAnswers} 
                    />
                  </div>
                </div>
              ))}
              {content[activeSet].length === 0 && (
                <div className="p-8 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-3xl">
                  No active questions found in Notion for this tier.
                </div>
              )}
            </div>
          </div>

          {/* Read-only info banner */}
          <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
            <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0">
              <Info size={20} />
            </div>
            <div>
              <h4 className="font-bold text-blue-900 text-sm">Read-Only Mode</h4>
              <p className="text-blue-700/70 text-xs mt-1 leading-relaxed">
                The question bank is mastered in your Notion database. Edits to valid answers, active status, or letter sets must be made directly in Notion, then click <strong>Refresh</strong> to sync.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
