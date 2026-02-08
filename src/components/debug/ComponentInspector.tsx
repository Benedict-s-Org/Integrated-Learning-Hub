import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileCode, Layers } from 'lucide-react';

interface ComponentInspectorProps {
    enabled: boolean;
}

interface InspectState {
    element: HTMLElement;
    rect: DOMRect;
    name: string;
    source?: string;
    componentStack: string[];
    elementType: 'component' | 'element' | 'interactive';
}

// React Fiber key used to access internal fiber node
const REACT_FIBER_KEY = '__reactFiber$';
const REACT_INTERNAL_INSTANCE_KEY = '__reactInternalInstance$';

/**
 * Attempts to get the React fiber node from a DOM element
 */
function getReactFiber(element: HTMLElement | SVGElement): any {
    // React 18+ uses __reactFiber$xxx keys
    const keys = Object.keys(element);
    const fiberKey = keys.find(key => key.startsWith(REACT_FIBER_KEY) || key.startsWith(REACT_INTERNAL_INSTANCE_KEY));

    if (fiberKey) {
        return (element as any)[fiberKey];
    }
    return null;
}

/**
 * Traverses the fiber tree upward to collect component names
 */
function getComponentStack(fiber: any, maxDepth = 10): string[] {
    const stack: string[] = [];
    let current = fiber;
    let depth = 0;

    while (current && depth < maxDepth) {
        // Function components have a type that is a function
        // Class components have a type.prototype.isReactComponent
        const type = current.type;

        if (type) {
            let name: string | null = null;

            if (typeof type === 'function') {
                name = type.displayName || type.name || null;
            } else if (typeof type === 'string') {
                // HTML element - skip these in the stack
            } else if (type.$$typeof) {
                // React special types (memo, forwardRef, etc.)
                if (type.displayName) {
                    name = type.displayName;
                } else if (type.render?.displayName || type.render?.name) {
                    name = type.render.displayName || type.render.name;
                }
            }

            // Filter out common React internals and HOCs
            if (name && !name.startsWith('_') &&
                !['Fragment', 'Suspense', 'StrictMode', 'Provider', 'Consumer'].includes(name)) {
                stack.push(name);
            }
        }

        current = current.return;
        depth++;
    }

    return stack;
}

/**
 * Infers the likely source file path from a component name
 */
function inferSourcePath(componentName: string): string | undefined {
    // Common patterns in this codebase:
    // ComponentName -> src/components/ComponentName/ComponentName.tsx
    // SomeComponent -> src/components/SomeComponent.tsx
    // PageName -> src/pages/PageName.tsx

    const basePaths = [
        `src/components/${componentName}/${componentName}.tsx`,
        `src/components/${componentName}.tsx`,
        `src/pages/${componentName}.tsx`,
        `src/components/ui/${componentName}.tsx`,
        `src/components/admin/${componentName}.tsx`,
        `src/components/common/${componentName}.tsx`,
    ];

    // For now, return the most likely path
    // In a real implementation, you could check if the file exists
    if (componentName.endsWith('Page')) {
        return `src/pages/${componentName}.tsx`;
    }

    return `src/components/${componentName}/${componentName}.tsx`;
}

/**
 * Gets meaningful info about an interactive element
 */
