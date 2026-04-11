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
  { name: 'Small', value: '1' }, // 1-7 for execCommand
  { name: 'Base', value: '3' },
  { name: 'Large', value: '4' },
  { name: 'X-Large', value: '5' },
  { name: '2X-Large', value: '6' },
];

function RichTextEditor({
  value,
  onChange,
  label,
  multiline = false,
  placeholder = '',
  className = '',
  rows = 3
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Sync value prop to internal content only when not focused or on initial mount
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (!isFocused || value === "") {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value, isFocused]);

  const handleInput = () => {
    if (editorRef.current) {
      let html = editorRef.current.innerHTML;
      // If it's just a <br> (common in empty contentEditable), treat as empty
      if (html === '<br>') html = '';
      onChange(html);
    }
  };

  const handleCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleInput();
    if (editorRef.current) editorRef.current.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
    }
    
    // Shortcuts
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b') {
        e.preventDefault();
        handleCommand('bold');
      }
      if (e.key === 'i') {
        e.preventDefault();
        handleCommand('italic');
      }
      if (e.key === 'u') {
        e.preventDefault();
        handleCommand('underline');
      }
    }
  };

  return (
    <div className={`space-y-1.5 w-full ${className} group/rte`}>
      {label && (
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
          {label}
        </label>
      )}
      
      <div className={`relative border-2 rounded-2xl transition-all overflow-hidden bg-slate-50 ${
        isFocused ? 'border-indigo-500 bg-white ring-4 ring-indigo-50' : 'border-slate-100'
      }`}>
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-1.5 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <button
            onMouseDown={(e) => { e.preventDefault(); handleCommand('bold'); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Bold (Cmd+B)"
          >
            <Bold size={16} />
          </button>
          <button
             onMouseDown={(e) => { e.preventDefault(); handleCommand('italic'); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Italic (Cmd+I)"
          >
            <Italic size={16} />
          </button>
          <button
             onMouseDown={(e) => { e.preventDefault(); handleCommand('underline'); }}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Underline (Cmd+U)"
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCommand('foreColor', c.value);
                      setShowColors(false);
                    }}
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCommand('fontSize', s.value);
                      setShowSizes(false);
                    }}
                    className="px-3 py-2 text-left hover:bg-indigo-50 text-xs font-bold text-slate-600 rounded-lg transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ContentEditable Area */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          className={`w-full px-5 py-4 bg-transparent outline-none text-slate-700 leading-relaxed min-h-[44px] relative
            ${multiline ? 'min-h-[120px] resize-y overflow-auto' : 'flex items-center whitespace-nowrap overflow-x-auto overflow-y-hidden'}
            ${!value && 'before:content-[attr(data-placeholder)] before:text-slate-400 before:absolute before:left-5 before:top-4 before:pointer-events-none before:font-medium text-sm'}
          `}
          data-placeholder={placeholder}
          style={multiline ? { height: rows ? `${rows * 1.5}rem` : 'auto' } : {}}
        />
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
          WYSIWYG Mode Enabled — Changes are saved automatically
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          position: absolute;
          pointer-events: none;
        }
        [contenteditable] {
          min-height: 1.5em;
        }
        [contenteditable] b, [contenteditable] strong {
          font-weight: 800;
        }
      `}} />
    </div>
  );
}

export default React.memo(RichTextEditor);
