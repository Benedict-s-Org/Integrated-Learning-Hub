import React, { useState, useEffect } from 'react';
import {
  StudentRosterItem,
  AppliedMatching,
  StudentTranscriptState,
  StudentMarkingState,
  ScanPage,
} from '../types';
import {
  evaluateBatchMarkingEligibility,
  BatchMarkingItem,
  BatchMarkingEligibilityResult,
} from '../utils/markingBatchQueue';
import { MarkingModelHealthStatus } from '../services/essayServiceTypes';
import {
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Loader2,
  RefreshCw,
  FileText,
} from 'lucide-react';

interface BatchMarkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartBatch: (itemsToRun: BatchMarkingItem[]) => void;
  students: StudentRosterItem[];
  appliedMatching: AppliedMatching;
  transcripts: Record<string, StudentTranscriptState>;
  markings: Record<string, StudentMarkingState>;
  pages: ScanPage[];
  markingModelHealth: MarkingModelHealthStatus | null;
  onCheckModelStatus: () => Promise<MarkingModelHealthStatus>;
  isCheckingModel: boolean;
}

export const BatchMarkingModal: React.FC<BatchMarkingModalProps> = ({
  isOpen,
  onClose,
  onStartBatch,
  students,
  appliedMatching,
  transcripts,
  markings,
  pages,
  markingModelHealth,
  onCheckModelStatus,
  isCheckingModel,
}) => {
  const [activeTab, setActiveTab] = useState<'to_process' | 'skipped'>('to_process');
  const [eligibility, setEligibility] = useState<BatchMarkingEligibilityResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      const result = evaluateBatchMarkingEligibility({
        students,
        appliedMatching,
        transcripts,
        markings,
        pages,
      });
      setEligibility(result);
      // Auto-check model status if not checked recently
      if (!markingModelHealth) {
        onCheckModelStatus();
      }
    }
  }, [isOpen, students, appliedMatching, transcripts, markings, pages]);

  if (!isOpen || !eligibility) return null;

  const toProcessItems = eligibility.items.filter((item) => item.status === 'pending');
  const skippedItems = eligibility.items.filter((item) => item.status === 'skipped');

  const isModelReady = markingModelHealth?.status === 'ready';
  const isBridgeUnreachable = markingModelHealth?.status === 'bridge_unreachable';
  const isModelUnavailable = markingModelHealth?.status === 'unavailable';

  const canStart = toProcessItems.length > 0 && isModelReady && !isCheckingModel;

  const handleStart = () => {
    if (!canStart) return;
    onStartBatch(toProcessItems);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                批次 AI 批改 (Batch AI Marking)
              </h2>
              <p className="text-xs text-slate-500">
                按學生名單順序逐份處理，每份作文包含全部已核對頁面
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Service & Connection Pre-check Banner */}
          <div className="p-3 rounded-lg border flex items-center justify-between gap-3 bg-slate-50 border-slate-200">
            <div className="flex items-center gap-2.5">
              {isCheckingModel ? (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
              ) : isModelReady ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <div>
                <div className="font-semibold text-slate-800 flex items-center gap-2">
                  <span>模型服務狀態 (Port 18086 via Bridge 18089)</span>
                  {isModelReady && markingModelHealth?.modelId && (
                    <span className="font-mono text-[11px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-normal">
                      {markingModelHealth.modelId}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {isCheckingModel
                    ? '正在檢查 18086 狀態...'
                    : isModelReady
                    ? `18086 模型已連線且可用 (${markingModelHealth?.details || 'Ready'})`
                    : isBridgeUnreachable
                    ? '18089 Bridge 無法連線，請先啟動 Bridge (npm run bridge)'
                    : `18086 模型未就緒 (${markingModelHealth?.details || 'Model unavailable'})`}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckModelStatus}
              disabled={isCheckingModel}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingModel ? 'animate-spin' : ''}`} />
              <span>重新檢查</span>
            </button>
          </div>

          {/* Counts & Eligibility Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
              <span className="text-[11px] font-medium text-blue-700 block">符合條件／即將處理</span>
              <span className="text-xl font-bold text-blue-900 mt-1 block">
                {eligibility.toProcessCount}
                <span className="text-xs font-normal text-blue-600 ml-1">份作文</span>
              </span>
              {eligibility.provisionalCount > 0 && (
                <span className="text-[10px] text-amber-700 font-medium block mt-0.5">
                  （含 {eligibility.provisionalCount} 份未核對臨時評分）
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-[11px] font-medium text-slate-600 block">預設跳過（已批改）</span>
              <span className="text-xl font-bold text-slate-800 mt-1 block">
                {eligibility.alreadyMarkedCount}
                <span className="text-xs font-normal text-slate-500 ml-1">份</span>
              </span>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
              <span className="text-[11px] font-medium text-amber-700 block">跳過（無內容／缺頁）</span>
              <span className="text-xl font-bold text-amber-900 mt-1 block">
                {eligibility.emptyContentCount + (eligibility.skippedCount - eligibility.alreadyMarkedCount - eligibility.emptyContentCount)}
                <span className="text-xs font-normal text-amber-600 ml-1">份</span>
              </span>
            </div>
          </div>

          {/* List Tabs */}
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 mb-2">
              <button
                type="button"
                onClick={() => setActiveTab('to_process')}
                className={`pb-1.5 px-2 font-semibold text-xs border-b-2 transition-colors ${
                  activeTab === 'to_process'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                即將處理 ({toProcessItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('skipped')}
                className={`pb-1.5 px-2 font-semibold text-xs border-b-2 transition-colors ${
                  activeTab === 'skipped'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                跳過名單 ({skippedItems.length})
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
              {activeTab === 'to_process' ? (
                toProcessItems.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    目前沒有符合批次條件的作文（全部皆已批改或尚未分配頁面與內容）。
                  </div>
                ) : (
                  toProcessItems.map((item) => (
                    <div key={item.studentId} className="p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 w-6 text-right">
                          #{item.classNumber}
                        </span>
                        <span className="font-semibold text-slate-800">{item.studentName}</span>
                        <span className="text-slate-400">({item.pageCount} 頁)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.isProvisional ? (
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                            待評分 (臨時)
                          </span>
                        ) : (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                            待批改
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : skippedItems.length === 0 ? (
                <div className="p-6 text-center text-slate-400">沒有被跳過的作文。</div>
              ) : (
                skippedItems.map((item) => (
                  <div key={item.studentId} className="p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 w-6 text-right">
                        #{item.classNumber}
                      </span>
                      <span className="font-semibold text-slate-700">{item.studentName}</span>
                    </div>
                    <span className="text-slate-500 text-[11px]">{item.skipReason}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Execution Invariants Notice */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-slate-600 space-y-1">
            <div className="font-semibold text-blue-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>批次處理安全規則</span>
            </div>
            <ul className="list-disc list-inside text-[11px] space-y-0.5 text-slate-600 pl-1">
              <li>逐份依序處理，全批次同時最多一個模型生成請求，不增加推論負擔。</li>
              <li>每完成一份立即保存批改結果，中途停止已完成之結果不會丟失。</li>
              <li>批改結果保留供教師覆核，不覆蓋手動 findings、修改狀態或評語。</li>
              <li>批次運行期間需保持本分頁開啟；中途可隨時點選「完成目前一份後停止」。</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <div className="text-[11px] text-slate-500">
            {!isModelReady ? (
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                請先確保 18086 模型可用後再開始
              </span>
            ) : toProcessItems.length === 0 ? (
              '無待處理項目'
            ) : (
              `將依序處理 ${toProcessItems.length} 份作文`
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-2xs"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>開始批次批改 ({toProcessItems.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
