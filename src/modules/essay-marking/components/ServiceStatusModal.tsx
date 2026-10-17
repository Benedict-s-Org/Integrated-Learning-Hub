import React, { useEffect, useState } from 'react';
import { X, Server, ShieldCheck } from 'lucide-react';
import { essayServices } from '../services/essayServiceRegistry';
import { ServiceAvailabilityStatus } from '../services/essayServiceTypes';

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

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      essayServices
        .getAvailabilityService()
        .checkStatus()
        .then((res) => {
          setStatus(res);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              Model & Service Boundaries
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Security & Privacy Boundary:</strong> In this development stage, no external API calls, remote desktop model requests, or simulated successes are performed. All adapters return explicit typed unconfigured responses.
            </div>
          </div>

          {loading || !status ? (
            <div className="py-6 text-center text-sm text-slate-400">
              Checking adapter statuses...
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-md">
              <div className="p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {status.ocr.providerName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {status.ocr.details}
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Not Configured
                </span>
              </div>

              <div className="p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {status.visualVerification.providerName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {status.visualVerification.details}
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Not Configured
                </span>
              </div>

              <div className="p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {status.marking.providerName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {status.marking.details}
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Not Configured
                </span>
              </div>

              <div className="p-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {status.backgroundRunner.providerName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {status.backgroundRunner.details}
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  Not Configured
                </span>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 leading-relaxed pt-2">
            <strong>Architecture Notice:</strong> The future processing pipeline will stage requests: OCR recognition first (preserving student spelling/grammar mistakes), followed by teacher verification, and then separate requests to the Qwen3-VL-32B model for visual verification and rubric marking.
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
