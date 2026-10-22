import React, { useState, useRef } from 'react';
import { ScanPage, TemplateRegion } from '../types';
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  MoveUp,
  MoveDown,
  PenTool,
  MousePointer,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { normalizeRegionReadingOrder } from '../utils/continuationPageLogic';

interface CustomOcrRegionEditorModalProps {
  page: ScanPage;
  studentName?: string;
  classNumber?: number;
  part: number;
  onSaveRegions: (pageId: string, customRegions: TemplateRegion[]) => void;
  onClose: () => void;
}

export const CustomOcrRegionEditorModal: React.FC<CustomOcrRegionEditorModalProps> = ({
  page,
  studentName,
  classNumber,
  part,
  onSaveRegions,
  onClose,
}) => {
  // Initialize with previously saved customRegions or empty array
  const initialRegions: TemplateRegion[] = Array.isArray(page.customRegions)
    ? normalizeRegionReadingOrder(
        page.customRegions.filter((r) => r && (r.type === 'writing_area' || !r.type))
      )
    : [];

  const [regions, setRegions] = useState<TemplateRegion[]>(initialRegions);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'draw' | 'select'>('draw');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Drag / Draw / Resize state
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

  const overlayRef = useRef<HTMLDivElement>(null);

  const getNormalizedPoint = (e: React.PointerEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDownOverlay = (e: React.PointerEvent) => {
    if (activeTool !== 'draw') {
      setSelectedRegionId(null);
      return;
    }
    const pt = getNormalizedPoint(e);
    setDragMode({
      type: 'draw',
      startX: pt.x,
      startY: pt.y,
    });
    setDrawBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
    setSelectedRegionId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragMode) return;
    const pt = getNormalizedPoint(e);

    if (dragMode.type === 'draw') {
      const left = Math.min(dragMode.startX, pt.x);
      const top = Math.min(dragMode.startY, pt.y);
      const width = Math.abs(pt.x - dragMode.startX);
      const height = Math.abs(pt.y - dragMode.startY);
      setDrawBox({ x: left, y: top, w: width, h: height });
    } else if (dragMode.type === 'move') {
      const dx = pt.x - dragMode.startX;
      const dy = pt.y - dragMode.startY;
      const target = regions.find((r) => r.id === dragMode.regionId);
      if (!target) return;

      const newX = Math.max(0, Math.min(1 - target.width, dragMode.initX + dx));
      const newY = Math.max(0, Math.min(1 - target.height, dragMode.initY + dy));

      setRegions((prev) =>
        prev.map((r) => (r.id === dragMode.regionId ? { ...r, x: newX, y: newY } : r))
      );
    } else if (dragMode.type === 'resize') {
      const dx = pt.x - dragMode.startX;
      const dy = pt.y - dragMode.startY;
      const handle = dragMode.handle;

      let newX = dragMode.initX;
      let newY = dragMode.initY;
      let newW = dragMode.initW;
      let newH = dragMode.initH;

      if (handle.includes('e')) {
        newW = Math.max(0.02, Math.min(1 - newX, dragMode.initW + dx));
      }
      if (handle.includes('s')) {
        newH = Math.max(0.02, Math.min(1 - newY, dragMode.initH + dy));
      }
      if (handle.includes('w')) {
        const potentialX = Math.max(0, Math.min(dragMode.initX + dragMode.initW - 0.02, dragMode.initX + dx));
        newW = dragMode.initX + dragMode.initW - potentialX;
        newX = potentialX;
      }
      if (handle.includes('n')) {
        const potentialY = Math.max(0, Math.min(dragMode.initY + dragMode.initH - 0.02, dragMode.initY + dy));
        newH = dragMode.initY + dragMode.initH - potentialY;
        newY = potentialY;
      }

      setRegions((prev) =>
        prev.map((r) =>
          r.id === dragMode.regionId ? { ...r, x: newX, y: newY, width: newW, height: newH } : r
        )
      );
    }
  };

  const handlePointerUp = () => {
    if (dragMode?.type === 'draw' && drawBox) {
      if (drawBox.w >= 0.03 && drawBox.h >= 0.03) {
        const nextOrder = regions.length + 1;
        const newRegion: TemplateRegion = {
          id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'writing_area',
          pageNumber: part,
          x: Math.round(drawBox.x * 1e4) / 1e4,
          y: Math.round(drawBox.y * 1e4) / 1e4,
          width: Math.round(drawBox.w * 1e4) / 1e4,
          height: Math.round(drawBox.h * 1e4) / 1e4,
          name: `Region #${nextOrder}`,
          orderIndex: nextOrder,
        };
        const updated = normalizeRegionReadingOrder([...regions, newRegion]);
        setRegions(updated);
        setSelectedRegionId(newRegion.id);
      }
    }

    setDragMode(null);
    setDrawBox(null);
  };

  const handleDeleteRegion = (id: string) => {
    const updated = normalizeRegionReadingOrder(regions.filter((r) => r.id !== id));
    setRegions(updated);
    if (selectedRegionId === id) setSelectedRegionId(null);
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= regions.length) return;

    const copy = [...regions];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    const updated = normalizeRegionReadingOrder(copy);
    setRegions(updated);
  };

  const handleClearAll = () => {
    setRegions([]);
    setSelectedRegionId(null);
  };

  const handleSave = () => {
    const normalized = normalizeRegionReadingOrder(regions);
    onSaveRegions(page.id, normalized);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[94vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">
                Set OCR Regions — Page {part} (Continuation)
              </span>
              {studentName && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {classNumber ? `#${classNumber} ` : ''}{studentName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Draw rectangular boxes around handwritten essay text. Downstream OCR will process only these regions in the configured reading order.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            title="Cancel and close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Drawing and Selection Tools */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600 mr-1">Tool:</span>
            <button
              type="button"
              onClick={() => setActiveTool('draw')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeTool === 'draw'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Draw Region</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('select')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeTool === 'select'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Select / Move</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}
              disabled={zoomLevel <= 0.6}
              className="p-1.5 rounded hover:bg-white disabled:opacity-30 text-slate-700 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-bold text-slate-700 min-w-[42px] text-center select-none text-[11px]">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.5, +(z + 0.2).toFixed(2)))}
              disabled={zoomLevel >= 2.5}
              className="p-1.5 rounded hover:bg-white disabled:opacity-30 text-slate-700 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-300 mx-0.5" />
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-white text-slate-700 font-medium text-[11px] transition-colors"
              title="Fit to view"
            >
              <Maximize2 className="w-3 h-3 text-slate-500" />
              <span>Fit</span>
            </button>
          </div>

          {/* Clear All */}
          {regions.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors text-[11px]"
              title="Remove all regions"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Workspace Body: Canvas on Left, Reading Order on Right */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px] divide-x divide-slate-200 min-h-[460px]">
          {/* Left Canvas Viewport */}
          <div
            className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 select-none relative"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.1s ease-out',
              }}
              className="relative shadow-md border border-slate-300 rounded bg-white inline-block"
            >
              <img
                src={page.previewUrl}
                alt="Continuation Page Preview"
                className="max-h-[64vh] w-auto object-contain block pointer-events-none"
              />

              {/* Overlay for drawing & regions */}
              <div
                ref={overlayRef}
                onPointerDown={handlePointerDownOverlay}
                className={`absolute inset-0 ${
                  activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
                }`}
              >
                {/* Active drawing box */}
                {drawBox && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${drawBox.x * 100}%`,
                      top: `${drawBox.y * 100}%`,
                      width: `${drawBox.w * 100}%`,
                      height: `${drawBox.h * 100}%`,
                    }}
                    className="border-2 border-emerald-500 bg-emerald-500/20 border-dashed rounded-xs pointer-events-none"
                  />
                )}

                {/* Rendered Custom Regions */}
                {regions.map((region, idx) => {
                  const isSelected = selectedRegionId === region.id;
                  const orderNum = region.orderIndex ?? idx + 1;

                  return (
                    <div
                      key={region.id}
                      style={{
                        position: 'absolute',
                        left: `${region.x * 100}%`,
                        top: `${region.y * 100}%`,
                        width: `${region.width * 100}%`,
                        height: `${region.height * 100}%`,
                      }}
                      className={`border-2 rounded-xs transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-500/25 ring-2 ring-emerald-500 shadow-md z-20'
                          : 'border-emerald-500 bg-emerald-500/15 hover:bg-emerald-500/20 z-10'
                      } ${activeTool === 'select' ? 'cursor-move' : ''}`}
                      onPointerDown={(e) => {
                        if (activeTool !== 'select') return;
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRegionId(region.id);
                      }}
                    >
                      {/* Numbered Reading Order Badge */}
                      <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-black text-white bg-emerald-600 shadow-2xs whitespace-nowrap flex items-center gap-1">
                        <span>#{orderNum}</span>
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              handleDeleteRegion(region.id);
                            }}
                            className="hover:text-rose-200 ml-1"
                            title="Delete this region"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Resize handles when selected */}
                      {isSelected && activeTool === 'select' && (
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
                                className={`absolute w-2.5 h-2.5 bg-white border-2 border-emerald-600 rounded-xs ${posClasses[handle]}`}
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
              </div>
            </div>
          </div>

          {/* Right Sidebar: Reading Order List */}
          <div className="p-3 bg-white flex flex-col justify-between overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-xs text-slate-800">
                  Reading Order ({regions.length})
                </span>
                <span className="text-[11px] text-slate-400">1st → Last</span>
              </div>

              {regions.length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  <AlertCircle className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                  <p className="text-xs font-semibold text-slate-700">No regions defined</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Click & drag on the page preview to define handwritten writing areas.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                  {regions.map((region, idx) => {
                    const isSelected = selectedRegionId === region.id;
                    const orderNum = region.orderIndex ?? idx + 1;

                    return (
                      <div
                        key={region.id}
                        onClick={() => setSelectedRegionId(region.id)}
                        className={`p-2 rounded-md border text-xs flex items-center justify-between gap-1.5 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400 text-emerald-900 font-semibold'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                            {orderNum}
                          </span>
                          <span className="truncate text-xs">
                            Region #{orderNum}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveOrder(idx, 'up')}
                            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-20"
                            title="Move reading order earlier"
                          >
                            <MoveUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === regions.length - 1}
                            onClick={() => handleMoveOrder(idx, 'down')}
                            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-20"
                            title="Move reading order later"
                          >
                            <MoveDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRegion(region.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-white"
                            title="Delete this region"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-snug">
              ℹ️ During OCR, each region will be cropped and processed in numbered order. Text will be joined with line breaks.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white">
          <div className="text-xs">
            {regions.length === 0 ? (
              <span className="text-amber-700 font-medium">
                ⚠️ At least 1 region required for non-blank continuation page.
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">
                ✓ {regions.length} region(s) ready to save.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={regions.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Save Regions</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
