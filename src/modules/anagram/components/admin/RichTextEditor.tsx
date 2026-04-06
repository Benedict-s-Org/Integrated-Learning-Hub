import React, { useRef, useState, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Type, 
  Palette,
  ChevronDown
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
}

const COLORS = [
  { name: 'Default', value: '' },
  { name: 'Slate', value: '#64748b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#f43f5e' },
];

const FONT_SIZES = [
  { name: 'Small', value: '0.875rem' },
  { name: 'Base', value: '1rem' },
  { name: 'Large', value: '1.25rem' },
  { name: 'X-Large', value: '1.5rem' },
  { name: '2X-Large', value: '1.875rem' },
];

export default function RichTextEditor({
  value,
  onChange,
  label,
  multiline = false,
  placeholder = '',
  className = '',
  rows = 3
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);

  const insertTag = (startTag: string, endTag: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    
    // If wrapping an existing tag of the same type, we could untag it, 
    // but for simplicity we just wrap.
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newValue = `${before}${startTag}${selectedText}${endTag}${after}`;
    onChange(newValue);

    // Set selection back
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + startTag.length, end + startTag.length);
    }, 0);
  };

  const handleBold = () => insertTag('<strong>', '</strong>');
  const handleItalic = () => insertTag('<em>', '</em>');
  const handleUnderline = () => insertTag('<u>', '</u>');
  
  const handleColor = (color: string) => {
    if (color) {
      insertTag(`<span style="color: ${color}">`, '</span>');
    }
    setShowColors(false);
  };

  const handleSize = (size: string) => {
    insertTag(`<span style="font-size: ${size}">`, '</span>');
    setShowSizes(false);
  };

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {label && (
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
          {label}
        </label>
      )}
      
      <div className="relative border-2 border-slate-100 rounded-2xl bg-slate-50 focus-within:border-blue-500 focus-within:bg-white transition-all overflow-hidden group">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-1.5 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
          <button
            onClick={handleBold}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            onClick={handleItalic}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button
            onClick={handleUnderline}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Underline"
          >
            <Underline size={16} />
          </button>
          
          <div className="w-px h-4 bg-slate-200 mx-1" />
          
          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColors(!showColors)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-0.5"
              title="Text Color"
            >
              <Palette size={16} />
              <ChevronDown size={10} />
            </button>
            {showColors && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-xl shadow-2xl border border-slate-100 grid grid-cols-5 gap-1.5 z-20 w-40 animate-in fade-in zoom-in-95">
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => handleColor(c.value)}
                    className="w-6 h-6 rounded-md border border-slate-100 hover:scale-110 transition-transform flex items-center justify-center shrink-0"
                    style={{ backgroundColor: c.value || '#fff' }}
                    title={c.name}
                  >
                    {!c.value && <div className="w-px h-4 bg-red-400 rotate-45" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Font Size */}
          <div className="relative">
            <button
              onClick={() => setShowSizes(!showSizes)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-0.5"
              title="Font Size"
            >
              <Type size={16} />
              <ChevronDown size={10} />
            </button>
            {showSizes && (
              <div className="absolute top-full left-0 mt-1 p-1 bg-white rounded-xl shadow-2xl border border-slate-100 flex flex-col z-20 w-32 animate-in fade-in zoom-in-95">
                {FONT_SIZES.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => handleSize(s.value)}
                    className="px-3 py-2 text-left hover:bg-blue-50 text-xs font-bold text-slate-600 rounded-lg transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Input/Textarea */}
        {multiline ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className="w-full px-5 py-4 bg-transparent outline-none font-medium text-slate-700 resize-y min-h-[100px] leading-relaxed"
          />
        ) : (
          <input
            ref={textareaRef as any}
            type="text"
            value={value}
            onChange={(e: any) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-5 py-4 bg-transparent outline-none font-bold text-slate-800"
          />
        )}
      </div>

      {/* Preview hint */}
      <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest pl-1">
        Supports HTML tags for rich formatting
      </p>
    </div>
  );
}
