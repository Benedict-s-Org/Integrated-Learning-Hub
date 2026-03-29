// ============================================================
// GripStation — iPhone Grip Assessment Page
// ============================================================
// Integrates GripCamera (tracking) and GripClassifier (AI classification).
// Used by teachers to observe and capture student pencil grips.
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import GripCamera, { GripData } from '../components/assessment/grip/GripCamera';
import { 
  classifyGrip, 
  GripClassification, 
  GripType 
} from '../components/assessment/grip/GripClassifier';
import { useSession } from '../components/assessment/shared/useSession';
import { supabase } from '../integrations/supabase/client';

// ─── Component ───────────────────────────────────────────────

export function GripStation() {
  const { session, isLoading: sessionLoading } = useSession({ deviceRole: 'grip' });
  const [currentGripData, setCurrentGripData] = useState<GripData | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Derived State ─────────────────────────────────────────

  const currentClassification = useMemo(() => {
    if (!currentGripData) {
      return classifyGrip({
        thumbIndexAngle: 0,
        wristAngle: 0,
        fingerSpread: 0,
        landmarkConfidence: 0
      });
    }
    return classifyGrip(currentGripData);
  }, [currentGripData]);

  // ── Handlers ──────────────────────────────────────────────

  const handleCapture = async () => {
    if (!session || !currentClassification) return;

    setIsCapturing(true);
    try {
      const { error } = await supabase
        .from('grip_snapshots')
        .insert({
          session_id: session.id,
          grip_type: currentClassification.gripType,
          confidence: currentClassification.confidence,
          recommendation_en: currentClassification.englishLabel + ": " + currentClassification.recommendation,
          recommendation_zh: currentClassification.chineseLabel + ": " + currentClassification.chineseRecommendation,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      setToastMessage('Snapshot captured successfully! / 快照已成功存儲');
    } catch (err) {
      console.error('Capture error:', err);
      setToastMessage('Failed to save snapshot / 儲存快照失敗');
    } finally {
      setIsCapturing(false);
    }
  };

  // Toast auto-clear
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // ── Render Helpers ─────────────────────────────────────────

  const getBadgeColor = (type: GripType) => {
    switch (type) {
      case 'dynamic_tripod': return 'bg-emerald-500';
      case 'lateral_pinch': return 'bg-amber-500';
      case 'fisted_grip':
      case 'thumb_wrap': return 'bg-red-500';
      case 'extended_finger': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Session / 無效會話</h2>
        <p className="text-slate-600 mb-6">Please start an assessment session first. / 請先開始評估會話。</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 1. Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 shadow-sm">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">iPhone Grip Assessment</h1>
            <p className="text-sm text-slate-500 font-medium">iPhone 握筆評估</p>
          </div>
          <div className="text-right">
            <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest">Session Code / 會話編號</span>
            <span className="text-2xl font-black text-slate-900 tracking-tighter">{session.sessionCode}</span>
          </div>
        </div>
      </header>

      {/* 2. Camera Zone (~60% height) */}
      <main className="flex-1 min-h-0 flex flex-col max-w-lg mx-auto w-full">
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1 rounded-3xl overflow-hidden shadow-2xl relative bg-black">
            <GripCamera 
              onGripData={setCurrentGripData} 
              sessionId={session.id} 
            />
          </div>
        </div>

        {/* 3. Classification Panel */}
        <div className="bg-white rounded-t-[2.5rem] border-t border-slate-200 p-6 pb-12 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
          <div className="space-y-6">
            {/* Grip Type Label */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-wider bg-blue-600 mb-1">Detected Grip / 偵測到握法</span>
                <h2 className="text-2xl font-black text-slate-900">
                  {currentClassification.englishLabel}
                </h2>
                <p className="text-lg font-bold text-slate-500">
                  {currentClassification.chineseLabel}
                </p>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${getBadgeColor(currentClassification.gripType)}`}>
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-black uppercase text-slate-400">
                <span>Confidence / 置信度</span>
                <span>{Math.round(currentClassification.confidence * 100)}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className={`h-full transition-all duration-500 ease-out ${getBadgeColor(currentClassification.gripType)}`}
                  style={{ width: `${currentClassification.confidence * 100}%` }}
                />
              </div>
            </div>

            {/* Recommendation */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Recommendation / 建議</p>
              <p className="text-sm font-semibold text-slate-700 leading-relaxed mb-1">{currentClassification.recommendation}</p>
              <p className="text-sm font-bold text-slate-400 leading-relaxed">{currentClassification.chineseRecommendation}</p>
            </div>

            {/* Capture Button */}
            <button
              onClick={handleCapture}
              disabled={isCapturing || currentClassification.gripType === 'unknown'}
              className="w-full h-16 bg-slate-900 active:bg-black text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 transition-all disabled:bg-slate-200 disabled:shadow-none relative overflow-hidden group"
            >
              {isCapturing ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Capturing...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center leading-tight">
                  <span className="text-base">Capture Grip Snapshot</span>
                  <span className="text-xs font-bold text-white/50">拍攝握筆快照</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* 4. Toast */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 bg-slate-900 border border-white/10 text-white rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <p className="font-bold text-sm whitespace-nowrap">{toastMessage}</p>
        </div>
      )}
    </div>
  );
}
