import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ComponentInspectorProps {
    enabled: boolean;
}

interface InspectState {
    element: HTMLElement;
    rect: DOMRect;
    name: string;
    source?: string;
}

export const ComponentInspector = ({ enabled }: ComponentInspectorProps) => {
    const [target, setTarget] = useState<InspectState | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!enabled) {
            setTarget(null);
            return;
        }

        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });

            // Use elementFromPoint to find what's REALLY under the mouse
            const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | SVGElement;

            if (!el || (el instanceof HTMLElement && el.closest('.debug-panel-ignore'))) {
                setTarget(null);
                return;
            }

            // Find nearest tagged component
            const componentEl = el.closest('[data-component-name], [data-source-tsx]') as HTMLElement;

            if (componentEl) {
                const name = componentEl.getAttribute('data-component-name') ||
                    componentEl.getAttribute('data-source-tsx')?.split('|')[0] ||
                    componentEl.tagName.toLowerCase();

                const source = componentEl.getAttribute('data-source-file') ||
                    componentEl.getAttribute('data-source-tsx')?.split('|')[1];

                setTarget({
                    element: componentEl,
                    rect: componentEl.getBoundingClientRect(),
                    name,
                    source: source || undefined
                });
                // Debug log
                // console.log(`Inspector detected component: ${name}`, componentEl);
            } else {
                // Fallback to significant elements if no specific tag found
                // We exclude panels we want to ignore
                const significantEl = (el.closest('button, canvas, a, [id]') || (el instanceof HTMLElement && el.id ? el : null)) as HTMLElement;

                if (significantEl && !significantEl.closest('.debug-panel-ignore')) {
                    setTarget({
                        element: significantEl,
                        rect: significantEl.getBoundingClientRect(),
                        name: significantEl.tagName.toLowerCase() + (significantEl.id ? `#${significantEl.id}` : ''),
                    });
                    // console.log(`Inspector detected element: ${significantEl.tagName}`, significantEl);
                } else {
                    if (el && !(el instanceof HTMLElement && el.closest('.debug-panel-ignore'))) {
                        // console.log(`Inspector over non-component element: ${el.tagName}.${el.className}`);
                    }
                    setTarget(null);
                }
            }
        };

        window.addEventListener('mousemove', handleMouseMove, true);
        return () => window.removeEventListener('mousemove', handleMouseMove, true);
    }, [enabled]);

    if (!enabled) return null;

    return createPortal(
        <div className="fixed inset-0 pointer-events-none z-[2147483647]">
            {target && (
                <>
                    {/* Highlighting box - Bolder & Higher Z-Index */}
                    <div
                        className="absolute transition-all duration-150 border-[3px] border-fuchsia-600 bg-fuchsia-600/20 rounded-sm"
                        style={{
                            left: target.rect.left - 2,
                            top: target.rect.top - 2,
                            width: target.rect.width + 4,
                            height: target.rect.height + 4,
                            borderColor: '#d946ef',
                            backgroundColor: 'rgba(217, 70, 239, 0.15)',
                            boxShadow: '0 0 12px rgba(217, 70, 239, 0.5)',
                        }}
                    />

                    {/* Tooltip */}
                    <div
                        className="absolute bg-slate-900/95 text-white px-3 py-2 rounded-lg text-[11px] font-mono shadow-2xl backdrop-blur-md border border-white/20 z-[2147483647] pointer-events-none"
                        style={{
                            left: Math.min(window.innerWidth - 200, mousePos.x + 20),
                            top: Math.min(window.innerHeight - 100, mousePos.y + 20),
                        }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-fuchsia-500 text-white px-1 rounded text-[10px]">COMP</span>
                            <span className="font-bold text-fuchsia-300">{target.name}</span>
                        </div>
                        {target.source && (
                            <div className="text-slate-400 text-[10px] truncate max-w-[200px]">
                                {target.source}
                            </div>
                        )}
                        <div className="text-slate-500 text-[9px] mt-1 italic">
                            {target.rect.width.toFixed(0)} × {target.rect.height.toFixed(0)}
                        </div>
                    </div>
                </>
            )}
        </div>,
        document.body
    );
};
