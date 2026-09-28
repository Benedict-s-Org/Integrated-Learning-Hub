import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Trophy, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  MinusCircle, 
  HelpCircle, 
  Clock, 
  Lightbulb, 
  BookOpen, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  Sparkles,
  BarChart2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProofreadingPracticeResult } from '../../types';
import { 
  analyzeStudentProofreadingResults, 
  ProofreadingStudentDiagnostic,
  QuestionDiagnosticStatus
} from '../../utils/proofreadingAnalytics';

interface StudentProofreadingDetailModalProps {
  userId: string;
  studentName: string;
  className?: string;
  isArchived?: boolean;
  onClose: () => void;
}

export const StudentProofreadingDetailModal: React.FC<StudentProofreadingDetailModalProps> = ({
  userId,
  studentName,
  className,
  isArchived,
  onClose
}) => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ProofreadingPracticeResult[]>([]);
  const [activeView, setActiveView] = useState<'diagnostics' | 'questions'>('diagnostics');
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedPractices, setExpandedPractices] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStudentResults();
  }, [userId]);

  const loadStudentResults = async () => {
    setLoading(true);
    try {
      let data: any[] = [];

      // Strategy 1: Call SECURITY DEFINER RPC get_student_proofreading_results
      try {
        const { data: rpcData, error: rpcError } = await (supabase as any)
          .rpc('get_student_proofreading_results', { target_user_id: userId });
        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          data = rpcData;
        }
      } catch (err) {
        console.warn('RPC get_student_proofreading_results error, trying fallback:', err);
      }

      // Strategy 2: Direct SELECT from proofreading_practice_results
      if (data.length === 0) {
        try {
          const { data: directData, error: directError } = await (supabase as any)
            .from('proofreading_practice_results')
            .select('*')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false });

          if (!directError && Array.isArray(directData) && directData.length > 0) {
            data = directData;
          }
        } catch (err) {
          console.warn('Direct query proofreading_practice_results error:', err);
        }
      }

      // Strategy 3: Invoke Edge Function proofreading-practices/student-results
      if (data.length === 0) {
        try {
          const { data: edgeData, error: edgeError } = await (supabase.functions as any).invoke(
            'proofreading-practices/student-results',
            { body: { studentUserId: userId } }
          );
          if (!edgeError && edgeData?.results && Array.isArray(edgeData.results) && edgeData.results.length > 0) {
            data = edgeData.results;
          }
        } catch (err) {
          console.warn('Edge function student-results error:', err);
        }
      }

      // Populate practice titles if not already joined
      if (data.length > 0) {
        const practiceIds = [...new Set(data.map((r: any) => r.practice_id).filter(Boolean))];
        if (practiceIds.length > 0) {
          try {
            const { data: practices } = await (supabase as any)
              .from('proofreading_practices')
              .select('id, title')
              .in('id', practiceIds);

            if (practices) {
              const titleMap = new Map(practices.map((p: any) => [p.id, p.title]));
              data.forEach((r: any) => {
                if (r.practice_id && titleMap.has(r.practice_id)) {
                  r.proofreading_practices = { title: titleMap.get(r.practice_id) };
                  r.practice_title = titleMap.get(r.practice_id);
                } else if (r.practice_title) {
                  r.proofreading_practices = { title: r.practice_title };
                }
              });
            }
          } catch (pErr) {
            console.warn('Error fetching practice titles:', pErr);
          }
        }

        setResults(data as ProofreadingPracticeResult[]);
        setExpandedPractices(new Set(data.map((r: any) => r.id)));
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Error fetching student proofreading results:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Compute rich diagnostics
  const diagnostics: ProofreadingStudentDiagnostic = useMemo(() => {
    return analyzeStudentProofreadingResults(results);
  }, [results]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (percentage >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const togglePracticeExpand = (id: string) => {
    setExpandedPractices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered practices for Question-by-Question view
  const filteredPractices = useMemo(() => {
    let list = diagnostics.diagnosedPractices;
    if (selectedPracticeId !== 'all') {
      list = list.filter(p => p.id === selectedPracticeId);
    }

    if (statusFilter === 'all') return list;

    return list.map(p => {
      const matchingQuestions = p.questions.filter(q => {
        if (statusFilter === 'wrong') return q.status !== 'correct';
        if (statusFilter === 'detection_error') return q.status === 'detection_error';
        if (statusFilter === 'correction_error') return q.status === 'correction_error';
        if (statusFilter === 'incomplete') return q.status === 'incomplete';
        if (statusFilter === 'not_sure') return q.status === 'not_sure';
        if (statusFilter === 'correct') return q.status === 'correct';
        return true;
      });
      return {
        ...p,
        questions: matchingQuestions
      };
    }).filter(p => p.questions.length > 0);
  }, [diagnostics.diagnosedPractices, selectedPracticeId, statusFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl h-full max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800">{studentName}</h2>
                {className && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isArchived 
                      ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {isArchived ? `📦 ${className} (Archived)` : className}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Proofreading Diagnostic Report · Total Practices: <span className="font-semibold text-slate-700">{diagnostics.totalPractices}</span> · 
                Overall Accuracy: <span className={`font-semibold ${diagnostics.overallAccuracy >= 70 ? 'text-emerald-600' : 'text-rose-600'}`}>{diagnostics.overallAccuracy}%</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveView('diagnostics')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeView === 'diagnostics' 
                    ? 'bg-white text-indigo-700 shadow-sm font-semibold' 
                    : 'hover:text-slate-900'
                }`}
              >
                <Sparkles size={14} />
                Weakness & Diagnostics
              </button>
              <button
                onClick={() => setActiveView('questions')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeView === 'questions' 
                    ? 'bg-white text-indigo-700 shadow-sm font-semibold' 
                    : 'hover:text-slate-900'
                }`}
              >
                <Layers size={14} />
                Question Breakdown
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Mobile View Switcher */}
        <div className="sm:hidden px-4 py-2 bg-slate-100 flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveView('diagnostics')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${
              activeView === 'diagnostics' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600'
            }`}
          >
            <Sparkles size={14} />
            Diagnostics
          </button>
          <button
            onClick={() => setActiveView('questions')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${
              activeView === 'questions' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-600'
            }`}
          >
            <Layers size={14} />
            Questions
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <Loader2 className="animate-spin text-indigo-500" size={36} />
              <p className="text-sm">Loading student proofreading results and diagnostic analysis...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-72 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <BookOpen size={44} className="text-slate-300 mb-2" />
              <p className="text-base font-medium text-slate-600">No Proofreading Practice Records Found</p>
              <p className="text-xs text-slate-400 mt-1">This student has not completed any Proofreading exercises yet.</p>
            </div>
          ) : activeView === 'diagnostics' ? (
            /* ========================================================
               TAB 1: DIAGNOSTICS & WEAKNESS ANALYSIS
               ======================================================== */
            <div className="space-y-6">
              
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Questions</span>
                  <span className="text-2xl font-bold text-slate-800 mt-0.5 block">{diagnostics.totalQuestions}</span>
                  <span className="text-[10px] text-slate-400">{diagnostics.totalPractices} Sessions</span>
                </div>

                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle size={13} /> Correct Answers
                  </span>
                  <span className="text-2xl font-bold text-emerald-800 mt-0.5 block">{diagnostics.correctQuestions}</span>
                  <span className="text-[10px] text-emerald-600 font-medium">Accuracy {diagnostics.overallAccuracy}%</span>
                </div>

                <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-200">
                  <span className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                    <XCircle size={13} /> Incorrect
                  </span>
                  <span className="text-2xl font-bold text-rose-800 mt-0.5 block">{diagnostics.incorrectQuestions}</span>
                  <span className="text-[10px] text-rose-600">
                    {diagnostics.totalQuestions > 0 ? Math.round((diagnostics.incorrectQuestions / diagnostics.totalQuestions) * 100) : 0}% Error Rate
                  </span>
                </div>

                <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                  <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                    <HelpCircle size={13} /> Marked "Not Sure"
                  </span>
                  <span className="text-2xl font-bold text-amber-800 mt-0.5 block">{diagnostics.notSureQuestions}</span>
                  <span className="text-[10px] text-amber-600 font-medium">Gave Up / Low Confidence</span>
                </div>

                <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-300">
                  <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                    <MinusCircle size={13} /> Incomplete / Blank
                  </span>
                  <span className="text-2xl font-bold text-slate-800 mt-0.5 block">{diagnostics.incompleteQuestions}</span>
                  <span className="text-[10px] text-slate-500">Unattempted</span>
                </div>

                <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-200">
                  <span className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
                    <Lightbulb size={13} /> Hints Viewed
                  </span>
                  <span className="text-2xl font-bold text-indigo-800 mt-0.5 block">{diagnostics.tipsUsedCount}</span>
                  <span className="text-[10px] text-indigo-600 font-medium">Total Time {formatDuration(diagnostics.totalTimeSeconds)}</span>
                </div>
              </div>

              {/* Error Root-Causes Analysis */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" size={18} />
                    <h3 className="font-bold text-slate-800 text-base">Error Root-Cause Diagnosis</h3>
                  </div>
                  <span className="text-xs text-slate-400">Breakdown of student mistake patterns</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Cause 1: Detection Error */}
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                          🔍 Wrong Word Selected
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          {diagnostics.incorrectQuestions > 0 ? Math.round((diagnostics.detectionErrors / diagnostics.incorrectQuestions) * 100) : 0}% of errors
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-rose-900 mt-2">
                        {diagnostics.detectionErrors} <span className="text-sm font-normal text-rose-700">questions</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        The student failed to locate the grammatical error in the sentence, indicating a need to build intuition for unnatural phrasing.
                      </p>
                    </div>
                  </div>

                  {/* Cause 2: Correction Error */}
                  <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-orange-700 flex items-center gap-1">
                          ✏️ Correction Error
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                          {diagnostics.incorrectQuestions > 0 ? Math.round((diagnostics.correctionErrors / diagnostics.incorrectQuestions) * 100) : 0}% of errors
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-orange-900 mt-2">
                        {diagnostics.correctionErrors} <span className="text-sm font-normal text-orange-700">questions</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        The student found the flawed word, but made a spelling, inflection, or grammar error when typing the replacement word.
                      </p>
                    </div>
                  </div>

                  {/* Cause 3: Not Sure */}
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                          ❓ Marked "Not Sure"
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {diagnostics.incorrectQuestions > 0 ? Math.round((diagnostics.notSureErrors / diagnostics.incorrectQuestions) * 100) : 0}% of errors
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-amber-900 mt-2">
                        {diagnostics.notSureErrors} <span className="text-sm font-normal text-amber-700">questions</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        The student actively surrendered the question, indicating unfamiliarity with the specific grammatical rule tested.
                      </p>
                    </div>
                  </div>

                  {/* Cause 4: Incomplete */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          ⏳ Incomplete / Blank
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          {diagnostics.incorrectQuestions > 0 ? Math.round((diagnostics.incompleteErrors / diagnostics.incorrectQuestions) * 100) : 0}% of errors
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800 mt-2">
                        {diagnostics.incompleteErrors} <span className="text-sm font-normal text-slate-600">questions</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                        Question was submitted blank or unattempted. Remind the student to manage their time and attempt every sentence.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Grammar Category Breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="text-indigo-600" size={18} />
                    <h3 className="font-bold text-slate-800 text-base">Grammar Weakness Categories</h3>
                  </div>
                  <span className="text-xs text-slate-400">Sorted from lowest to highest accuracy</span>
                </div>

                <div className="space-y-3.5">
                  {diagnostics.categories.map((cat, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors bg-slate-50/30">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cat.categoryIcon}</span>
                          <span className="font-semibold text-slate-800">{cat.category}</span>
                          {cat.isWeakness ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              ⚠️ Needs Priority Support
                            </span>
                          ) : cat.accuracy >= 85 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              ✅ Proficient
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-700">
                              ⚡ Satisfactory
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">
                            Total: {cat.total} Qs · {cat.correct} Correct / {cat.incorrect} Wrong
                          </span>
                          <span className={`font-bold text-sm min-w-[45px] text-right ${
                            cat.accuracy >= 90 ? 'text-emerald-600' : cat.accuracy >= 70 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {cat.accuracy}%
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            cat.accuracy >= 85 ? 'bg-emerald-500' : cat.accuracy >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${cat.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-blue-50/70 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="text-indigo-600" size={18} />
                  <h3 className="font-bold text-indigo-950 text-base">Actionable Teaching Guidance</h3>
                </div>

                <div className="space-y-2.5">
                  {diagnostics.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-white/80 p-3 rounded-xl border border-indigo-100/60 shadow-2xs">
                      <ArrowRight size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                        {rec}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            /* ========================================================
               TAB 2: QUESTION-BY-QUESTION RIGHT / WRONG BREAKDOWN
               ======================================================== */
            <div className="space-y-6">
              
              {/* Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <Filter size={14} className="text-slate-400" />
                    Filter Practice:
                  </div>
                  <select
                    value={selectedPracticeId}
                    onChange={(e) => setSelectedPracticeId(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Practice Sessions ({diagnostics.diagnosedPractices.length})</option>
                    {diagnostics.diagnosedPractices.map((p, idx) => (
                      <option key={p.id} value={p.id}>
                        Session #{diagnostics.diagnosedPractices.length - idx} - {formatDate(p.completedAt)} ({p.accuracyPercentage}%)
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Questions (All)</option>
                    <option value="wrong">All Incorrect Questions (incl. Not Sure & Blank)</option>
                    <option value="detection_error">Only Detection Errors (Wrong Word Selected)</option>
                    <option value="correction_error">Only Correction Errors (Wrong Revision)</option>
                    <option value="not_sure">Only "Not Sure"</option>
                    <option value="incomplete">Only Incomplete / Blank</option>
                    <option value="correct">Only Correct Questions</option>
                  </select>
                </div>

                <div className="text-xs text-slate-500">
                  Showing <span className="font-bold text-slate-800">{filteredPractices.reduce((acc, p) => acc + p.questions.length, 0)}</span> Questions
                </div>
              </div>

              {/* Practices List */}
              {filteredPractices.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                  No questions match the selected filter.
                </div>
              ) : (
                filteredPractices.map((practice) => {
                  const isExpanded = expandedPractices.has(practice.id);

                  return (
                    <div key={practice.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                      
                      {/* Practice Header Bar */}
                      <div 
                        onClick={() => togglePracticeExpand(practice.id)}
                        className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/80 cursor-pointer flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getScoreColor(practice.accuracyPercentage)}`}>
                            {practice.accuracyPercentage}%
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              {practice.title}
                              <span className="text-xs font-normal text-slate-500">
                                ({practice.correctCount}/{practice.totalCount} Correct)
                              </span>
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <Calendar size={12} />
                              <span>{formatDate(practice.completedAt)}</span>
                              <span>•</span>
                              <Clock size={12} />
                              <span>Time: {formatDuration(practice.timeSpentSeconds)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="text-xs font-medium text-slate-500">
                            {practice.questions.length} Qs
                          </span>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {/* Question-by-Question List */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 space-y-4 divide-y divide-slate-100">
                          {practice.questions.map((q) => (
                            <div key={q.lineNumber} className={`pt-4 first:pt-0 ${
                              q.status === 'correct' 
                                ? 'bg-white' 
                                : q.status === 'incomplete' 
                                  ? 'bg-slate-50/60 p-3 rounded-xl border border-slate-200' 
                                  : 'bg-rose-50/20 p-3.5 rounded-xl border border-rose-100'
                            }`}>
                              
                              {/* Question Top Meta */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-md">
                                    Question {q.lineNumber + 1}
                                  </span>

                                  {/* Diagnostic Status Pill */}
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${q.statusColor}`}>
                                    {q.status === 'correct' && <CheckCircle size={13} />}
                                    {q.status === 'detection_error' && <XCircle size={13} />}
                                    {q.status === 'correction_error' && <XCircle size={13} />}
                                    {q.status === 'not_sure' && <HelpCircle size={13} />}
                                    {q.status === 'incomplete' && <MinusCircle size={13} />}
                                    {q.statusLabel}
                                  </span>

                                  {/* Grammar Category Pill */}
                                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {q.categoryIcon} {q.category}
                                  </span>
                                </div>

                                {q.tipUsed && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    <Lightbulb size={12} /> Viewed Hint
                                  </span>
                                )}
                              </div>

                              {/* Interactive Sentence Visualization */}
                              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 my-2.5">
                                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                  Sentence & Token Comparison
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 leading-relaxed text-sm">
                                  {q.tokens.map((token, tIdx) => {
                                    if (token.index === -1) {
                                      // Whitespace
                                      return <span key={tIdx}>{token.text}</span>;
                                    }

                                    const isTarget = token.index === q.targetWordIndex;
                                    const isUserPicked = token.index === q.userWordIndex;

                                    if (isUserPicked && isTarget) {
                                      // Correctly picked error word
                                      return (
                                        <span 
                                          key={tIdx}
                                          className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 border-2 border-emerald-400 shadow-2xs"
                                          title="Student identified this word (Correctly detected)"
                                        >
                                          {token.text}
                                        </span>
                                      );
                                    } else if (isUserPicked && !isTarget) {
                                      // Wrong word chosen by student
                                      return (
                                        <span 
                                          key={tIdx}
                                          className="px-2 py-0.5 rounded-md font-bold bg-rose-100 text-rose-800 border-2 border-rose-400 line-through shadow-2xs"
                                          title="Student mistakenly picked this word (Detection error)"
                                        >
                                          {token.text}
                                        </span>
                                      );
                                    } else if (isTarget) {
                                      // Target word that was missed by student
                                      return (
                                        <span 
                                          key={tIdx}
                                          className="px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-900 border-2 border-dashed border-amber-400"
                                          title="Target word needing revision (Missed by student)"
                                        >
                                          {token.text}
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span key={tIdx} className="text-slate-700">
                                          {token.text}
                                        </span>
                                      );
                                    }
                                  })}
                                </div>
                              </div>

                              {/* Answer Details Comparison Grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                
                                {/* Student Answer Box */}
                                <div className={`p-3 rounded-xl border ${
                                  q.status === 'correct' 
                                    ? 'bg-emerald-50/50 border-emerald-200' 
                                    : q.status === 'incomplete' 
                                      ? 'bg-slate-100/60 border-slate-300' 
                                      : 'bg-rose-50/50 border-rose-200'
                                }`}>
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Student Answer
                                  </span>
                                  <div className="text-sm">
                                    <span className="text-xs text-slate-500">Selected Word:</span>
                                    <span className="font-semibold text-slate-800 ml-1">
                                      {q.userWordText ? `"${q.userWordText}"` : <span className="text-slate-400 italic">No word selected</span>}
                                    </span>
                                  </div>
                                  <div className="text-sm mt-1">
                                    <span className="text-xs text-slate-500">Correction:</span>
                                    <span className={`font-bold ml-1 ${
                                      q.status === 'correct' ? 'text-emerald-700' : 'text-rose-700'
                                    }`}>
                                      {q.isNotSure ? (
                                        <span className="text-amber-700 font-semibold bg-amber-100 px-2 py-0.5 rounded text-xs">Not Sure</span>
                                      ) : q.isIncomplete ? (
                                        <span className="text-slate-500 italic bg-slate-200 px-2 py-0.5 rounded text-xs">Incomplete / Blank</span>
                                      ) : (
                                        q.userCorrection || <span className="text-slate-400 italic">None</span>
                                      )}
                                    </span>
                                  </div>
                                </div>

                                {/* Correct Answer Box */}
                                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Answer Key
                                  </span>
                                  <div className="text-sm">
                                    <span className="text-xs text-slate-500">Target Word:</span>
                                    <span className="font-bold text-amber-900 ml-1">
                                      "{q.targetWordText}"
                                    </span>
                                  </div>
                                  <div className="text-sm mt-1">
                                    <span className="text-xs text-slate-500">Correct Revision:</span>
                                    <span className="font-bold text-emerald-800 ml-1">
                                      "{q.expectedCorrection}"
                                    </span>
                                  </div>
                                </div>

                              </div>

                              {/* Grammar Tip Box */}
                              {q.tip && (
                                <div className="mt-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
                                  <Lightbulb size={15} className="text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold">Grammar Rule & Explanation:</span>
                                    <span className="ml-1 font-medium">{q.tip}</span>
                                  </div>
                                </div>
                              )}

                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  );
                })
              )}

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Total Questions: <span className="font-bold text-slate-800">{diagnostics.totalQuestions}</span> · 
            Flagged Weaknesses: {diagnostics.topWeaknesses.length > 0 ? diagnostics.topWeaknesses.join(', ') : 'No significant weaknesses flagged'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
