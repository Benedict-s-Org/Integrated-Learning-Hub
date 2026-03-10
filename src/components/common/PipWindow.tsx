import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface PipWindowProps {
    pipWindow: Window;
    title?: string;
    children: React.ReactNode;
}

export const PipWindow: React.FC<PipWindowProps> = ({ pipWindow, title = 'Desktop Name Bar', children }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Set the PiP window title
    useEffect(() => {
        if (pipWindow) {
            pipWindow.document.title = title;
        }
    }, [pipWindow, title]);

    // Create or refresh the container element in the PiP window
    useEffect(() => {
        if (!pipWindow) return;

        // Clean up previous container if it exists and belongs to a different document
        if (containerRef.current && containerRef.current.ownerDocument !== pipWindow.document) {
            containerRef.current = null;
        }

        if (!containerRef.current) {
            const container = pipWindow.document.createElement('div');
            container.className = "h-screen w-full bg-white overflow-hidden";
            pipWindow.document.body.appendChild(container);
            containerRef.current = container;

            // Ensure body has no margin/padding
            pipWindow.document.body.style.margin = '0';
            pipWindow.document.body.style.padding = '0';
            pipWindow.document.body.style.height = '100vh';
            pipWindow.document.body.style.width = '100vw';

            // Additional style copy reinforcement (in addition to useDocumentPiP)
            [...document.styleSheets].forEach((styleSheet) => {
                try {
                    if (styleSheet.href) {
                        const link = pipWindow.document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = styleSheet.href;
                        pipWindow.document.head.appendChild(link);
                    } else {
                        const style = pipWindow.document.createElement('style');
                        style.textContent = [...styleSheet.cssRules].map(r => r.cssText).join('');
                        pipWindow.document.head.appendChild(style);
                    }
                } catch (e) {
                    console.warn("Could not copy stylesheet to PiP window:", e);
                }
            });
        }

        return () => {
            if (containerRef.current && pipWindow.document.body.contains(containerRef.current)) {
                try {
                    pipWindow.document.body.removeChild(containerRef.current);
                } catch (e) { }
            }
            containerRef.current = null;
        };
    }, [pipWindow]);

    if (!pipWindow || !containerRef.current) return null;

    // Use a full-height layout inside the container
    return createPortal(
        <div className="flex flex-col h-full w-full max-h-screen">
            {children}
        </div>,
        containerRef.current
    );
};
