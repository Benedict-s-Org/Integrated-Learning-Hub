import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Server,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
  Bug,
} from 'lucide-react';
import { essayServices } from '../services/essayServiceRegistry';
import {
  ServiceAvailabilityStatus,
  ServiceStatusType,
} from '../services/essayServiceTypes';
import {
  getLatestClientErrors,
  subscribeToClientErrors,
  ClientErrorRecord,
} from '../utils/clientErrorLogger';

interface ServiceStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ServiceStatusModal: React.FC<ServiceStatusModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [status, setStatus] = useState<ServiceAvailabilityStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [clientErrors, setClientErrors] = useState<ClientErrorRecord[]>(getLatestClientErrors());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const fetchStatus = useCallback(() => {
    setLoading(true);
    essayServices
      .getAvailabilityService()
      .checkStatus()
      .then((res) => {
        setStatus(res);
        setLastChecked(new Date());
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Also fetch latest errors from bridge
    fetch('http://127.0.0.1:18089/api/client-errors')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'success' && Array.isArray(data.errors) && data.errors.length > 0) {
          setClientErrors((prev) => {
            const combined = [...data.errors.reverse(), ...prev];
            const seen = new Set();
            return combined
              .filter((e) => {
                const k = `${e.timestamp}-${e.message}`;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
              })
              .slice(0, 50);
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOpen) {
      setClientErrors(getLatestClientErrors());
      fetchStatus();
    }
    return subscribeToClientErrors(() => {
      setClientErrors(getLatestClientErrors());
    });
  }, [isOpen, fetchStatus]);

  const handleCopyError = (err: ClientErrorRecord) => {
    const formatted = `[${err.timestamp}] Step: ${err.currentStep || 'N/A'}\nMessage: ${err.message}\nURL: ${err.pageUrl}\nStack:\n${err.stack}`;
    navigator.clipboard.writeText(formatted);
    setCopiedId(err.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllErrors = () => {
    const formatted = clientErrors
      .map(
        (err) =>
          `[${err.timestamp}] Step: ${err.currentStep || 'N/A'}\nMessage: ${err.message}\nURL: ${err.pageUrl}\nStack:\n${err.stack}\n---`
      )
      .join('\n\n');
    navigator.clipboard.writeText(formatted);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  if (!isOpen) return null;

  const renderStatusBadge = (statusType: ServiceStatusType) => {
    switch (statusType) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ready / Online</span>
          </span>
        );
      case 'dry_run_ready':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>DRY_RUN Ready (Protected)</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Disconnected</span>
          </span>
        );
      case 'busy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Busy</span>
          </span>
        );
      case 'not_configured':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Not Configured
          </span>
        );
    }
  };

  const services = status
    ? [
        {
          key: 'backgroundRunner',
          title: 'Dedicated Bridge Service',
          data: status.backgroundRunner,
        },
        {
          key: 'ocr',
          title: 'Handwriting OCR Engine',
          data: status.ocr,
        },
        ...(status.transcription
          ? [
              {
                key: 'transcription',
                title: 'Vision Transcription Engine',
                data: status.transcription,
              },
            ]
          : []),
        {
          key: 'visualVerification',
          title: 'Visual Verification Model',
          data: status.visualVerification,
        },
        {
          key: 'marking',
          title: 'Rubric Marking Model',
          data: status.marking,
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              Model & Service Boundaries
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
              title="Refresh status from bridge"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Security & Privacy Boundary:</strong> Dedicated bridge operates with <code>DRY_RUN=true</code> (live Mathpix billing calls are blocked by safety gate). Local multimodal model Qwen3-VL-32B on port 18088 is connected for faithful handwriting transcription and student identity crop recognition.
            </div>
          </div>

          {loading && !status ? (
            <div className="py-6 text-center text-sm text-slate-400">
              Checking adapter statuses at http://127.0.0.1:18089...
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
              {services.map((s) => (
                <div key={s.key} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">
                      {s.data.providerName}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {s.data.details}
                    </div>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    {renderStatusBadge(s.data.status)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {lastChecked && (
            <div className="text-[11px] text-slate-400 text-right">
              Last checked: {lastChecked.toLocaleTimeString()}
            </div>
          )}

          <div className="text-xs text-slate-500 leading-relaxed pt-2">
            <strong>Architecture Notice:</strong> The processing pipeline runs serial requests: Qwen3-VL-32B on port 18088 for handwriting transcription (preserving student spelling/grammar mistakes with physical line breaks and line bounding boxes) and identity header recognition, followed by teacher verification before rubric evaluation.
          </div>

          {/* Client Error Log Section */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Bug className="w-4 h-4 text-rose-500" />
                <span>Client Error Log ({clientErrors.length})</span>
              </div>
              {clientErrors.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyAllErrors}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                >
                  {copiedAll ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAll ? 'Copied All' : 'Copy All Errors'}</span>
                </button>
              )}
            </div>

            {clientErrors.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-2 px-3 bg-slate-50 rounded border border-slate-100">
                No uncaught client errors recorded in this session.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {clientErrors.map((err) => (
                  <div
                    key={err.id}
                    className="p-2.5 bg-rose-50/60 border border-rose-200 rounded text-xs space-y-1 relative group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-rose-700 font-semibold">
                        {new Date(err.timestamp).toLocaleTimeString()} {err.currentStep ? `• [${err.currentStep}]` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyError(err)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-100 rounded transition-colors"
                        title="Copy error details"
                      >
                        {copiedId === err.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === err.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-slate-800 break-words font-medium text-[11px]">
                      {err.message}
                    </div>
                    {err.stack && (
                      <div className="text-[10px] text-slate-500 font-mono line-clamp-2 hover:line-clamp-none whitespace-pre-wrap">
                        {err.stack}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
