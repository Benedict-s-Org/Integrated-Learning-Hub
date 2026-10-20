import React, { useState, useRef } from 'react';
import { ScanPage, TemplateRegion, RegionType } from '../types';
import { X, Check, RotateCcw } from 'lucide-react';

interface AdjustScanRegionsModalProps {
  page: ScanPage;
  templateRegions: TemplateRegion[];
  onSaveRegions: (pageId: string, customRegions: TemplateRegion[]) => void;
  onClose: () => void;
}

const REGION_COLORS: Record<RegionType, { stroke: string; bg: string; label: string }> = {
  class: { stroke: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.25)', label: 'Class' },
  student_name: { stroke: '#3b82f6', bg: 'rgba(59, 130, 246, 0.25)', label: 'Student Name' },
  class_number: { stroke: '#f59e0b', bg: 'rgba(245, 158, 11, 0.25)', label: 'Class Number' },
  writing_area: { stroke: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Writing Area' },
};

export const AdjustScanRegionsModal: React.FC<AdjustScanRegionsModalProps> = ({
  page,
  templateRegions,
  onSaveRegions,
  onClose,
}) => {
  // Use page's customRegions if previously adjusted, otherwise fallback to templateRegions
  const initialRegions = (page.customRegions && page.customRegions.length > 0)
    ? page.customRegions
    : templateRegions.filter((r) => r.type !== 'writing_area');

  const [regions, setRegions] = useState<TemplateRegion[]>(initialRegions);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [dragMode, setDragMode] = useState<
    | null
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

  const overlayRef = useRef<HTMLDivElement>(null);

  const getNormalizedPoint = (e: React.PointerEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragMode) return;
    const pt = getNormalizedPoint(e);

    if (dragMode.type === 'move') {
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

      setRegions((prev) =>
        prev.map((r) =>
          r.id === dragMode.regionId ? { ...r, x: newX, y: newY, width: newW, height: newH } : r
        )
      );
    }
  };

  const handlePointerUp = () => {
    setDragMode(null);
  };

  const handleResetToTemplate = () => {
    setRegions(templateRegions.filter((r) => r.type !== 'writing_area'));
  };

  const handleSave = () => {
    onSaveRegions(page.id, regions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Adjust Scan Identity Regions · {page.fileName} (Page {page.sourcePageNumber})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag or resize the identity boxes to align with this scan&apos;s physical margins.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport */}
        <div
          className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 min-h-[440px]"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="relative shadow-lg border border-slate-300 rounded bg-white inline-block select-none">
            <img
              src={page.previewUrl}
              alt="Scan preview"
              className="max-h-[65vh] w-auto object-contain block pointer-events-none"
            />

            {/* Overlay */}
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair"
              onClick={() => setSelectedId(null)}
            >
              {regions.map((region) => {
                const color = REGION_COLORS[region.type] || REGION_COLORS.student_name;
                const isSelected = selectedId === region.id;

                return (
                  <div
                    key={region.id}
                    style={{
                      position: 'absolute',
                      left: `${region.x * 100}%`,
                      top: `${region.y * 100}%`,
                      width: `${region.width * 100}%`,
                      height: `${region.height * 100}%`,
                      backgroundColor: color.bg,
                      borderColor: color.stroke,
                      borderWidth: isSelected ? '2px' : '1.5px',
                    }}
                    className={`rounded-xs cursor-move ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const pt = getNormalizedPoint(e);
                      setSelectedId(region.id);
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
                    <div
                      className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs whitespace-nowrap"
                      style={{ backgroundColor: color.stroke }}
                    >
                      {color.label}
                    </div>

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
                              style={{ borderColor: color.stroke }}
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

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={handleResetToTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset to Template Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs"
            >
              <Check className="w-4 h-4" />
              <span>Save & Apply for this Page</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
