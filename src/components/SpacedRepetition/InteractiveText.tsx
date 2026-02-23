import { useState, useRef, useEffect, useCallback } from 'react';

interface InteractiveTextProps {
    text: string;
    onSelectionChange: (selection: string | null) => void;
    className?: string;
    isEnabled?: boolean;
}

export function InteractiveText({
    text,
    onSelectionChange,
    className = "",
    isEnabled = true
}: InteractiveTextProps) {
    const [selection, setSelection] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseUp = useCallback(() => {
        if (!isEnabled) return;

        const browserSelection = window.getSelection();
        if (browserSelection && browserSelection.toString().trim()) {
            const selectedText = browserSelection.toString().trim();
            // Ensure the selection is within our container
            if (containerRef.current?.contains(browserSelection.anchorNode)) {
                setSelection(selectedText);
                onSelectionChange(selectedText);
            }
        }
    }, [isEnabled, onSelectionChange]);

    const handleClick = () => {
        if (!isEnabled) return;

        // If it's a simple click (not a drag selection), we can clear or handle single word
        const browserSelection = window.getSelection();
        if (!browserSelection || !browserSelection.toString().trim()) {
            // Logic for clicking a single word if needed, 
            // but browser standard behavior often handles double-click for word selection.
            // We'll rely on the mouseup/selection API for flexibility.
        }
    };

    // Clear selection if disabled
    useEffect(() => {
        if (!isEnabled) {
            setSelection(null);
            onSelectionChange(null);
            const browserSelection = window.getSelection();
            browserSelection?.removeAllRanges();
        }
    }, [isEnabled, onSelectionChange]);

    return (
        <div
            ref={containerRef}
            onMouseUp={handleMouseUp}
            onClick={handleClick}
            className={`relative inline-block ${className} ${isEnabled ? 'cursor-text' : ''}`}
            style={{ userSelect: isEnabled ? 'text' : 'none' }}
        >
            {text}
            {isEnabled && selection && (
                <div className="absolute -top-6 right-0 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm animate-in fade-in slide-in-from-bottom-1">
                    Selection Ready
                </div>
            )}
        </div>
    );
}
