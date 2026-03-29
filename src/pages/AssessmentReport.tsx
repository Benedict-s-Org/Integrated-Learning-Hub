// ============================================================
// AssessmentReport — Final Assessment Summary Page
// ============================================================
// Consolidates results from Grip and Writing stations.
// Features:
//   - Radar chart for handwriting quality (5 dimensions)
//   - Bar chart for pressure metrics
//   - Bilingual labels and recommendations (EN/ZH)
//   - Print-optimized layout for PDF export
// ============================================================

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useSession } from '../components/assessment/shared/useSession';
import * as assessmentService from '../services/supabase/assessmentService';
import { FullAssessmentResult } from '../components/assessment/shared/types';
import { 
  FileText, Printer, RefreshCw, Award, Activity, 
  Hand, ChevronRight, Loader2, AlertCircle 
} from 'lucide-react';

// ─── Component ───────────────────────────────────────────────

export function AssessmentReport() {
  const { session, isLoading: sessionLoading, clearSession } = useSession({ deviceRole: 'writing' });
  const [reportData, setReportData] = useState<FullAssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetching ─────────────────────────────────────────

  useEffect(() => {
    async function fetchReport() {
      if (!session?.id) return;
      try {
        const data = await assessmentService.getFullAssessmentResult(session.id);
        if (!data) throw new Error('Result not found / 找不到評估結果');
        setReportData(data);
      } catch (err: any) {
        console.error('Report fetch error:', err);
        setError(err.message || 'Failed to load report / 載入報告失敗');
      } finally {
        setLoading(false);
      }
    }

    if (session?.id) {
      fetchReport();
    } else if (!sessionLoading) {
      setLoading(false);
    }
  }, [session?.id, sessionLoading]);

  // ── Derived Data for Charts ───────────────────────────────

  const radarData = useMemo(() => {
    if (!reportData?.handwritingResult || !reportData.pressureResult) return [];
    
    // Normalizing pressure (0-1) to 1-5 scale for the chart
    const pressureScore = Math.max(1, Math.min(5, reportData.pressureResult.avgPressure * 5));

    return [
      { subject: 'Clarity / 清晰度', A: reportData.handwritingResult.letterClarity, fullMark: 5 },
      { subject: 'Size / 大小均勻', A: reportData.handwritingResult.sizeConsistency, fullMark: 5 },
      { subject: 'Alignment / 橫線對齊', A: reportData.handwritingResult.lineAdherence, fullMark: 5 },
      { subject: 'Spacing / 間距', A: reportData.handwritingResult.spacing, fullMark: 5 },
      { subject: 'Pressure / 筆壓', A: pressureScore, fullMark: 5 },
    ];
  }, [reportData]);

  const pressureBarData = useMemo(() => {
    if (!reportData?.pressureResult) return [];
    return [
      { name: 'Average / 平均', value: reportData.pressureResult.avgPressure },
      { name: 'Max / 最大', value: reportData.pressureResult.maxPressure },
      { name: 'Variance / 穩定性', value: reportData.pressureResult.pressureVariance },
    ];
  }, [reportData]);

  // ── Handlers ──────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  const handleRestart = () => {
    if (window.confirm('Start a new assessment? Current session will be cleared. / 開始新評估？目前會話將會被清除。')) {
      clearSession();
      window.location.href = '/classDashboard'; // Redirect to home
    }
  };

  // ── Render Helpers ─────────────────────────────────────────

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-slate-900 mb-2">{error || "No Result Found / 找不到結果"}</h2>
        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl">Retry / 重試</button>
      </div>
    );
  }

  const { handwritingResult, pressureResult, gripResult, metadata } = reportData;

  const getFatigueColor = (index: number) => {
    if (index < 0.3) return 'text-emerald-500';
    if (index < 0.6) return 'text-amber-500';
    return 'text-red-500';
  };

  const overallScore = handwritingResult ? Math.round(
    (handwritingResult.letterClarity + handwritingResult.sizeConsistency + 
     handwritingResult.lineAdherence + handwritingResult.spacing + (pressureResult?.avgPressure || 0) * 5) / 5
  ) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col print:bg-white">
      {/* 1. Sticky Header / Action Bar (Hidden on print) */}
      <nav className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-[100] print:hidden shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-600" />
          <span className="font-black text-slate-800 uppercase tracking-widest text-sm">Assessment Report / 評估報告</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Export PDF / 匯出</span>
          </button>
          <button 
            onClick={handleRestart}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
          >
            <RefreshCw className="w-4 h-4" />
            <span>New / 新評估</span>
          </button>
        </div>
      </nav>

      {/* 2. Main content area */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-8 md:p-12 space-y-12 print:p-0">
        
        {/* Report Header */}
        <header className="flex justify-between items-end border-b-4 border-slate-900 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <Award className="w-10 h-10 text-blue-600" strokeWidth={2.5} />
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Handwriting Analysis</h1>
            </div>
            <p className="text-xl font-bold text-slate-500">書寫能力綜合評估報告 — {reportData.studentName}</p>
          </div>
          <div className="text-right">
            <span className="block text-xs font-black text-blue-600 uppercase tracking-widest">Session / 會話</span>
            <span className="text-3xl font-black tabular-nums tracking-tighter">{session?.sessionCode}</span>
            <p className="text-sm font-bold text-slate-400 mt-1">{new Date(metadata.reportGeneratedAt).toLocaleDateString('zh-HK')}</p>
          </div>
        </header>

        {/* Section A: Handwriting (Radar) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-purple-600">
                <Activity className="w-6 h-6" />
                <h2 className="text-2xl font-black tracking-tight">Handwriting Quality / 字體質量</h2>
            </div>
            
            <div className="space-y-4">
                {radarData.map((d) => (
                    <div key={d.subject} className="flex items-center justify-between group">
                        <span className="text-sm font-bold text-slate-500 group-hover:text-slate-900 transition-colors uppercase tracking-wide">{d.subject}</span>
                        <div className="flex items-center gap-3">
                             <div className="h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(d.A / 5) * 100}%` }} />
                             </div>
                             <span className="text-sm font-black text-purple-600 w-4">{Math.round(d.A)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-purple-50 rounded-3xl p-6 border border-purple-100">
                <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">AI Suggestions / 學習建議</p>
                <div className="space-y-2">
                    {handwritingResult?.suggestions.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start">
                            <ChevronRight className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-purple-800 leading-relaxed">{s}</p>
                        </div>
                    ))}
                </div>
            </div>
          </div>

          <div className="h-[400px] w-full relative flex flex-col items-center justify-center">
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[120px] font-black text-purple-500/5 leading-none">{overallScore}</span>
             </div>
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                    <Radar
                        name="Student"
                        dataKey="A"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        fill="#8b5cf6"
                        fillOpacity={0.4}
                    />
                </RadarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Section B: Pressure Profile */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 grid md:grid-cols-3 gap-10">
           <div className="md:col-span-1 space-y-6">
              <div className="flex items-center gap-3 text-amber-600">
                  <Activity className="w-6 h-6" />
                  <h2 className="text-2xl font-black tracking-tight">Pressure / 筆壓數據</h2>
              </div>
              
              <div className="p-6 bg-slate-50 rounded-3xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Fatigue Index / 疲勞指數</span>
                <div className="flex items-end gap-2">
                    <span className={`text-5xl font-black ${getFatigueColor(pressureResult?.fatigueIndex ?? 0)} tracking-tighter tabular-nums`}>
                        {pressureResult?.fatigueIndex?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-xs font-bold text-slate-400 pb-2 uppercase tracking-widest">/ 1.0</span>
                </div>
                <p className="mt-4 text-xs font-bold text-slate-500 leading-relaxed">
                    Higher values indicate increasing pressure as writing progresses.
                    分數越高代表書寫過程中壓力逐漸增大。
                </p>
              </div>

              <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                <p className="text-sm font-bold text-amber-900 leading-relaxed">
                    {pressureResult?.pressureZone === 'OVER' ? 'Excessive pressure detected. Consider thicker pencil grips.' : 'Pressure is within healthy range for P.3/P.4 students.'}
                    <br />
                    {pressureResult?.pressureZone === 'OVER' ? '偵測到筆壓過大，建議使用較粗的握筆套。' : '目前筆壓處於小學三年級至四年級的健康範圍。'}
                </p>
              </div>
           </div>

           <div className="md:col-span-2 h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pressureBarData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                        <YAxis domain={[0, 1]} hide />
                        <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 800, color: '#1e293b' }}
                        />
                        <Bar 
                            dataKey="value" 
                            fill="#f59e0b" 
                            radius={[12, 12, 0, 0]} 
                            barSize={60}
                        />
                    </BarChart>
                </ResponsiveContainer>
           </div>
        </div>

        {/* Section C: Grip Type */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden relative group">
           <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] group-hover:bg-blue-500/20 transition-all duration-1000" />
           
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
              <div className="w-40 h-40 bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center p-6 text-center">
                  <Hand className="w-12 h-12 text-blue-400 mb-3" />
                  <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest mb-1">Grip Confidence / 置信度</span>
                  <span className="text-3xl font-black text-white">{Math.round((gripResult?.confidence ?? 0) * 100)}%</span>
              </div>

              <div className="flex-1 space-y-4">
                 <div className="inline-block px-4 py-1.5 bg-blue-500 rounded-full text-[11px] font-black text-white uppercase tracking-wider mb-2">Detected Grip / 偵測到握法</div>
                 <h2 className="text-4xl font-black text-white tracking-tighter">
                    {gripResult?.gripType.replace('_', ' ').toUpperCase()}
                 </h2>
                 <p className="text-xl font-bold text-slate-400">
                    Lateral Pinch / 側邊指腹式
                 </p>
                 
                 <div className="h-px bg-white/10 w-full" />

                 <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Recommendation / 建議</span>
                        <p className="text-sm font-bold text-white leading-relaxed">{gripResult?.thumbPosition?.label || 'Continue monitoring thumb position during writing.'}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Chinese Rec / 中文建議</span>
                        <p className="text-sm font-bold text-slate-300 leading-relaxed">繼續監測書寫時大拇指的位置。</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Writing Snapshot Feature */}
        {reportData.pressureResult?.rawData && (
            <div className="border-2 border-slate-100 rounded-[2.5rem] p-10 bg-white space-y-6">
                <div className="flex items-center gap-2 text-slate-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-black uppercase tracking-widest">Digital Snapshot / 數碼快照</span>
                </div>
                <div className="aspect-video w-full bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden flex items-center justify-center">
                    {metadata.writingPrompt ? (
                         <div className="text-center p-12">
                             <p className="text-slate-300 font-bold mb-2 uppercase tracking-wide">Snapshot Placeholder</p>
                             <p className="text-lg font-bold text-slate-900">"{metadata.writingPrompt}"</p>
                         </div>
                    ) : (
                        <p className="text-slate-300 font-bold">No Image Available / 沒有影像</p>
                    )}
                </div>
            </div>
        )}

        {/* Report Footer */}
        <footer className="text-center pb-20 pt-8 space-y-4">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Integrated Learning Hub — Handwriting R&D</p>
            <div className="flex justify-center gap-2 opacity-30 grayscale transition-all hover:grayscale-0 hover:opacity-100">
                <Award className="w-5 h-5 text-blue-600" />
                <Activity className="w-5 h-5 text-amber-600" />
                <Hand className="w-5 h-5 text-purple-600" />
            </div>
        </footer>

      </main>

      {/* Global Print Styles */}
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .print-hidden { display: none !important; }
          main { padding: 0 !important; width: 100% !important; max-width: 100% !important; }
          .rounded-\\[2\\.5rem\\] { border-radius: 1rem !important; }
          header, footer { border-color: #334155 !important; }
          shadow-xl, shadow-2xl { box-shadow: none !important; }
          border { border-style: solid !important; border-width: 1px !important; border-color: #e2e8f0 !important; }
        }
      `}</style>
    </div>
  );
}
