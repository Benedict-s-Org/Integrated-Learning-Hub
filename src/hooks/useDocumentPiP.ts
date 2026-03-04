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

            // Copy all styles from the main window to the PiP window so Tailwind works
            [...document.styleSheets].forEach((styleSheet) => {
                try {
                    const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
                    const style = document.createElement('style');
                    style.textContent = cssRules;
                    pip.document.head.appendChild(style);
                } catch (e) {
                    // This can happen for cross-origin stylesheets
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.type = styleSheet.type;
                    link.media = styleSheet.media.mediaText;
                    link.href = styleSheet.href || '';
                    pip.document.head.appendChild(link);
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