function getInteractiveElementInfo(element: HTMLElement): { label: string; type: string } {
    const tag = element.tagName.toLowerCase();

    // Button
    if (tag === 'button' || element.getAttribute('role') === 'button') {
        const text = element.textContent?.trim().slice(0, 30) || '';
        const ariaLabel = element.getAttribute('aria-label');
        return {
            type: 'Button',
            label: ariaLabel || text || element.className.split(' ')[0] || 'button'
        };
    }

    // Input
    if (tag === 'input') {
        const inputType = (element as HTMLInputElement).type;
        const placeholder = (element as HTMLInputElement).placeholder;
        const name = (element as HTMLInputElement).name;
        return {
            type: `Input[${inputType}]`,
            label: name || placeholder || element.id || 'input'
        };
    }

    // Link
    if (tag === 'a') {
        const text = element.textContent?.trim().slice(0, 30) || '';
        return {
            type: 'Link',
            label: text || (element as HTMLAnchorElement).href || 'link'
        };
    }

    // Select
    if (tag === 'select') {
        return {
            type: 'Select',
            label: (element as HTMLSelectElement).name || element.id || 'select'
        };
    }

    // SVG/Icon
    if (tag === 'svg' || element.closest('svg')) {
        return {
            type: 'Icon/SVG',
            label: element.getAttribute('aria-label') || 'icon'
        };
    }

    return {
        type: tag,
        label: element.id || element.className.split(' ')[0] || tag
    };
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

            // Use elementFromPoint to find what's under the mouse
            const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | SVGElement;

            if (!el || (el instanceof HTMLElement && el.closest('.debug-panel-ignore'))) {
                setTarget(null);
                return;
            }

            // First, check for explicit data-source-tsx attribute
            const taggedEl = el.closest('[data-component-name], [data-source-tsx]') as HTMLElement;

            if (taggedEl) {
                const name = taggedEl.getAttribute('data-component-name') ||
                    taggedEl.getAttribute('data-source-tsx')?.split('|')[0] ||
                    taggedEl.tagName.toLowerCase();

                const source = taggedEl.getAttribute('data-source-file') ||
                    taggedEl.getAttribute('data-source-tsx')?.split('|')[1];

                setTarget({
                    element: taggedEl,
                    rect: taggedEl.getBoundingClientRect(),
                    name,
                    source: source || undefined,
                    componentStack: [name],
                    elementType: 'component'
                });
                return;
            }

            // Try to get React fiber info
            const fiber = getReactFiber(el as HTMLElement);

            if (fiber) {
                const componentStack = getComponentStack(fiber);

                if (componentStack.length > 0) {
                    const topComponent = componentStack[0];
                    const inferredPath = inferSourcePath(topComponent, componentStack);

                    // Find the closest element that represents this component
                    let componentEl = el as HTMLElement;

                    setTarget({
                        element: componentEl,
                        rect: componentEl.getBoundingClientRect(),
                        name: topComponent,
                        source: inferredPath,
                        componentStack,
                        elementType: 'component'
                    });
                    return;
                }
            }

            // Fallback: check for interactive elements
            const interactiveEl = el.closest('button, a, input, select, textarea, [role="button"], [onclick]') as HTMLElement;

            if (interactiveEl && !interactiveEl.closest('.debug-panel-ignore')) {
                const info = getInteractiveElementInfo(interactiveEl);

                // Try to get fiber for the interactive element
                const interactiveFiber = getReactFiber(interactiveEl);
                const stack = interactiveFiber ? getComponentStack(interactiveFiber) : [];

                setTarget({
                    element: interactiveEl,
                    rect: interactiveEl.getBoundingClientRect(),
                    name: `${info.type}: ${info.label}`,
                    source: stack.length > 0 ? inferSourcePath(stack[0]) : undefined,
                    componentStack: stack,
                    elementType: 'interactive'
                });
                return;
            }

            // Last resort: any element with ID or meaningful class
            const meaningfulEl = el.closest('[id], .bg-white, .rounded, .border, .shadow') as HTMLElement;

            if (meaningfulEl && meaningfulEl !== document.body && !meaningfulEl.closest('.debug-panel-ignore')) {
                const fiber = getReactFiber(meaningfulEl);
                const stack = fiber ? getComponentStack(fiber) : [];

                setTarget({
                    element: meaningfulEl,
                    rect: meaningfulEl.getBoundingClientRect(),
                    name: meaningfulEl.id
                        ? `#${meaningfulEl.id}`
                        : meaningfulEl.tagName.toLowerCase() + (meaningfulEl.className ? '.' + meaningfulEl.className.split(' ')[0] : ''),
                    source: stack.length > 0 ? inferSourcePath(stack[0], stack) : undefined,
                    componentStack: stack,
                    elementType: 'element'
                });
                return;
            }

            setTarget(null);
        };

        window.addEventListener('mousemove', handleMouseMove, true);
        return () => window.removeEventListener('mousemove', handleMouseMove, true);
    }, [enabled]);

    if (!enabled) return null;

    const getTypeColor = (type: InspectState['elementType']) => {
        switch (type) {
            case 'component': return { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', badge: 'bg-emerald-500' };
            case 'interactive': return { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', badge: 'bg-amber-500' };
            case 'element': return { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', badge: 'bg-indigo-500' };
        }
    };

    return createPortal(
        <div className="fixed inset-0 pointer-events-none z-[2147483647] debug-panel-ignore">
            {target && (() => {
                const colors = getTypeColor(target.elementType);
                return (
                    <>
                        {/* Highlighting box */}
                        <div
                            className="absolute transition-all duration-100 border-2 rounded-sm"
                            style={{
                                left: target.rect.left - 2,
                                top: target.rect.top - 2,
                                width: target.rect.width + 4,
                                height: target.rect.height + 4,
                                borderColor: colors.border,
                                backgroundColor: colors.bg,
                                boxShadow: `0 0 12px ${colors.bg}`,
                            }}
                        />

                        {/* Tooltip */}
                        <div
                            className="absolute bg-slate-900/95 text-white px-3 py-2.5 rounded-lg text-[11px] font-sans shadow-2xl backdrop-blur-md border border-white/10 z-[2147483647] pointer-events-none max-w-[320px]"
                            style={{
                                left: Math.min(window.innerWidth - 340, mousePos.x + 16),
                                top: Math.min(window.innerHeight - 160, mousePos.y + 16),
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`${colors.badge} text-white px-1.5 py-0.5 rounded text-[9px] font-bold uppercase`}>
                                    {target.elementType === 'component' ? 'COMP' : target.elementType === 'interactive' ? 'UI' : 'EL'}
                                </span>
                                <span className="font-bold text-white truncate">{target.name}</span>
                            </div>

                            {/* Source Path */}
                            {target.source && (
                                <div className="flex items-start gap-2 text-[10px] mb-2 bg-slate-800/50 px-2 py-1.5 rounded">
                                    <FileCode size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <span className="text-emerald-300 break-all font-mono">{target.source}</span>
                                </div>
                            )}

                            {/* Component Stack */}
                            {target.componentStack.length > 1 && (
                                <div className="flex items-start gap-2 text-[10px] mb-2">
                                    <Layers size={12} className="text-blue-400 shrink-0 mt-0.5" />
                                    <div className="text-slate-400">
                                        {target.componentStack.slice(0, 5).map((comp, i) => (
                                            <span key={i}>
                                                {i > 0 && <span className="text-slate-600 mx-1">→</span>}
                                                <span className={i === 0 ? 'text-blue-300' : 'text-slate-500'}>{comp}</span>
                                            </span>
                                        ))}
                                        {target.componentStack.length > 5 && (
                                            <span className="text-slate-600"> +{target.componentStack.length - 5}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Dimensions */}
                            <div className="flex items-center gap-4 text-[9px] text-slate-500 pt-1 border-t border-slate-700/50">
                                <span>{target.rect.width.toFixed(0)} × {target.rect.height.toFixed(0)}px</span>
                                {!target.source && (
                                    <span className="text-amber-500/70 italic">No source info</span>
                                )}
                            </div>
                        </div>
                    </>
                );
            })()}
        </div>,
        document.body
    );
};
