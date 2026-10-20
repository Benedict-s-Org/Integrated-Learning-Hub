import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  TemplateRegion,
  RegionType,
} from '../types';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  AlertTriangle,
  Loader2,
  Type,
  User,
  Hash,
  PenTool,
} from 'lucide-react';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PdfTemplateRegionEditorProps {
  file: File | null;
  previewUrl: string | null;
  regions: TemplateRegion[];
  onChangeRegions: (regions: TemplateRegion[]) => void;
  fingerprint: string;
}

const REGION_CONFIG: Record<
  RegionType,
  { label: string; strokeColor: string; bgColor: string; textColor: string; icon: React.FC<{ className?: string }> }
> = {
  class: {
    label: 'Class',
    strokeColor: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.18)',
    textColor: 'text-purple-700 bg-purple-100 border-purple-300',
    icon: Type,
  },
  student_name: {
    label: 'Student Name',
    strokeColor: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.18)',
    textColor: 'text-blue-700 bg-blue-100 border-blue-300',
    icon: User,
  },
  class_number: {
    label: 'Class Number',
    strokeColor: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.18)',
    textColor: 'text-amber-800 bg-amber-100 border-amber-300',
    icon: Hash,
  },
  writing_area: {
    label: 'Writing Area',
    strokeColor: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    textColor: 'text-emerald-800 bg-emerald-100 border-emerald-300',
    icon: PenTool,
  },
};

