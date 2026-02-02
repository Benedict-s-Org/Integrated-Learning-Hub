import { useEffect } from 'react';

interface RouteOverlayProps {
    enabled: boolean;
}

export const RouteOverlay = ({ enabled }: RouteOverlayProps) => {
    useEffect(() => {
        // Cleanup function to remove all overlays
        const cleanup = () => {
            document.querySelectorAll('.debug-route-label').forEach(el => el.remove());
            document.querySelectorAll('[data-debugged]').forEach(el => {
                el.removeAttribute('data-debugged');
                // Reset styles if needed, though we try to be non-intrusive
            });
        };

        if (!enabled) {
            cleanup();
            return;
        }

        const updateLabels = () => {
            // Find all interactive elements
            const elements = document.querySelectorAll('a, button');

            elements.forEach((el) => {
                // Skip if already processed or if it's part of the debug panel itself
                if (el.getAttribute('data-debugged') || el.closest('.debug-panel-ignore')) return;

                let labelText = '';
                let colorClass = '';

                if (el.tagName === 'A') {
                    const href = el.getAttribute('href');
                    if (href) {
                        labelText = `🔗 ${href}`;
                        colorClass = 'bg-blue-500';
                    }
                } else if (el.tagName === 'BUTTON') {
                    // Try to guess intent from text or aria
                    const text = el.textContent?.slice(0, 15) || '';
                    labelText = `🖱️ Btn`;
                    colorClass = 'bg-amber-500';

                    // Heuristic: Check if likely a navigation button
                    if (text.includes('Back') || text.includes('Go') || text.includes('View')) {
                        colorClass = 'bg-purple-500';
                    }
                }

                if (labelText) {
                    const badge = document.createElement('div');
                    badge.className = `debug-route-label absolute -top-3 left-0 z-50 px-1.5 py-0.5 text-[10px] font-mono text-white rounded shadow-md pointer-events-none whitespace-nowrap opacity-90 ${colorClass}`;
                    badge.style.zIndex = '99999';
                    badge.innerText = labelText;

                    // Ensure parent is relative so absolute positioning works
                    const htmlEl = el as HTMLElement;
                    const style = window.getComputedStyle(htmlEl);
                    if (style.position === 'static') {
                        htmlEl.style.position = 'relative';
                    }

                    htmlEl.appendChild(badge);
                    htmlEl.setAttribute('data-debugged', 'true');

                    // Add border highlighting
                    htmlEl.style.outline = '2px dashed rgba(255, 0, 255, 0.3)';
                }
            });
        };

        // Initial run
        updateLabels();

        // Watch for DOM changes (popups, navigation, etc.)
        const observer = new MutationObserver((mutations) => {
            // Debounce or just run
            updateLabels();
        });

        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            cleanup();
            // Remove outlines
            document.querySelectorAll('a, button').forEach((el) => {
                (el as HTMLElement).style.outline = '';
            });
        };
    }, [enabled]);

    return null;
};
