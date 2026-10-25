import React from 'react';
import { TranscriptionProvider } from '../types';
import { BatchQueueProgress } from '../utils/transcriptionBatchQueue';
import {
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
} from 'lucide-react';

interface TranscriptionToolbarProps {
  provider: TranscriptionProvider;
  onSelectProvider: (provider: TranscriptionProvider) => void;
  onOpenSettings: () => void;
  onTranscribeAllPending: () => void;
  pendingCount: number;
  isBatchRunning: boolean;
  batchProgress: BatchQueueProgress | null;
  onPauseBatch: () => void;
  onResumeBatch: () => void;
  onRetryFailed: () => void;
  hasWritingAreas?: boolean;
  onNavigateToPreparation?: () => void;
  pageCount?: number;
  pageStage?: 'ready' | 'ocr_running' | 'vl_running' | 'completed' | 'failed' | 'verification_pending';
  isDryRun?: boolean;
  isMathpixConfigured?: boolean;
  qwenStatus?: 'available' | 'error' | 'checking' | null;
  onTranscribeActive?: () => void;
  isTranscribingActive?: boolean;
  onRetryQwenVerify?: () => void;
  hasMathpixOutput?: boolean;
}

export const TranscriptionToolbar: React.FC<TranscriptionToolbarProps> = ({
  provider,
  onSelectProvider,
  onOpenSettings,
  onTranscribeAllPending,
  pendingCount,
  isBatchRunning,
  batchProgress,
  onPauseBatch,
  onResumeBatch,
  onRetryFailed,
  hasWritingAreas = true,
  onNavigateToPreparation,
  pageCount = 1,
  pageStage = 'ready',
  isDryRun = true,
  isMathpixConfigured = true,
  qwenStatus = null,
  onTranscribeActive,
  isTranscribingActive = false,
  onRetryQwenVerify,
  hasMathpixOutput = false,
}) => {
  const percentComplete =
    batchProgress && batchProgress.totalTasks > 0
      ? Math.round((batchProgress.completedTasks / batchProgress.totalTasks) * 100)
      : 0;

  // Normalized provider mode for display
  const currentMode =
    provider === 'local_qwen_vl'
      ? 'local_qwen_vl'
      : provider === 'mathpix_qwen_verify'
      ? 'mathpix_qwen_verify'
      : 'mathpix_only';

  const modeExplanation =
    currentMode === 'local_qwen_vl'
      ? 'Direct local OCR using Qwen VL on port 18088. Transcribes student handwriting locally without sending scans to Mathpix or consuming external API quota.'
      : currentMode === 'mathpix_qwen_verify'
      ? 'Run Mathpix OCR first, then send the page image and Mathpix transcript to Qwen VL (port 18088) to verify transcription accuracy. Preserves handwritten student errors.'
      : 'Send the selected page to Mathpix for handwriting recognition. Converts to transcript for manual teacher verification without calling local vision models.';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs space-y-3">
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mode Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label htmlFor="transcription-provider-select" className="text-xs font-bold text-slate-800 whitespace-nowrap">
            OCR Mode:
          </label>
          <select
            id="transcription-provider-select"
            value={currentMode}
            onChange={(e) => onSelectProvider(e.target.value as TranscriptionProvider)}
            className="text-xs font-semibold border border-slate-300 rounded-md py-1.5 px-2.5 bg-white text-slate-800 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-w-[240px]"
          >
            <option value="mathpix_only">Mathpix OCR</option>
            <option value="local_qwen_vl">Qwen VL OCR — Local only</option>
            <option value="mathpix_qwen_verify">Mathpix OCR + Qwen VL Verify</option>
          </select>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-2xs min-h-[32px]"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Transcription Settings</span>
          </button>

          <button
            type="button"
            onClick={onTranscribeAllPending}
            disabled={isBatchRunning || pendingCount === 0 || !hasWritingAreas}
            title={
              !hasWritingAreas
                ? 'Writing areas must be configured in Preparation before transcribing'
                : pendingCount === 0
                ? 'No pending unverified essays to transcribe'
                : 'Queue batch transcription for all eligible pending essays'
            }
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-2xs min-h-[32px] ${
              isBatchRunning
                ? 'bg-purple-100 text-purple-700 cursor-not-allowed border border-purple-200'
                : !hasWritingAreas || pendingCount === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {isBatchRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Batch Transcribing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Transcribe All Pending Essays ({pendingCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mode Explanation & Service Health Row */}
      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-1.5 text-slate-700">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <span>
              <strong>
                {currentMode === 'local_qwen_vl'
                  ? 'Qwen VL OCR — Local only:'
                  : currentMode === 'mathpix_qwen_verify'
                  ? 'Mathpix OCR + Qwen VL Verify:'
                  : 'Mathpix OCR:'}
              </strong>{' '}
              {modeExplanation}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentMode !== 'local_qwen_vl' && (
              isDryRun ? (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded shadow-2xs"
                  title="Safety Gate: DRY_RUN mode blocks live paid API calls to Mathpix."
                >
                  <ShieldAlert className="w-3 h-3 text-amber-700" />
                  <span>DRY_RUN Safety Active</span>
                </span>
              ) : isMathpixConfigured ? (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded shadow-2xs"
                  title="Mathpix credentials configured. Paid live OCR is authorized."
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>Mathpix Live Active</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-100/90 border border-rose-300 px-2 py-0.5 rounded shadow-2xs"
                  title="Mathpix credentials are not configured in the bridge .env."
                >
                  <AlertCircle className="w-3 h-3 text-rose-700" />
                  <span>Mathpix Not Configured</span>
                </span>
              )
            )}

            {(currentMode === 'local_qwen_vl' || currentMode === 'mathpix_qwen_verify') && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border shadow-2xs ${
                  qwenStatus === 'available'
                    ? 'text-emerald-800 bg-emerald-100/90 border-emerald-300'
                    : 'text-amber-800 bg-amber-100/90 border-amber-300'
                }`}
                title={
                  qwenStatus === 'available'
                    ? 'Qwen VL on port 18088 is online and ready for OCR.'
                    : 'Qwen VL on port 18088 is unreachable or offline.'
                }
              >
                {qwenStatus === 'available' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    <span>Qwen VL (18088) Ready</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-700" />
                    <span>Qwen VL (18088) Offline</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Page Level State & Action Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Active Student:</span>
            <span className="font-medium text-slate-800">{pageCount} {pageCount === 1 ? 'page' : 'pages'}</span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-slate-600">Status:</span>
            {pageStage === 'ocr_running' ? (
              <span className="inline-flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                <span>Mathpix OCR Running...</span>
              </span>
            ) : pageStage === 'vl_running' ? (
              <span className="inline-flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                <span>{currentMode === 'local_qwen_vl' ? 'Qwen VL OCR Running...' : 'Qwen VL Verification Running...'}</span>
              </span>
            ) : pageStage === 'verification_pending' ? (
              <span className="inline-flex items-center gap-1 text-amber-800 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Qwen Verification Incomplete</span>
              </span>
            ) : pageStage === 'completed' ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Completed</span>
              </span>
            ) : pageStage === 'failed' ? (
              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                <AlertCircle className="w-3 h-3 text-rose-600" />
                <span>Failed</span>
              </span>
            ) : (
              <span className="text-slate-600 font-medium">Ready</span>
            )}
          </div>

          {/* Dedicated retry action for Qwen verification without re-billing Mathpix */}
          {hasMathpixOutput && pageStage === 'verification_pending' && onRetryQwenVerify && (
            <button
              type="button"
              onClick={onRetryQwenVerify}
              disabled={isTranscribingActive}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors shadow-2xs"
            >
              <RotateCcw className="w-3 h-3 text-amber-700" />
              <span>Retry Qwen Verification Only (No Mathpix Re-charge)</span>
            </button>
          )}
        </div>
      </div>


      {/* Missing Required Writing Areas Warning Banner */}
      {!hasWritingAreas && (
        <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <strong>Missing Writing Areas:</strong> No writing regions have been marked on the template worksheet in Preparation. Transcription is blocked until writing areas are configured.
            </div>
          </div>
          {onNavigateToPreparation && (
            <button
              type="button"
              onClick={onNavigateToPreparation}
              className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded transition-colors shrink-0 whitespace-nowrap ml-2"
            >
              Configure Writing Areas in Preparation →
            </button>
          )}
        </div>
      )}

      {/* Batch Queue Progress Panel */}
      {batchProgress && (
        <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-md space-y-2 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-purple-900">
                Batch Queue:
              </span>
              <span className="text-purple-700 font-medium">
                Pages: {batchProgress.completedTasks} / {batchProgress.totalTasks} ({percentComplete}%)
              </span>
              <span className="text-purple-400">•</span>
              <span className="text-purple-700 font-medium">
                Essays: {batchProgress.completedEssays} / {batchProgress.totalEssays}
              </span>
            </div>

            {/* Queue Control Buttons */}
            <div className="flex items-center gap-2">
              {batchProgress.status === 'running' && (
                <button
                  type="button"
                  onClick={onPauseBatch}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors shadow-2xs"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pause Queue</span>
                </button>
              )}

              {batchProgress.status === 'pausing' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>Pausing after the current page...</span>
                </span>
              )}

              {batchProgress.status === 'paused' && (
                <button
                  type="button"
                  onClick={onResumeBatch}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-white border border-purple-200 hover:bg-purple-50 rounded transition-colors shadow-2xs"
                >
                  <Play className="w-3.5 h-3.5 text-purple-600" />
                  <span>Resume Queue</span>
                </button>
              )}

              {batchProgress.failedTasks > 0 && batchProgress.status !== 'running' && batchProgress.status !== 'pausing' && (
                <button
                  type="button"
                  onClick={onRetryFailed}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>Retry Failed Pages ({batchProgress.failedTasks})</span>
                </button>
              )}

              {batchProgress.status === 'completed' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Completed</span>
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-purple-200/60 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 transition-all duration-300 rounded-full ${
                batchProgress.status === 'paused' || batchProgress.status === 'pausing'
                  ? 'bg-amber-500'
                  : 'bg-purple-600'
              }`}
              style={{ width: `${percentComplete}%` }}
            />
          </div>

          {/* Live Details & Context Safety Notice */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <div>
              {batchProgress.status === 'running' && batchProgress.currentStudentName ? (
                <span>
                  Processing: <strong>{batchProgress.currentStudentName}</strong> · Page {batchProgress.currentPageNumber} of {batchProgress.currentTotalParts}
                </span>
              ) : batchProgress.status === 'pausing' ? (
                <span className="text-amber-800 font-medium">
                  Active page inference completing. Queue will pause momentarily.
                </span>
              ) : batchProgress.status === 'paused' ? (
                <span className="text-amber-700 font-medium">
                  Queue paused. In-flight page completed cleanly. Click Resume Queue to continue.
                </span>
              ) : (
                <span>
                  Ready · {batchProgress.failedTasks} failed, {batchProgress.skippedStudents?.length || 0} skipped.
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 italic">
              Progress is stored only in this session. Reloading may lose unfinished work.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