export const PdfTemplateRegionEditor: React.FC<PdfTemplateRegionEditorProps> = ({
  file,
  previewUrl: _previewUrl,
  regions,
  onChangeRegions,
  fingerprint,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected tool for drawing
  const [activeTool, setActiveTool] = useState<RegionType>('student_name');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // Interaction State
  const [dragMode, setDragMode] = useState<
    | null
    | { type: 'draw'; startX: number; startY: number }
    | { type: 'move'; regionId: string; startX: number; startY: number; initX: number; initY: number }
    | {
        type: 'resize';
        regionId: string;
        handle: string;
        startX: number;
        startY: number;
        initX: number;
        initY: number;
        initW: number;
        initH: number;
      }
  >(null);

  const [drawBox, setDrawBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 1. Restore saved regions from localStorage on fingerprint change
  useEffect(() => {
    if (!fingerprint) return;
    try {
      const savedKey = `essay_template_regions_${fingerprint}`;
      const saved = localStorage.getItem(savedKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onChangeRegions(parsed);
          return;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, [fingerprint]);

  // 2. Persist regions to localStorage whenever changed
  const saveRegions = useCallback(
    (newRegions: TemplateRegion[]) => {
      onChangeRegions(newRegions);
      if (fingerprint) {
        try {
          localStorage.setItem(`essay_template_regions_${fingerprint}`, JSON.stringify(newRegions));
        } catch {
          // LocalStorage full or private browsing
        }
      }
    },
    [fingerprint, onChangeRegions]
  );

  // 3. Load PDF Document via PDF.js
  useEffect(() => {
    let isCancelled = false;

    if (!file) {
      setPdfDoc(null);
      setNumPages(0);
      setErrorMessage(null);
      return;
    }

    const loadPdf = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const doc = await loadingTask.promise;

        if (isCancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error('PDF Load Error:', err);
        const msg =
          err instanceof Error
            ? err.message.includes('password')
              ? 'PDF is password protected. Please upload an unencrypted PDF.'
              : err.message
            : 'Failed to load PDF document.';
        setErrorMessage(msg);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [file]);

  // 4. Render Active Page onto Canvas
  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    let isCancelled = false;

    if (!pdfDoc || !canvasRef.current) return;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvasContext: context,
          viewport,
        } as any);

        await renderTask.promise;
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'RenderingCancelledException') {
          console.error('Page render error:', err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale]);

  // Regions on Current Page
  const currentPageRegions = regions.filter((r) => r.pageNumber === currentPage);

  // Identity field coverage checks
  const hasClass = regions.some((r) => r.type === 'class');
  const hasName = regions.some((r) => r.type === 'student_name');
  const hasNumber = regions.some((r) => r.type === 'class_number');
  const hasWriting = regions.some((r) => r.type === 'writing_area');

  // Convert client pointer event coordinates to normalized [0, 1] relative to overlay
  const getNormalizedPoint = (e: React.PointerEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  // Pointer Down on Overlay (Drawing new box or clicking empty space)
  const handleOverlayPointerDown = (e: React.PointerEvent) => {
    if (e.target !== overlayRef.current) return;
    const pt = getNormalizedPoint(e);
    setSelectedRegionId(null);
    setDragMode({
      type: 'draw',
      startX: pt.x,
      startY: pt.y,
    });
    setDrawBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragMode) return;
    const pt = getNormalizedPoint(e);

    if (dragMode.type === 'draw') {
      const left = Math.min(dragMode.startX, pt.x);
      const top = Math.min(dragMode.startY, pt.y);
      const w = Math.abs(pt.x - dragMode.startX);
      const h = Math.abs(pt.y - dragMode.startY);
      setDrawBox({ x: left, y: top, w, h });
    } else if (dragMode.type === 'move') {
      const dx = pt.x - dragMode.startX;
      const dy = pt.y - dragMode.startY;

      const target = regions.find((r) => r.id === dragMode.regionId);
      if (!target) return;

      const newX = Math.max(0, Math.min(1 - target.width, dragMode.initX + dx));
      const newY = Math.max(0, Math.min(1 - target.height, dragMode.initY + dy));

      const updated = regions.map((r) =>
        r.id === dragMode.regionId ? { ...r, x: newX, y: newY } : r
      );
      saveRegions(updated);
    } else if (dragMode.type === 'resize') {
      const dx = pt.x - dragMode.startX;
      const dy = pt.y - dragMode.startY;
      const handle = dragMode.handle;

      let newX = dragMode.initX;
      let newY = dragMode.initY;
      let newW = dragMode.initW;
      let newH = dragMode.initH;

      if (handle.includes('e')) {
        newW = Math.max(0.01, Math.min(1 - newX, dragMode.initW + dx));
      }
      if (handle.includes('s')) {
        newH = Math.max(0.01, Math.min(1 - newY, dragMode.initH + dy));
      }
      if (handle.includes('w')) {
        const potentialX = Math.max(0, Math.min(dragMode.initX + dragMode.initW - 0.01, dragMode.initX + dx));
        newW = dragMode.initX + dragMode.initW - potentialX;
        newX = potentialX;
      }
      if (handle.includes('n')) {
        const potentialY = Math.max(0, Math.min(dragMode.initY + dragMode.initH - 0.01, dragMode.initY + dy));
        newH = dragMode.initY + dragMode.initH - potentialY;
        newY = potentialY;
      }

      const updated = regions.map((r) =>
        r.id === dragMode.regionId
          ? { ...r, x: newX, y: newY, width: newW, height: newH }
          : r
      );
      saveRegions(updated);
    }
  };

  // Pointer Up
  const handlePointerUp = () => {
    if (!dragMode) return;

    if (dragMode.type === 'draw' && drawBox) {
      // Minimum dimension threshold to avoid accidental tiny clicks (0.5% of page)
      if (drawBox.w > 0.005 && drawBox.h > 0.005) {
        // If drawing identity region and one already exists, replace it or warn
        let nextRegions = [...regions];
        if (activeTool !== 'writing_area') {
          // Keep only one primary box for class, name, class_number
          nextRegions = nextRegions.filter(
            (r) => r.type !== activeTool || r.pageNumber !== currentPage
          );
        }

        const newRegion: TemplateRegion = {
          id: `region-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: activeTool,
          pageNumber: currentPage,
          x: drawBox.x,
          y: drawBox.y,
          width: drawBox.w,
          height: drawBox.h,
        };

        nextRegions.push(newRegion);
        saveRegions(nextRegions);
        setSelectedRegionId(newRegion.id);
      }
    }

    setDragMode(null);
    setDrawBox(null);
  };

  const handleDeleteSelected = () => {
    if (!selectedRegionId) return;
    saveRegions(regions.filter((r) => r.id !== selectedRegionId));
    setSelectedRegionId(null);
  };

  // Keyboard shortcut: Delete / Backspace removes selected region
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRegionId) {
        // Don't trigger if user is typing in an input
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRegionId, regions, saveRegions]);

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white border-b border-slate-200 text-xs">
        {/* Page Navigation & Zoom */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={!pdfDoc || currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-semibold text-slate-700 px-1 min-w-[75px] text-center">
            {numPages > 0 ? `Page ${currentPage} / ${numPages}` : 'No pages'}
          </span>
          <button
            type="button"
            disabled={!pdfDoc || currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Zoom Controls */}
          <button
            type="button"
            disabled={!pdfDoc || scale <= 0.6}
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-medium text-slate-600 px-1">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            disabled={!pdfDoc || scale >= 2.5}
            onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
            className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!pdfDoc}
            onClick={() => setScale(1.2)}
            className="p-1.5 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            title="Fit to Default"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Region Drawing Tool Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['class', 'student_name', 'class_number', 'writing_area'] as RegionType[]).map((toolType) => {
            const cfg = REGION_CONFIG[toolType];
            const Icon = cfg.icon;
            const isSelected = activeTool === toolType;
            return (
              <button
                key={toolType}
                type="button"
                onClick={() => setActiveTool(toolType)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                  isSelected
                    ? `${cfg.textColor} shadow-2xs ring-2 ring-blue-400 ring-offset-1`
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cfg.label}</span>
              </button>
            );
          })}

          {selectedRegionId && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100"
              title="Delete Selected Region"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Identity Region Status Summary Banner */}
      <div className="px-3 py-1.5 bg-slate-100/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Identity Regions:</span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium border ${
              hasClass ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            Class {hasClass ? '✓' : '(Missing)'}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium border ${
              hasName ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            Student Name {hasName ? '✓' : '(Missing)'}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium border ${
              hasNumber ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            Class Number {hasNumber ? '✓' : '(Missing)'}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium border ${
              hasWriting ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            Writing Area {hasWriting ? '✓' : '(Optional)'}
          </span>
        </div>

        {(!hasClass || !hasName || !hasNumber) && (
          <span className="text-amber-700 flex items-center gap-1 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Draw Class, Name, and Number boxes for AI student matching.</span>
          </span>
        )}
      </div>

      {/* Main PDF Canvas & Region Overlay Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-200/60 relative min-h-[460px]"
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-slate-500">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
            <span className="text-sm font-semibold">Rendering PDF page faithfully...</span>
          </div>
        ) : errorMessage ? (
          <div className="max-w-md p-6 bg-white border border-rose-200 rounded-lg text-center shadow-xs">
            <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-2" />
            <div className="font-semibold text-slate-800 text-sm">Unable to render PDF</div>
            <div className="text-xs text-rose-700 mt-1">{errorMessage}</div>
          </div>
        ) : !file ? (
          <div className="text-center py-16 text-slate-400">
            <PenTool className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No worksheet PDF uploaded</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload the original assignment PDF on the left to preview and mark regions.
            </p>
          </div>
        ) : (
          <div
            className="relative shadow-md rounded border border-slate-300 bg-white inline-block select-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Real PDF Canvas */}
            <canvas ref={canvasRef} className="block" />

            {/* Interactive Drawing & Selection Overlay */}
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair"
              onPointerDown={handleOverlayPointerDown}
            >
              {/* Existing Regions on this Page */}
              {currentPageRegions.map((region) => {
                const cfg = REGION_CONFIG[region.type];
                const isSelected = selectedRegionId === region.id;

                const leftPct = `${region.x * 100}%`;
                const topPct = `${region.y * 100}%`;
                const widthPct = `${region.width * 100}%`;
                const heightPct = `${region.height * 100}%`;

                return (
                  <div
                    key={region.id}
                    style={{
                      position: 'absolute',
                      left: leftPct,
                      top: topPct,
                      width: widthPct,
                      height: heightPct,
                      backgroundColor: cfg.bgColor,
                      borderColor: cfg.strokeColor,
                      borderWidth: isSelected ? '2px' : '1.5px',
                    }}
                    className={`rounded-xs cursor-move group transition-shadow ${
                      isSelected ? 'ring-2 ring-blue-500 shadow-md' : 'hover:border-blue-400'
                    }`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const pt = getNormalizedPoint(e);
                      setSelectedRegionId(region.id);
                      setDragMode({
                        type: 'move',
                        regionId: region.id,
                        startX: pt.x,
                        startY: pt.y,
                        initX: region.x,
                        initY: region.y,
                      });
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                  >
                    {/* Region Label Badge */}
                    <div
                      className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs whitespace-nowrap flex items-center gap-1"
                      style={{ backgroundColor: cfg.strokeColor }}
                    >
                      <span>{cfg.label}</span>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            saveRegions(regions.filter((r) => r.id !== region.id));
                          }}
                          className="hover:text-rose-200 ml-0.5"
                          title="Remove"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Resize Handles for Selected Box */}
                    {isSelected && (
                      <>
                        {['nw', 'ne', 'se', 'sw'].map((handle) => {
                          const posClasses: Record<string, string> = {
                            nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
                            ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
                            se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
                            sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                          };
                          return (
                            <div
                              key={handle}
                              className={`absolute w-2.5 h-2.5 bg-white border-2 rounded-xs ${posClasses[handle]}`}
                              style={{ borderColor: cfg.strokeColor }}
                              onPointerDown={(ev) => {
                                ev.stopPropagation();
                                const pt = getNormalizedPoint(ev);
                                setDragMode({
                                  type: 'resize',
                                  regionId: region.id,
                                  handle,
                                  startX: pt.x,
                                  startY: pt.y,
                                  initX: region.x,
                                  initY: region.y,
                                  initW: region.width,
                                  initH: region.height,
                                });
                                (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                              }}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Box currently being drawn */}
              {drawBox && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${drawBox.x * 100}%`,
                    top: `${drawBox.y * 100}%`,
                    width: `${drawBox.w * 100}%`,
                    height: `${drawBox.h * 100}%`,
                    backgroundColor: REGION_CONFIG[activeTool].bgColor,
                    borderColor: REGION_CONFIG[activeTool].strokeColor,
                    borderWidth: '2px',
                    borderStyle: 'dashed',
                  }}
                  className="rounded-xs pointer-events-none"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="px-3 py-2 bg-white border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
        <span>
          Click tool above, then click & drag on the PDF to draw boxes. Click box to move, resize or delete.
        </span>
        <span className="font-semibold text-slate-700">
          {currentPageRegions.length} region(s) on Page {currentPage}
        </span>
      </div>
    </div>
  );
};
