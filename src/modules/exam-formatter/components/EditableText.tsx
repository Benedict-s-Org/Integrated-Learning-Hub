import React, { useState, useEffect, useRef } from 'react';

interface EditableTextProps {
    value?: string;
    onChange: (newValue: string) => void;
    placeholder?: string;
    className?: string;
    multiline?: boolean;
    onFocus?: () => void;
}

/**
 * A "Microsoft Word-like" inline editor component.
 * Uses contentEditable with local state to avoid cursor jumping and state desync.
 */
export const EditableText: React.FC<EditableTextProps> = ({ 
    value = '', 
    onChange, 
    placeholder = 'Type here...', 
    className = '', 
    multiline = false,
    onFocus
}) => {
    const [localValue, setLocalValue] = useState(value);
    const editorRef = useRef<HTMLDivElement>(null);
    const isFocused = useRef(false);

    // Update local value when prop changes, but ONLY if we are not currently typing
    useEffect(() => {
        if (!isFocused.current) {
            setLocalValue(value);
        }
    }, [value]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        setLocalValue(e.currentTarget.innerText);
    };

    const handleBlur = () => {
        isFocused.current = false;
        onChange(localValue);
    };

    const handleFocus = () => {
        isFocused.current = true;
        if (onFocus) onFocus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            editorRef.current?.blur();
        }
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className={`editable-text outline-none focus:bg-blue-50/30 ring-0 focus:ring-1 focus:ring-blue-200 rounded px-1 -mx-1 transition-all min-h-[1.2em] ${className}`}
            data-placeholder={placeholder}
        >
            {localValue}
        </div>
    );
};
