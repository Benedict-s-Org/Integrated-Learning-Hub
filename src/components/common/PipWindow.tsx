import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PipWindowProps {
    pipWindow: Window;
    title?: string;
    children: React.ReactNode;
}

export const PipWindow: React.FC<PipWindowProps> = ({ pipWindow, title = 'Desktop Name Bar', children }) => {
    const [container, setContainer] = React.useState<HTMLDivElement | null>(null);

    // Set the PiP window title
    useEffect(() => {
        if (pipWindow) {
            pipWindow.document.title = title;
        }
    }, [pipWindow, title]);

    // Create or refresh the container element in the PiP window
    useEffect(() => {
        if (!pipWindow) {
            setContainer(null);
            return;
        }

        console.log('[PipWindow] Initializing container for new window...');

        // Create the container in the PiP window's document
        const newContainer = pipWindow.document.createElement('div');
        newContainer.className = "h-screen w-full bg-white overflow-hidden";
        pipWindow.document.body.appendChild(newContainer);

        // Ensure body has no margin/padding
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.height = '100vh';
        pipWindow.document.body.style.width = '100vw';

        // Copy styles
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
                console.warn("[PipWindow] Could not copy stylesheet:", e);
            }
        });

        setContainer(newContainer);

        return () => {
            console.log('[PipWindow] Cleaning up container...');
            if (newContainer && pipWindow.document.body.contains(newContainer)) {
                try {
                    pipWindow.document.body.removeChild(newContainer);
                } catch (e) { }
            }
            setContainer(null);
        };
    }, [pipWindow]);

    if (!pipWindow || !container) {
        return null;
    }

    // Use a full-height layout inside the container
    return createPortal(
        <div className="flex flex-col h-full w-full max-h-screen">
            {children}
        </div>,
        container
    );
};
