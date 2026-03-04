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

    // Create a container element in the PiP window for our portal
    if (!containerRef.current && pipWindow) {
        containerRef.current = pipWindow.document.createElement('div');
        containerRef.current.className = "h-screen w-full bg-white overflow-hidden";
        pipWindow.document.body.appendChild(containerRef.current);

        // Ensure body has no margin/padding
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.body.style.padding = '0';
        pipWindow.document.body.style.height = '100vh';
        pipWindow.document.body.style.width = '100vw';
    }

    // Cleanup when component unmounts
    useEffect(() => {
        return () => {
            if (containerRef.current && pipWindow && pipWindow.document.body.contains(containerRef.current)) {
                try {
                    pipWindow.document.body.removeChild(containerRef.current);
                } catch (e) {
                    // Ignore DOM exception if window is already closed
                }
            }
        };
    }, [pipWindow]);

    if (!containerRef.current) return null;

    // Use a full-height layout inside the container
    return createPortal(
        <div className="flex flex-col h-full w-full max-h-screen">
            {children}
        </div>,
        containerRef.current
    );
};
