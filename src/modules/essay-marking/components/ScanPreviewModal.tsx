import React, { useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { ScanPage, StudentMatchMapItem } from '../types';
import { resolveScanPageImageUrl, getFallbackScanImageUrl } from '../utils/scanImageResolver';

interface ScanPreviewModalProps {
  page: ScanPage | null;
  matchInfo: StudentMatchMapItem | null;
  imageUrl?: string;
  onClose: () => void;
}

export const ScanPreviewModal: React.FC<ScanPreviewModalProps> = ({
  page,
  matchInfo,
  imageUrl,
  onClose,
}) => {
  const [currentSrc, setCurrentSrc] = React.useState<string>('');

  useEffect(() => {
    if (page) {
      setCurrentSrc(imageUrl || resolveScanPageImageUrl(page, matchInfo?.part));
    }
  }, [page, imageUrl, matchInfo?.part]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!page) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col p-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-blue-600" />
              <span>Scan Preview · {page.fileName} (p.{page.sourcePageNumber})</span>
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {matchInfo
                ? `Matched to No. ${String(matchInfo.classNumber).padStart(2, '0')} ${matchInfo.studentName} (Essay Page ${matchInfo.part} / ${matchInfo.total})`
                : 'Currently Unassigned'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 rounded-md p-2 flex items-center justify-center">
          <img
            src={currentSrc}
            alt={`Scan page ${page.orderIndex + 1}`}
            onError={() => {
              const fallback = getFallbackScanImageUrl(page, matchInfo?.part);
              if (fallback && currentSrc !== fallback) {
                setCurrentSrc(fallback);
              }
            }}
            className="max-h-[76vh] w-auto object-contain rounded shadow-xs"
          />
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-3 text-xs text-slate-400">
          <span>Local memory preview • Not uploaded to external services</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
