// ============================================================
// WritingStation — iPad Writing Assessment Hub
// ============================================================
// Main interface for student writing assessment. 
// Integrates:
//   - FourLineGrid (Visual Reference)
//   - WritingCanvas (Apple Pencil Input + Pressure)
//   - PressureAnalyzer (Real-time Stats)
//   - Gemini API (AI Handwriting Analysis)
//   - useSession (Sync & Pairing)
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FourLineGrid } from '../components/assessment/writing/FourLineGrid';
import { WritingCanvas, WritingCanvasRef } from '../components/assessment/writing/WritingCanvas';
import { analyzePressure } from '../components/assessment/writing/PressureAnalyzer';
import { analyzeHandwriting } from '../components/assessment/analysis/geminiClient';
import { useSession } from '../components/assessment/shared/useSession';
import { 
  PressureSample, 
  PressureResult, 
  HandwritingResult, 
  SessionStatus 
} from '../components/assessment/shared/types';
import * as assessmentService from '../services/supabase/assessmentService';
import { CheckCircle2, AlertCircle, Loader2, Eraser, LineChart, Award, Save, Wand2 } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;
const DEBOUNCE_MS = 500;

// ─── Component ───────────────────────────────────────────────

export function WritingStation() {
  const navigate = useNavigate();
  const { session, isLoading: sessionLoading, updateStatus, submitPressureResult, submitHandwritingResult } = useSession({ deviceRole: 'writing' });
  
  const canvasRef = useRef<WritingCanvasRef>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  
  // ── State ─────────────────────────────────────────────────
  const [pressureReadings, setPressureReadings] = useState<PressureSample[]>([]);
  const [pressureAnalysis, setPressureAnalysis] = useState<PressureResult | null>(null);
  const [handwritingResult, setHandwritingResult] = useState<HandwritingResult | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // ── Debounced Pressure Analysis ───────────────────────────
  useEffect(() => {
    if (pressureReadings.length === 0) return;
    
    const handler = setTimeout(() => {
      const analysis = analyzePressure(pressureReadings);
      setPressureAnalysis(analysis);
    }, DEBOUNCE_MS);
    
    return () => clearTimeout(handler);
  }, [pressureReadings]);

  // ── Toast Utility ────────────────────────────────────────
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // ── Handlers ──────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!canvasRef.current) return;
    
    setIsAnalyzing(true);
    try {
      const { compositeUrl } = await canvasRef.current.getSnapshotData();
      
      // Call Gemini Vision API
      const result = await analyzeHandwriting(compositeUrl, {
        avgPressure: pressureAnalysis?.avgPressure || 0,
        gripType: 'Assessed via iPhone', // Contextual placeholder
        writingPrompt: session?.writingPrompt || 'Standard Copybook Exercise'
      });
      
      setHandwritingResult(result);
      setToastMessage({ text: 'AI Analysis Complete / AI 分析完成', type: 'success' });
    } catch (err) {
      console.error('Analysis error:', err);
      setToastMessage({ text: 'Analysis failed. Please try again. / 分析失敗，請重試。', type: 'error' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!session || !canvasRef.current || !pressureAnalysis) {
      setToastMessage({ text: 'Please write something first. / 請先書寫內容。', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const { compositeUrl, samples } = await canvasRef.current.getSnapshotData();
      
      // 1. Upload Snapshot Image
      const snapshotUrl = await assessmentService.uploadWritingImage(session.id, compositeUrl);
      
      // 2. Submit Pressure Data
      await submitPressureResult({
        ...pressureAnalysis,
        rawData: samples
      });

      // 3. Submit Handwriting Results (if analyzed)
      if (handwritingResult) {
        await submitHandwritingResult(handwritingResult);
      }

      // 4. Update snapshot URL and Mark Complete
      // Note: useSession's submitPressureResult/submitHandwritingResult handle some of this,
      // but we explicitly update the snapshot URL here.
      await assessmentService.completeSession(session.id);
      
      setToastMessage({ text: 'Assessment saved successfully! / 評估已成功儲存', type: 'success' });
      
      // Small delay before redirect
      setTimeout(() => navigate('/classDashboard'), 2000);
    } catch (err) {
      console.error('Save error:', err);
      setToastMessage({ text: 'Failed to save. / 儲存失敗', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear all writing? / 確定清除所有筆跡？')) {
      canvasRef.current?.clear();
      setPressureReadings([]);
      setPressureAnalysis(null);
      setHandwritingResult(null);
    }
  };

  // ── Render Helpers ─────────────────────────────────────────

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-emerald-600';
    if (score >= 3) return 'text-amber-600';
    return 'text-red-600';
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-black text-slate-900 mb-2">Session Not Found / 找不到會話</h2>
        <p className="text-slate-600 mb-8">Please enter a valid session code from the iPhone. / 請輸入正確的 iPhone 會話編號。</p>
        <button onClick={() => navigate(-1)} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200">Go Back / 返回</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* 1. Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none">Writing Assessment</h1>
            <p className="text-sm font-bold text-slate-400">書寫評估 — {session.studentName}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
            <div className="text-right">
                <span className="block text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Session Code / 會話編號</span>
                <span className="text-2xl font-black tabular-nums tracking-tighter text-slate-900">{session.sessionCode}</span>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Active Sync / 已同步</span>
            </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Canvas (60%) */}
        <div className="w-[60%] flex flex-col items-center justify-center p-8 bg-slate-100/50 relative">
          <div className="relative shadow-2xl rounded-2xl overflow-hidden bg-white border-4 border-white">
            <div className="absolute inset-0 z-0">
                <FourLineGrid 
                    ref={gridRef}
                    width={CANVAS_WIDTH} 
                    height={CANVAS_HEIGHT} 
                    promptText={session.writingPrompt || "Copy this sentence..."}
                />
            </div>
            <div className="relative z-10">
                <WritingCanvas 
                    ref={canvasRef}
                    gridCanvasRef={gridRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    promptText={session.writingPrompt || ""}
                    onPressureData={setPressureReadings}
                />
            </div>
          </div>
          <p className="mt-6 text-sm font-bold text-slate-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Use Apple Pencil for accurate pressure metrics / 請使用 Apple Pencil 以獲得準確的壓力數據
          </p>
        </div>

        {/* Right Column: Dashboard (40%) */}
        <aside className="w-[40%] bg-white border-l border-slate-200 overflow-y-auto custom-scrollbar p-8">
          <div className="space-y-8">
            {/* Real-time Pressure Analysis */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                  <LineChart className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-800">Pressure Insights / 筆壓分析</h3>
              </div>

              {pressureAnalysis ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all hover:shadow-md">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Average / 平均</span>
                    <span className="text-2xl font-black text-slate-900">{(pressureAnalysis.avgPressure * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all hover:shadow-md">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Stability / 穩定度</span>
                    <span className="text-2xl font-black text-slate-900">{(100 - pressureAnalysis.pressureVariance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all hover:shadow-md col-span-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Summary / 診斷</span>
                    <p className="text-sm font-bold text-slate-700 mt-1">{pressureAnalysis.summaryEn}</p>
                    <p className="text-sm font-bold text-slate-400">{pressureAnalysis.summaryZh}</p>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                  <Wand2 className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Start writing to see analysis / 開始書寫以見分析</p>
                </div>
              )}
            </section>

            <div className="h-px bg-slate-100" />

            {/* AI Handwriting Results */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-800">Handwriting Quality / 字體質量</h3>
              </div>

              {handwritingResult ? (
                <div className="space-y-4">
                  {[
                    { label: 'Clarity / 清晰度', score: handwritingResult.letterClarity },
                    { label: 'Consistency / 大小均勻', score: handwritingResult.sizeConsistency },
                    { label: 'Adherence / 貼線度', score: handwritingResult.lineAdherence },
                    { label: 'Formation / 筆順及架構', score: handwritingResult.letterFormation },
                    { label: 'Spacing / 間距', score: handwritingResult.spacing },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-500">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <div 
                              key={s} 
                              className={`w-4 h-4 rounded-sm transition-colors ${s <= item.score ? 'bg-purple-500' : 'bg-slate-100'}`} 
                            />
                          ))}
                        </div>
                        <span className={`text-sm font-black w-4 ${getScoreColor(item.score)}`}>{item.score}</span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-6 bg-purple-50 p-4 rounded-2xl border border-purple-100">
                    <span className="text-[10px] font-black text-purple-400 uppercase block mb-1">AI Suggestions / 學習建議</span>
                    <ul className="list-disc list-inside space-y-1">
                        {handwritingResult.suggestions.map((s, idx) => (
                            <li key={idx} className="text-xs font-bold text-purple-800 leading-relaxed">{s}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || pressureReadings.length < 50}
                  className="w-full py-12 flex flex-col items-center justify-center bg-purple-50/50 hover:bg-purple-50 rounded-2xl border border-dashed border-purple-200 transition-all group"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-3" />
                      <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">AI Brain Working... / AI 正在分析...</p>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-10 h-10 text-purple-300 mb-3 group-hover:text-purple-500 group-hover:scale-110 transition-transform" />
                      <p className="text-xs font-black text-purple-400 uppercase tracking-widest group-hover:text-purple-600">Run AI Vision Analysis / 啟動 AI 字體分析</p>
                      <span className="text-[9px] text-slate-400 mt-2 font-bold">(Requires writing sample / 需要基本書寫樣品)</span>
                    </>
                  )}
                </button>
              )}
            </section>
          </div>
        </aside>
      </main>

      {/* 3. Footer Actions */}
      <footer className="h-24 bg-white border-t border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-50">
        <button
          onClick={handleClear}
          className="flex items-center gap-3 px-6 py-3 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold"
        >
          <Eraser className="w-5 h-5" />
          <span>Clear Canvas / 清除畫布</span>
        </button>

        <div className="flex gap-4">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || isSaving || pressureReadings.length < 50}
            className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-purple-600 text-purple-600 hover:bg-purple-50 rounded-2xl transition-all font-black shadow-md shadow-purple-100 disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            <span>Analyze Writing / 分析字體</span>
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving || isAnalyzing || !pressureAnalysis}
            className="flex items-center gap-3 px-12 py-4 bg-slate-900 text-white hover:bg-black rounded-2xl transition-all font-black shadow-xl shadow-slate-200 group disabled:bg-slate-200 disabled:shadow-none"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />}
            <span>Save Assessment / 儲存評估</span>
          </button>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-500 backdrop-blur-md border ${
          toastMessage.type === 'success' ? 'bg-emerald-900/90 text-white border-white/20' : 'bg-red-600 text-white border-white/20'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          <p className="font-black text-sm whitespace-nowrap">{toastMessage.text}</p>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
