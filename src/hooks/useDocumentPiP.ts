import { useState, useCallback, useEffect } from 'react';

// Define the API interface since it's experimental and might not be in standard TS types yet
interface DocumentPictureInPicture {
    requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
    window: Window | null;
    onpagehide: ((this: DocumentPictureInPicture, ev: Event) => any) | null;
    addEventListener<K extends keyof EventTargetEventMap>(type: K, listener: (this: DocumentPictureInPicture, ev: EventTargetEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof EventTargetEventMap>(type: K, listener: (this: DocumentPictureInPicture, ev: EventTargetEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
}

declare global {
    interface Window {
        documentPictureInPicture?: DocumentPictureInPicture;
    }
}

export const useDocumentPiP = () => {
    const [isSupported, setIsSupported] = useState(false);
    const [pipWindow, setPipWindow] = useState<Window | null>(null);

    useEffect(() => {
        setIsSupported('documentPictureInPicture' in window);
    }, []);

    const closePip = useCallback(() => {
        if (pipWindow) {
            pipWindow.close();
            setPipWindow(null);
        }
    }, [pipWindow]);

    const requestPip = useCallback(async (options: { width?: number; height?: number } = {}) => {
        if (!isSupported || !window.documentPictureInPicture) {
            console.warn("Document Picture-in-Picture is not supported in this browser.");
            return null;
        }

        try {
            // Options: https://developer.chrome.com/docs/web-platform/document-picture-in-picture/
            const pip = await window.documentPictureInPicture.requestWindow({
                width: options.width || 300,
                height: options.height || 600,
            });

            // 1. Clone all existing style and link tags for robust Vite dev and production support
            Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).forEach((node) => {
                pip.document.head.appendChild(node.cloneNode(true));
            });

            // 2. Also copy CSS rules for any dynamic stylesheets
            [...document.styleSheets].forEach((styleSheet) => {
                // If it has an href, it's a <link> and was already cloned above
                if (styleSheet.href) return;
                try {
                    const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                    const style = document.createElement('style');
                    style.textContent = cssRules;
                    pip.document.head.appendChild(style);
                } catch (e) {
                    if (e instanceof DOMException && e.name === 'SecurityError') {
                        console.warn('Document PiP: Could not access cross-origin stylesheet rules', styleSheet.href);
                    }
                }
            });

            // Handle when the user manually closes the PiP window
            pip.addEventListener('pagehide', () => {
                setPipWindow(null);
            });

            setPipWindow(pip);
            return pip;
        } catch (error) {
            console.error("Failed to open Document PiP window:", error);
            return null;
        }
    }, [isSupported]);

    return {
        isSupported,
        pipWindow,
        requestPip,
        closePip
    };
};
