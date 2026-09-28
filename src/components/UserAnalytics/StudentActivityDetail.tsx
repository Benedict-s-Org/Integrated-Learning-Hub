import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Trophy, 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  BarChart2, 
  Activity, 
  Zap, 
  BookOpen, 
  Award, 
  Search, 
  MinusCircle,
  Lightbulb,
  Sparkles,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SpellingPracticeResult, ProofreadingPracticeResult, MemorizationSession, SpacedRepetitionAttempt } from '../../types';
import { diagnoseQuestion, analyzeStudentProofreadingResults } from '../../utils/proofreadingAnalytics';

interface StudentActivityDetailProps {
  userId: string;
  studentName: string;
  className?: string;
  isArchived?: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'spelling' | 'proofreading' | 'memorization' | 'spaced_repetition';

export const StudentActivityDetail: React.FC<StudentActivityDetailProps> = ({
  userId,
  studentName,
  className,
  isArchived,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [spellingResults, setSpellingResults] = useState<SpellingPracticeResult[]>([]);
  const [proofreadingResults, setProofreadingResults] = useState<ProofreadingPracticeResult[]>([]);
  const [memorizationSessions, setMemorizationSessions] = useState<MemorizationSession[]>([]);
  const [srAttempts, setSrAttempts] = useState<any[]>([]);
  const [srSchedules, setSrSchedules] = useState<any[]>([]);
  
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, [userId]);

  const normalizeTipsUsed = (raw: any): number[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(Number).filter(n => !isNaN(n));
    if (typeof raw === 'string') {
      try { return JSON.parse(raw).map(Number).filter((n: number) => !isNaN(n)); } catch { return []; }
    }
    return [];
  };

  const normalizeProofreadingRow = (row: any): any => ({
    ...row,
    tips_used: normalizeTipsUsed(row.tips_used),
    sentences: Array.isArray(row.sentences) ? row.sentences : [],
    correct_answers: Array.isArray(row.correct_answers) ? row.correct_answers : [],
    user_answers: Array.isArray(row.user_answers) ? row.user_answers : [],
  });

  const loadActivities = async () => {
    setLoading(true);
    setFetchError(null);
    console.log('[StudentActivityDetail] Loading activities for userId:', userId);
    try {
      const { data: spellingData, error: spellingErr } = await (supabase as any)
        .from('spelling_practice_results')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });
      console.log('[StudentActivityDetail] Spelling:', spellingData?.length ?? 0, spellingErr?.message);
      if (spellingData) setSpellingResults(spellingData as any);

      // ── Proofreading: 3-tier fetch ──────────────────────────────────────
      let prResults: any[] = [];

      // Tier 1: SECURITY DEFINER RPC (bypasses RLS)
      try {
        const { data: rpcPR, error: rpcErr } = await (supabase as any).rpc(
          'get_student_proofreading_results',
          { target_user_id: userId }
        );
        console.log('[StudentActivityDetail] RPC proofreading:', rpcPR?.length ?? 0, rpcErr?.message);
        if (rpcPR && Array.isArray(rpcPR) && rpcPR.length > 0) {
          prResults = rpcPR;
        } else if (rpcErr) {
          console.warn('[StudentActivityDetail] RPC error:', rpcErr.message, '— falling back to direct query');
        }
      } catch (e: any) {
        console.warn('[StudentActivityDetail] RPC exception:', e?.message);
      }

      // Tier 2: Direct query (works if RLS allows admin access)
      if (prResults.length === 0) {
        const { data: directPR, error: directErr } = await (supabase as any)
          .from('proofreading_practice_results')
          .select('*, proofreading_practices(title)')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false });
        console.log('[StudentActivityDetail] Direct proofreading:', directPR?.length ?? 0, directErr?.message);
        if (directPR && Array.isArray(directPR) && directPR.length > 0) {
          prResults = directPR;
        } else if (directErr) {
          console.warn('[StudentActivityDetail] Direct query error:', directErr.message);
        }
      }

      // Tier 3: Edge function (uses service role key)
      if (prResults.length === 0) {
        try {
          const { data: edgePR, error: edgeErr } = await (supabase.functions as any).invoke(
            'proofreading-practices/student-results',
            { body: { studentUserId: userId } }
          );
          console.log('[StudentActivityDetail] Edge function proofreading:', edgePR?.results?.length ?? 0, edgeErr?.message);
          if (edgePR?.results && Array.isArray(edgePR.results)) {
            prResults = edgePR.results;
          }
        } catch (e: any) {
          console.warn('[StudentActivityDetail] Edge function exception:', e?.message);
        }
      }

      console.log('[StudentActivityDetail] Final proofreading result count:', prResults.length);
      if (prResults.length > 0) {
        setProofreadingResults(prResults.map(normalizeProofreadingRow) as any);
      } else {
        setFetchError('Could not load proofreading records. The database RPC may not be deployed yet — run the SQL from migration 20260929070000 in the Supabase SQL Editor.');
      }

      const { data: memorizationData } = await (supabase as any)
        .from('memorization_practice_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      if (memorizationData) setMemorizationSessions(memorizationData as any);
      
      const { data: srData } = await (supabase as any)
        .from('spaced_repetition_attempts')
        .select(`
          *,
          spaced_repetition_questions ( question_text )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (srData) setSrAttempts(srData as any);

      const { data: schedData } = await (supabase as any)
        .from('spaced_repetition_schedules')
        .select(`
          *,
          spaced_repetition_questions ( question_text )
        `)
        .eq('user_id', userId);

      if (schedData) setSrSchedules(schedData as any);
      
    } catch (error: any) {
      console.error('[StudentActivityDetail] Fatal error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (percentage >= 70) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const totalSpellingTime = spellingResults.reduce((acc, curr) => acc + (curr.time_spent_seconds || 0), 0);
  const totalProofreadingTime = proofreadingResults.reduce((acc, curr) => acc + (curr.time_spent_seconds || 0), 0);
  const totalMemorizationTime = memorizationSessions.reduce((acc, curr) => acc + (curr.session_duration_seconds || 0), 0);
  const totalSrTime = srAttempts.reduce((acc, curr) => acc + Math.round((curr.response_time_ms || 0) / 1000), 0);
  const totalTimeSeconds = totalSpellingTime + totalProofreadingTime + totalMemorizationTime + totalSrTime;
  
  const avgSpellingAccuracy = spellingResults.length > 0 
    ? Math.round(spellingResults.reduce((acc, curr) => acc + (curr.accuracy_percentage || 0), 0) / spellingResults.length)
    : 0;

  const avgProofreadingAccuracy = proofreadingResults.length > 0
    ? Math.round(proofreadingResults.reduce((acc, curr) => acc + (curr.accuracy_percentage || 0), 0) / proofreadingResults.length)
    : 0;

  const avgSrAccuracy = srAttempts.length > 0
    ? Math.round((srAttempts.filter(a => a.is_correct).length / srAttempts.length) * 100)
    : 0;

  const totalWordsMemorized = memorizationSessions.reduce((acc, curr) => acc + (curr.total_words || 0), 0);

  const proofreadingDiagnostics = useMemo(() => {
    return analyzeStudentProofreadingResults(proofreadingResults);
  }, [proofreadingResults]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      <div 
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">Activity Logs</h2>
              {isArchived ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-md border border-amber-200">
                  Archived Class
                </span>
              ) : className ? (
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-md border border-blue-200">
                  {className}
                </span>
              ) : null}
            </div>
            <p className="text-sm font-medium text-slate-500 mt-0.5">
              {studentName} {className && isArchived ? `(${className})` : ''}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex space-x-1 border-b border-slate-100 bg-slate-50/50 overflow-x-auto scrollbar-hide">
          {[
            { id: 'overview', label: 'Overview', count: null, icon: Activity },
            { id: 'spelling', label: 'Spelling', count: spellingResults.length, icon: Target },
            { id: 'proofreading', label: 'Proofreading', count: proofreadingResults.length, icon: Trophy },
            { id: 'memorization', label: 'Memorization', count: memorizationSessions.length, icon: Clock },
            { id: 'spaced_repetition', label: 'Spaced Repetition', count: srAttempts.length, icon: Zap }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as TabType); setExpandedId(null); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.id 
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-t-lg'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} />
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading activities...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Summary Stats Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Clock size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Total Practice Time</p>
                        <p className="text-2xl font-bold text-slate-800">{formatDuration(totalTimeSeconds)}</p>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Activity size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500">Total Activities</p>
                        <p className="text-2xl font-bold text-slate-800">{spellingResults.length + proofreadingResults.length + memorizationSessions.length + srAttempts.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 text-slate-700">
                        <Target size={18} className="text-emerald-500" />
                        <h4 className="font-semibold">Spelling</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Practices:</span>
                          <span className="font-medium">{spellingResults.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Avg Accuracy:</span>
                          <span className={`font-medium ${getScoreColor(avgSpellingAccuracy).split(' ')[0]}`}>{avgSpellingAccuracy}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Time:</span>
                          <span className="font-medium">{formatDuration(totalSpellingTime)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 text-slate-700">
                        <Trophy size={18} className="text-amber-500" />
                        <h4 className="font-semibold">Proofreading</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Practices:</span>
                          <span className="font-medium">{proofreadingResults.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Avg Accuracy:</span>
                          <span className={`font-medium ${getScoreColor(avgProofreadingAccuracy).split(' ')[0]}`}>{avgProofreadingAccuracy}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Time:</span>
                          <span className="font-medium">{formatDuration(totalProofreadingTime)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 text-slate-700">
                        <Clock size={18} className="text-blue-500" />
                        <h4 className="font-semibold">Memorization</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sessions:</span>
                          <span className="font-medium">{memorizationSessions.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Words:</span>
                          <span className="font-medium">{totalWordsMemorized}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Time:</span>
                          <span className="font-medium">{formatDuration(totalMemorizationTime)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3 text-slate-700">
                        <Zap size={18} className="text-purple-500" />
                        <h4 className="font-semibold">Spaced Repetition</h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Attempts:</span>
                          <span className="font-medium">{srAttempts.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Avg Accuracy:</span>
                          <span className={`font-medium ${getScoreColor(avgSrAccuracy).split(' ')[0]}`}>{avgSrAccuracy}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Time:</span>
                          <span className="font-medium">{formatDuration(totalSrTime)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mini-chart (Recent Spelling Trend) */}
                  {spellingResults.length > 0 && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart2 size={18} className="text-slate-500" />
                        <h4 className="font-semibold text-slate-700">Recent Spelling Trend</h4>
                      </div>
                      <div className="flex items-end gap-2 h-32 px-2">
                        {spellingResults.slice(0, 10).reverse().map((result, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="relative w-full flex justify-center h-full">
                              <div 
                                className={`w-full max-w-[24px] rounded-t-md transition-all duration-500 ${result.accuracy_percentage >= 90 ? 'bg-emerald-400 group-hover:bg-emerald-500' : result.accuracy_percentage >= 70 ? 'bg-amber-400 group-hover:bg-amber-500' : 'bg-rose-400 group-hover:bg-rose-500'}`}
                                style={{ height: `${result.accuracy_percentage}%`, position: 'absolute', bottom: 0 }}
                                title={`${result.accuracy_percentage}%`}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400">{i + 1}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-center mt-2 text-xs text-slate-400">Last 10 practices (oldest to newest)</div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'spelling' && (
                spellingResults.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">No spelling activities found.</div>
                ) : (
                  spellingResults.map(result => (
                    <div key={result.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div 
                        className="px-5 py-4 cursor-pointer flex justify-between items-center group"
                        onClick={() => toggleExpand(result.id)}
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{result.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{formatDate(result.completed_at)}</span>
                            <span>•</span>
                            <span>{formatDuration(result.time_spent_seconds)}</span>
                            <span>•</span>
                            <span>Level {result.practice_level}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={`px-3 py-1 rounded-full border text-sm font-semibold flex items-center gap-1.5 ${getScoreColor(result.accuracy_percentage)}`}>
                            {result.accuracy_percentage >= 90 && <Trophy size={14} className="text-emerald-600" />}
                            {result.accuracy_percentage}%
                          </div>
                          {expandedId === result.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                        </div>
                      </div>
                      
                      {expandedId === result.id && (
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Detailed Answers</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {result.user_answers?.map((ans, idx) => (
                              <div key={idx} className={`p-3 rounded-lg border flex items-start gap-3 ${ans.isCorrect ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                                {ans.isCorrect ? <CheckCircle className="text-emerald-500 mt-0.5 shrink-0" size={16} /> : <XCircle className="text-rose-500 mt-0.5 shrink-0" size={16} />}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-slate-800 truncate">{ans.word}</div>
                                  {!ans.isCorrect && (
                                    <div className="text-sm text-rose-600 mt-0.5 truncate">
                                      <span className="text-rose-400">Typed:</span> {ans.userAnswer || <span className="italic">Empty</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}

              {activeTab === 'proofreading' && (
                proofreadingResults.length === 0 ? (
                  <div className="space-y-3">
                    <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
                      No proofreading records found for this student.
                    </div>
                    {fetchError && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                        <p className="font-bold mb-1">⚠ Admin Action Required</p>
                        <p>{fetchError}</p>
                        <p className="mt-2 font-semibold">SQL file: <code>supabase/migrations/20260929070000_fix_admin_proofreading_analytics.sql</code></p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Top Diagnostic Summary Banner */}
                    <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50 p-4 rounded-xl border border-indigo-100 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-indigo-600" />
                          <h4 className="text-sm font-bold text-indigo-950">Proofreading Diagnostic Summary</h4>
                        </div>
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                          Overall Accuracy: {proofreadingDiagnostics.overallAccuracy}%
                        </span>
                      </div>

                      {/* Mini metric pills */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100/60">
                          <span className="text-[10px] text-slate-500 block">Total Sessions / Qs</span>
                          <span className="font-bold text-slate-800">{proofreadingDiagnostics.totalPractices} Sessions · {proofreadingDiagnostics.totalQuestions} Qs</span>
                        </div>
                        <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200/60">
                          <span className="text-[10px] text-emerald-700 block">Correct</span>
                          <span className="font-bold text-emerald-800">{proofreadingDiagnostics.correctQuestions} ({proofreadingDiagnostics.overallAccuracy}%)</span>
                        </div>
                        <div className="bg-rose-50/80 p-2.5 rounded-lg border border-rose-200/60">
                          <span className="text-[10px] text-rose-700 block">Incorrect / Blank</span>
                          <span className="font-bold text-rose-800">{proofreadingDiagnostics.incorrectQuestions}</span>
                        </div>
                        <div className="bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/60">
                          <span className="text-[10px] text-amber-700 block">Marked "Not Sure"</span>
                          <span className="font-bold text-amber-800">{proofreadingDiagnostics.notSureQuestions}</span>
                        </div>
                      </div>

                      {/* Root cause analysis */}
                      <div className="bg-white/90 p-3 rounded-lg border border-indigo-100/80 text-xs space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle size={13} className="text-amber-500" />
                          Error Root-Cause Analysis
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-medium">
                            Wrong Word Selected: {proofreadingDiagnostics.detectionErrors}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 font-medium">
                            Correction Error: {proofreadingDiagnostics.correctionErrors}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                            Marked "Not Sure": {proofreadingDiagnostics.notSureErrors}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                            Incomplete / Blank: {proofreadingDiagnostics.incompleteErrors}
                          </span>
                        </div>
                      </div>

                      {/* Top weaknesses & advice */}
                      {proofreadingDiagnostics.topWeaknesses.length > 0 && (
                        <div className="text-xs text-slate-600 pt-1 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-700">Flagged Weaknesses:</span>
                          {proofreadingDiagnostics.topWeaknesses.map((w, idx) => (
                            <span key={idx} className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-rose-200">
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Practice List with Question Breakdown */}
                    {proofreadingResults.map(result => {
                      const tipsSet = new Set<number>(result.tips_used || []);

                      return (
                        <div key={result.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                          <div 
                            className="px-5 py-4 cursor-pointer flex justify-between items-center group"
                            onClick={() => toggleExpand(result.id)}
                          >
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                                {(result as any).proofreading_practices?.title || (result as any).practice_title || `${result.sentences.length}-Question Proofreading Practice`}
                              </h4>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span>{formatDate(result.completed_at)}</span>
                                <span>•</span>
                                <span>{formatDuration(result.time_spent_seconds)}</span>
                                <span>•</span>
                                <span>{result.correct_count}/{result.total_count || result.sentences.length} Correct</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className={`px-3 py-1 rounded-full border text-sm font-semibold flex items-center gap-1.5 ${getScoreColor(result.accuracy_percentage)}`}>
                                {result.accuracy_percentage >= 90 && <Trophy size={14} className="text-emerald-600" />}
                                {result.accuracy_percentage}%
                              </div>
                              {expandedId === result.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                            </div>
                          </div>
                          
                          {expandedId === result.id && (
                            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 space-y-4">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                  Question-by-Question Breakdown
                                </h5>
                                <span className="text-xs text-slate-500">Total: {result.sentences.length} Questions</span>
                              </div>

                              <div className="space-y-3">
                                {result.sentences.map((sentence, idx) => {
                                  const userAns = result.user_answers?.find(a => a.lineNumber === idx);
                                  const correctAns = result.correct_answers?.find(a => a.lineNumber === idx);
                                  const qDiag = diagnoseQuestion(sentence, idx, correctAns, userAns, tipsSet);

                                  return (
                                    <div key={idx} className={`p-4 rounded-xl border ${
                                      qDiag.status === 'correct' 
                                        ? 'bg-emerald-50/30 border-emerald-100' 
                                        : qDiag.status === 'incomplete'
                                          ? 'bg-slate-50 border-slate-200'
                                          : qDiag.status === 'not_sure'
                                            ? 'bg-amber-50/30 border-amber-100'
                                            : 'bg-rose-50/30 border-rose-100'
                                    }`}>
                                      {/* Header with question number and badges */}
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                            Question {idx + 1}
                                          </span>
                                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${qDiag.statusColor}`}>
                                            {qDiag.status === 'correct' && <CheckCircle size={13} />}
                                            {qDiag.status === 'detection_error' && <XCircle size={13} />}
                                            {qDiag.status === 'correction_error' && <XCircle size={13} />}
                                            {qDiag.status === 'not_sure' && <HelpCircle size={13} />}
                                            {qDiag.status === 'incomplete' && <MinusCircle size={13} />}
                                            {qDiag.statusLabel}
                                          </span>
                                          <span className="text-xs font-medium text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                            {qDiag.categoryIcon} {qDiag.category}
                                          </span>
                                        </div>

                                        {qDiag.tipUsed && (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                            <Lightbulb size={11} /> Viewed Hint
                                          </span>
                                        )}
                                      </div>

                                      {/* Sentence Word Highlight */}
                                      <div className="p-3 bg-white rounded-lg border border-slate-200 my-2">
                                        <div className="flex flex-wrap items-center gap-1 text-sm leading-relaxed">
                                          {qDiag.tokens.map((token, tIdx) => {
                                            if (token.index === -1) {
                                              return <span key={tIdx}>{token.text}</span>;
                                            }
                                            const isTarget = token.index === qDiag.targetWordIndex;
                                            const isUserPicked = token.index === qDiag.userWordIndex;

                                            if (isUserPicked && isTarget) {
                                              return (
                                                <span key={tIdx} className="px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                  {token.text}
                                                </span>
                                              );
                                            } else if (isUserPicked && !isTarget) {
                                              return (
                                                <span key={tIdx} className="px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300 line-through">
                                                  {token.text}
                                                </span>
                                              );
                                            } else if (isTarget) {
                                              return (
                                                <span key={tIdx} className="px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-900 border border-dashed border-amber-300">
                                                  {token.text}
                                                </span>
                                              );
                                            } else {
                                              return <span key={tIdx} className="text-slate-700">{token.text}</span>;
                                            }
                                          })}
                                        </div>
                                      </div>

                                      {/* Answer Details Comparison */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 pt-2.5 border-t border-slate-200/60">
                                        <div>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                            Student Answer
                                          </span>
                                          {qDiag.isNotSure ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Not Sure</span>
                                          ) : qDiag.isIncomplete ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">Incomplete / Blank</span>
                                          ) : (
                                            <span className={`text-sm font-semibold ${qDiag.status === 'correct' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                              {qDiag.userCorrection || <span className="text-slate-400 italic">None</span>}
                                            </span>
                                          )}
                                        </div>
                                        <div>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                            Answer Key
                                          </span>
                                          <span className="text-sm font-semibold text-emerald-700">
                                            "{qDiag.targetWordText}" ➔ "{qDiag.expectedCorrection}"
                                          </span>
                                        </div>
                                      </div>

                                      {/* Grammar tip */}
                                      {qDiag.tip && (
                                        <div className="mt-2 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 flex items-start gap-1.5 text-xs text-amber-900">
                                          <Lightbulb size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                          <div>
                                            <span className="font-semibold">Grammar Rule:</span>
                                            <span className="ml-1">{qDiag.tip}</span>
                                          </div>
                                        </div>
                                      )}

                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {activeTab === 'memorization' && (
                memorizationSessions.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">No memorization activities found.</div>
                ) : (
                  memorizationSessions.map(session => (
                    <div key={session.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div 
                        className="px-5 py-4 cursor-pointer flex justify-between items-center group"
                        onClick={() => toggleExpand(session.id)}
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{session.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{formatDate(session.completed_at)}</span>
                            <span>•</span>
                            <span>{formatDuration(session.session_duration_seconds)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="px-3 py-1 rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold flex items-center gap-1.5 text-slate-600">
                            {session.hidden_words_count} / {session.total_words} hidden
                          </div>
                          {expandedId === session.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                        </div>
                      </div>
                      
                      {expandedId === session.id && (
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                           <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Original Text</h5>
                           <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                             {session.original_text}
                           </p>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}

              {activeTab === 'spaced_repetition' && (
                <div className="space-y-6">
                  {/* Mastery Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(() => {
                      const mastered = srSchedules.filter(s => (s.ease_factor || 0) >= 3.0 && (s.interval_days || 0) >= 21);
                      const learning = srSchedules.filter(s => !((s.ease_factor || 0) >= 3.0 && (s.interval_days || 0) >= 21));

                      return (
                        <>
                          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl shadow-sm">
                            <div className="flex items-center gap-3 mb-2 text-emerald-700">
                              <Award size={20} />
                              <h4 className="font-bold">Mastered Words</h4>
                            </div>
                            <p className="text-3xl font-black text-emerald-600">{mastered.length}</p>
                            <p className="text-xs text-emerald-600/70 mt-1">High retention (Ease ≥ 3.0, Interval ≥ 21d)</p>
                          </div>
                          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-sm">
                            <div className="flex items-center gap-3 mb-2 text-indigo-700">
                              <BookOpen size={20} />
                              <h4 className="font-bold">Still Learning</h4>
                            </div>
                            <p className="text-3xl font-black text-indigo-600">{learning.length}</p>
                            <p className="text-xs text-indigo-600/70 mt-1">Recently introduced or reviewing</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Word Lists Table */}
                  {srSchedules.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Search size={18} className="text-slate-400" />
                          <h4 className="font-bold text-slate-700">Learning Progress Detail</h4>
                        </div>
                      </div>
                      <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-100">
                              <th className="px-5 py-3 min-w-[200px]">Question / Word</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3">Reps</th>
                              <th className="px-5 py-3">Interval</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {srSchedules.sort((a, b) => b.repetitions - a.repetitions).map(sched => {
                              const isMastered = (sched.ease_factor || 0) >= 3.0 && (sched.interval_days || 0) >= 21;
                              return (
                                <tr key={sched.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-5 py-4 text-slate-700 font-medium truncate max-w-[200px]">
                                    {sched.spaced_repetition_questions?.question_text || 'Unknown'}
                                  </td>
                                  <td className="px-5 py-4">
                                    {isMastered ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 whitespace-nowrap">
                                        <Award size={10} /> Mastered
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 whitespace-nowrap">
                                        <Clock size={10} /> Learning
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-5 py-4 text-slate-600 font-semibold">{sched.repetitions}</td>
                                  <td className="px-5 py-4 text-slate-600">{sched.interval_days}d</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Recent Activity Log */}
                  <div className="mt-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity size={18} className="text-slate-500" />
                      <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Recent Practice History</h4>
                    </div>
                    {srAttempts.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">No practice attempts yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {srAttempts.map(attempt => (
                          <div key={attempt.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="px-5 py-3 flex justify-between items-center group">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-slate-800 truncate pr-4 text-sm">
                                  {attempt.spaced_repetition_questions?.question_text || 'Unknown Question'}
                                </h4>
                                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 font-medium">
                                  <span>{formatDate(attempt.created_at)}</span>
                                  {attempt.response_time_ms && (
                                    <>
                                      <span>•</span>
                                      <span>{Math.round(attempt.response_time_ms / 1000)}s</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                {attempt.is_correct ? (
                                  <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600 uppercase">
                                    Correct
                                  </div>
                                ) : (
                                  <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 uppercase">
                                    Incorrect
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
