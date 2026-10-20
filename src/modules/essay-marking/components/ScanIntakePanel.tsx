import React, { useRef, useState } from 'react';
import { Upload, FileUp, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { ScanFileRecord, ScanPage } from '../types';
import { renderPdfPagesLocally } from '../utils/pdfProcessor';

interface ScanIntakePanelProps {
  files: ScanFileRecord[];
  pages: ScanPage[];
  onAddFiles: (newFiles: ScanFileRecord[], newPages: ScanPage[]) => void;
  onRemoveFile: (fileId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

export const ScanIntakePanel: React.FC<ScanIntakePanelProps> = ({
  files,
  pages,
  onAddFiles,
  onRemoveFile,
  onPrev,
  onNext,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const processFileList = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (!rawFiles.length) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const newFiles: ScanFileRecord[] = [];
    const newPages: ScanPage[] = [];
    let currentOrder = pages.length;

    try {
      for (let i = 0; i < rawFiles.length; i++) {
        const file = rawFiles[i];
        const fileId = `file-${Date.now()}-${i}`;

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const { pages: pdfPages, totalDocPages, failedPageNumbers: _failedPageNumbers, error } = await renderPdfPagesLocally(
            file,
            fileId,
            currentOrder
          );

          if (error) {
            setErrorMessage(`PDF rendering note for ${file.name}: ${error}`);
          }

          newFiles.push({
            id: fileId,
            name: file.name,
            size: file.size,
            type: 'pdf',
            pageCount: totalDocPages > 0 ? totalDocPages : pdfPages.length,
            addedAt: Date.now() + i,
          });

          newPages.push(...pdfPages);
          currentOrder += pdfPages.length;
        } else if (file.type.startsWith('image/')) {
          const previewUrl = URL.createObjectURL(file);
          newFiles.push({
            id: fileId,
            name: file.name,
            size: file.size,
            type: 'image',
            pageCount: 1,
            addedAt: Date.now() + i,
          });

          newPages.push({
            id: `img-${fileId}`,
            fileId,
            fileName: file.name,
            sourcePageNumber: 1,
            previewUrl,
            orderIndex: currentOrder++,
            imageBlob: file,
          });
        }
      }

      onAddFiles(newFiles, newPages);
    } catch (err: unknown) {
      console.error('File intake error:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred while loading selected scan files.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFileList(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Dropzone and Import Controls */}
        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <h2 className="text-base font-semibold text-slate-800 mb-1">
              Select or Drop Scan Files
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Add student writing scans. Supports multi-page PDFs and individual image files (.jpg, .png, .webp).
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/60'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/20'
              }`}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                  <span className="text-xs font-semibold text-slate-700">
                    Extracting scan pages locally...
                  </span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-blue-600 mb-2" />
                  <div className="text-sm font-semibold text-slate-800">
                    Choose Scans or Drag Files Here
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Multiple files supported • Image previews generated locally
                  </div>
                  <button
                    type="button"
                    className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md shadow-2xs hover:bg-blue-50"
                  >
                    Browse Files
                  </button>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    processFileList(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </div>

            {errorMessage && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-500 leading-relaxed">
              <strong>Local Privacy Guard:</strong> All images and PDF page extractions are handled directly in your browser memory. No student files are uploaded to any external server during intake.
            </div>
          </section>
        </div>

        {/* Right Column: File List and Preview Overview */}
        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h2 className="text-base font-semibold text-slate-800">
                Loaded Files & Pages
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            {/* Summary Bar */}
            <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs mb-3">
              <span>
                Total Previewable Pages: <strong>{pages.length}</strong>
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">
                Deterministic Order: File added order → Page within file
              </span>
            </div>

            {/* Files List */}
            {files.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileUp className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No scan files added yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Select scan images or PDF batches on the left to begin student matching.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                {files.map((file, idx) => (
                  <div
                    key={file.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate max-w-[260px] sm:max-w-[320px]">
                          {file.name}
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {file.pageCount}{' '}
                          {file.pageCount === 1 ? 'page' : 'pages'} •{' '}
                          {(file.size / 1024).toFixed(0)} KB •{' '}
                          {file.type.toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveFile(file.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50 transition-colors"
                      title="Remove file and associated pages"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onPrev}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 min-h-[34px] transition-colors"
        >
          ← Back to Preparation
        </button>

        <button
          type="button"
          disabled={pages.length === 0}
          onClick={onNext}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md min-h-[34px] transition-colors ${
            pages.length > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>Match Students →</span>
        </button>
      </div>
    </div>
  );
};
