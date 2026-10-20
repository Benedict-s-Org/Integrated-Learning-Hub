import React, { useState } from 'react';
import { StagedCandidateTranscript } from '../types';
import {
  Sparkles,
  ArrowDownToLine,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  AlertTriangle,
  FileText,
  RotateCcw,
} from 'lucide-react';

interface StagedCandidateBoxProps {
  candidate: StagedCandidateTranscript;
  studentId: string;
  isStale: boolean;
  staleReason?: string;
  onApply: () => void;
  onCopy: () => void;
  onDiscard: () => void;
  onRetryPage?: (scanPageId: string, part: number) => void;
  onRetryQwenVerify?: () => void;
  isRetryingQwen?: boolean;
  perPageLoading?: Record<string, boolean>;
  isCopied: boolean;
  assignmentId?: string;
  highlightedLineIndex?: number | null;
  onSelectLine?: (index: number | null) => void;
}

export const StagedCandidateBox: React.FC<StagedCandidateBoxProps> = ({
  candidate,
  studentId,
  isStale,
  staleReason,
  onApply,
  onCopy,
  onDiscard,
  onRetryPage,
  onRetryQwenVerify,
  isRetryingQwen = false,
  perPageLoading,
  isCopied,
  assignmentId,
  highlightedLineIndex,
  onSelectLine,
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isChangesOpen, setIsChangesOpen] = useState(false);
  const wordCount = candidate.transcript.trim()
    ? candidate.transcript.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const isQwenIncomplete =
    candidate.ocrMode === 'mathpix_qwen_verify' &&
    candidate.qwenVerificationStatus === 'failed';

  const isQwenSuccess =
    candidate.ocrMode === 'mathpix_qwen_verify' &&
    candidate.qwenVerificationStatus === 'success';

  const statusLabel =
    candidate.isDryRun
      ? 'DRY_RUN Ready (No charges)'
      : isQwenIncomplete
      ? 'Qwen Verification Incomplete'
      : isQwenSuccess
      ? 'Verified Candidate (Mathpix + Qwen VL)'
      : candidate.ocrMode === 'mathpix_only'
      ? 'Candidate Ready (Mathpix Only)'
      : candidate.status === 'candidate_ready'
      ? 'Candidate Ready'
      : candidate.status === 'partially_transcribed'
      ? 'Partially Transcribed'
      : 'Transcription Failed';

  const statusBadgeClass =
    candidate.isDryRun
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : isQwenIncomplete
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : isQwenSuccess
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : candidate.status === 'candidate_ready'
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : candidate.status === 'partially_transcribed'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-rose-100 text-rose-800 border-rose-200';

  return (
    <div className="mb-3 p-3 bg-purple-50/80 border border-purple-200 rounded-md animate-in fade-in duration-150 space-y-2.5">
      {/* Header Row */}
      <div className="flex items-center justify-between pb-2 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-bold text-purple-900">
            Candidate Transcript (Pending Teacher Approval)
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusBadgeClass}`}>
            {statusLabel}
          </span>
        </div>
        <span className="text-[10px] text-purple-600 font-medium">
          Received {new Date(candidate.receivedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Stale Context Warning */}
      {isStale && (
        <div className="flex items-start gap-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong>Context Mismatch / Stale Candidate:</strong>{' '}
            {staleReason || 'Scan page assignments have changed since this transcription was generated.'}{' '}
            Please run transcription again for this student before applying.
          </div>
        </div>
      )}

      {/* Qwen Incomplete Warning & Retry */}
      {isQwenIncomplete && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Qwen VL Verification Incomplete:</strong> The OCR candidate from Mathpix is ready below, but verification on port 18088 was not completed. You can retry verification without re-billing Mathpix.
            </div>
          </div>
          {onRetryQwenVerify && (
            <button
              type="button"
              onClick={onRetryQwenVerify}
              disabled={isRetryingQwen}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors shadow-2xs whitespace-nowrap self-start sm:self-auto shrink-0"
            >
              {isRetryingQwen ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>Verifying with Qwen...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Retry Qwen Verification</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Verified Changes Accordion */}
      {candidate.qwenChanges && candidate.qwenChanges.length > 0 && (
        <div className="border border-emerald-200 bg-emerald-50/60 rounded p-2 text-xs">
          <button
            type="button"
            onClick={() => setIsChangesOpen(!isChangesOpen)}
            className="flex items-center justify-between w-full text-emerald-900 font-semibold text-left"
          >
            <span>✓ Verified & Corrected {candidate.qwenChanges.length} OCR Misreads</span>
            {isChangesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {isChangesOpen && (
            <div className="mt-2 space-y-1 pt-1 border-t border-emerald-200/60 text-[11px] text-emerald-950">
              {candidate.qwenChanges.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 font-mono">
                  <span className="text-rose-700 line-through">{c.ocrOriginal}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-emerald-700 font-bold">{c.verified}</span>
                  <span className="text-slate-500 font-sans text-[10px]">({c.reason})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Candidate Text Content / Page Errors */}
      <div className="p-2.5 bg-white border border-purple-100 rounded text-xs text-slate-800 font-serif leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap break-words select-text shadow-2xs">
        {candidate.pageResults && candidate.pageResults.length > 0 ? (
          <div className="space-y-3">
            {candidate.pageResults.map((pr, idx) => {
              const text = (pr.transcript || '').replace(/\r\n/g, '\n');
              const isPageRetrying = !!perPageLoading?.[pr.scanPageId];

              if (pr.status === 'failed') {
                return (
                  <div
                    key={pr.scanPageId || idx}
                    className="p-3 bg-rose-50/90 border border-rose-200 rounded-md font-sans text-xs space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-rose-200/60">
                      <div className="flex items-center gap-1.5 font-bold text-rose-900">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Page {pr.part} of {pr.totalParts} — Transcription Failed</span>
                      </div>
                      {pr.httpStatus !== undefined && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold border border-rose-200">
                          HTTP {pr.httpStatus}
                        </span>
                      )}
                    </div>

                    <div className="text-rose-800 space-y-0.5 pt-0.5">
                      <div>
                        <span className="font-semibold text-rose-900">Code:</span>{' '}
                        <span className="font-mono text-[11px] bg-rose-100 px-1 py-0.5 rounded text-rose-900 font-medium">
                          {pr.errorCode || 'CAUSE_UNAVAILABLE'}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-rose-900">Message:</span>{' '}
                        <span>{pr.error || 'Cause unavailable.'}</span>
                      </div>
                    </div>

                    {onRetryPage && pr.isRetryable !== false && (
                      <div className="pt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRetryPage(pr.scanPageId, pr.part)}
                          disabled={isPageRetrying}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-white text-rose-800 border border-rose-300 hover:bg-rose-100 transition-colors shadow-2xs disabled:opacity-50"
                        >
                          {isPageRetrying ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                              <span>Retrying Page {pr.part}...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                              <span>Retry Page {pr.part}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              let lineOffset = 0;
              for (let p = 0; p < idx; p++) {
                const prev = candidate.pageResults[p];
                if (prev.status === 'success') {
                  const count = prev.linesWithBboxes?.length ?? (prev.transcript ? prev.transcript.replace(/\r\n/g, '\n').split('\n').length : 0);
                  lineOffset += count;
                }
              }

              const lineItems = pr.linesWithBboxes && pr.linesWithBboxes.length > 0
                ? pr.linesWithBboxes.map((l) => l.text)
                : (text ? text.split('\n') : []);

              return (
                <div key={pr.scanPageId || idx} className="space-y-1">
                  {candidate.pageResults.length > 1 && (
                    <div className="flex items-center gap-1.5 py-1 select-none text-[10px] font-sans font-semibold text-purple-700 bg-purple-50/70 px-2 rounded border border-dashed border-purple-200">
                      <FileText className="w-3 h-3 text-purple-500 shrink-0" />
                      <span>Page {pr.part} of {pr.totalParts}</span>
                    </div>
                  )}
                  {lineItems.length > 0 ? (
                    <div className="space-y-0.5 font-serif">
                      {lineItems.map((lineText, lIdx) => {
                        const globalIdx = lineOffset + lIdx;
                        const isLineActive = highlightedLineIndex === globalIdx;
                        return (
                          <div
                            key={lIdx}
                            onClick={() => onSelectLine?.(isLineActive ? null : globalIdx)}
                            className={`flex items-start gap-2 py-0.5 px-1.5 rounded cursor-pointer transition-colors text-xs ${
                              isLineActive
                                ? 'bg-purple-100 border-l-4 border-purple-600 font-semibold text-purple-950 pl-2 shadow-2xs'
                                : 'hover:bg-purple-50/70 text-slate-800'
                            }`}
                            title={`Click to highlight Line ${globalIdx + 1} on scan`}
                          >
                            <span className="shrink-0 w-6 select-none text-[10px] text-slate-400 font-mono pt-0.5">
                              L{globalIdx + 1}
                            </span>
                            <span className="flex-1 break-words">
                              {lineText || <span className="italic text-slate-400 font-sans text-[11px] select-none">(blank line)</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words font-serif text-slate-400 italic">
                      Empty page text
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {candidate.transcript ? (
              candidate.transcript.replace(/\r\n/g, '\n')
            ) : (
              <span className="italic text-slate-400">No text transcribed.</span>
            )}
          </div>
        )}
      </div>

      {/* Per-Page Breakdown Badges */}
      {candidate.pageResults && candidate.pageResults.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
          <span className="font-semibold text-slate-700">Pages:</span>
          {candidate.pageResults.map((pr) => {
            const pageWords = pr.transcript ? pr.transcript.trim().split(/\s+/).length : 0;
            return (
              <span
                key={pr.scanPageId}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                  pr.status === 'success'
                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                Page {pr.part} of {pr.totalParts}:{' '}
                {pr.status === 'success' ? `${pageWords} words` : `Failed (${pr.errorCode || 'error'})`}
              </span>
            );
          })}
        </div>
      )}

      {/* Collapsible Transcription Details & Provenance */}
      <div className="border-t border-purple-100 pt-1.5">
        <button
          type="button"
          onClick={() => setIsDetailsOpen((prev) => !prev)}
          className="flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:text-purple-900 transition-colors"
        >
          {isDetailsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{isDetailsOpen ? 'Hide Transcription Details' : 'View Transcription Details & Provenance'}</span>
        </button>

        {isDetailsOpen && (
          <div className="mt-2 p-2.5 bg-white/90 border border-purple-100 rounded text-[11px] text-slate-600 space-y-1 animate-in fade-in duration-100">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <span className="text-slate-400">Assignment ID:</span>{' '}
                <span className="font-mono text-slate-700">{assignmentId || candidate.assignmentId || 'Session'}</span>
              </div>
              <div>
                <span className="text-slate-400">Student ID:</span>{' '}
                <span className="font-mono text-slate-700">{studentId}</span>
              </div>
              <div>
                <span className="text-slate-400">Provider & Model:</span>{' '}
                <span className="font-medium text-slate-700">
                  {candidate.provider} ({candidate.modelId || 'Qwen3-VL-32B'})
                </span>
              </div>
              <div>
                <span className="text-slate-400">Prompt / Rules Version:</span>{' '}
                <span className="font-mono text-slate-700">{candidate.promptVersion || 'Version unavailable'}</span>
              </div>
              <div>
                <span className="text-slate-400">Settings Version:</span>{' '}
                <span className="font-mono text-slate-700">{candidate.settingsVersion}</span>
              </div>
              <div>
                <span className="text-slate-400">Page Matching Signature:</span>{' '}
                <span className="font-mono text-slate-700 text-[10px] truncate block" title={candidate.pageSignature}>
                  {candidate.pageSignature}
                </span>
              </div>
            </div>
            {candidate.hasUnreadable && (
              <div className="text-amber-700 font-medium pt-1">
                Notice: Explicit [unreadable] markers were flagged by the transcription rules.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      {(() => {
        const isCandidateEmptyOrFailed = candidate.status === 'failed' || !candidate.transcript.trim();
        return (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-purple-100">
            <div className="text-[11px] text-purple-700 font-medium">
              {candidate.status === 'failed' && !candidate.transcript.trim()
                ? 'Transcription failed (0 words)'
                : `${wordCount} words recognized`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCopy}
                disabled={isCandidateEmptyOrFailed}
                title={
                  isCandidateEmptyOrFailed
                    ? 'Cannot copy empty or failed candidate'
                    : 'Copy candidate transcript to clipboard'
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  isCandidateEmptyOrFailed
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Candidate</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onDiscard}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Discard Candidate</span>
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={isStale || isCandidateEmptyOrFailed}
                title={
                  isStale
                    ? 'Cannot apply stale candidate'
                    : isCandidateEmptyOrFailed
                    ? 'Cannot apply empty or failed candidate'
                    : 'Apply candidate text to transcript editor'
                }
                className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded transition-colors shadow-2xs ${
                  isStale || isCandidateEmptyOrFailed
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'text-white bg-purple-600 hover:bg-purple-700'
                }`}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>Apply Candidate to Editor</span>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
