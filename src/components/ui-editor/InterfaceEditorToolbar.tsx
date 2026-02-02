import React from 'react';
import { 
  X, Save, Undo2, Redo2, 
  Square, Type, Star, Image, 
  LayoutList, LayoutGrid, Minus, MoveVertical 
} from 'lucide-react';
import { useInterfaceEditor } from '@/contexts/InterfaceEditorContext';
import { DraggableElement } from './DraggableElement';
import type { UIElementType } from '@/types/ui-builder';

interface ToolbarElement {
  type: UIElementType;
  icon: React.ReactNode;
  label: string;
}

const toolbarElements: ToolbarElement[] = [
  { type: 'button', icon: <Square size={18} />, label: '按鈕' },
  { type: 'text', icon: <Type size={18} />, label: '文字' },
  { type: 'icon', icon: <Star size={18} />, label: '圖示' },
  { type: 'image', icon: <Image size={18} />, label: '圖像' },
  { type: 'row', icon: <LayoutList size={18} />, label: '列' },
  { type: 'column', icon: <LayoutGrid size={18} />, label: '欄' },
  { type: 'divider', icon: <Minus size={18} />, label: '分隔線' },
  { type: 'spacer', icon: <MoveVertical size={18} />, label: '間距' },
];

export function InterfaceEditorToolbar() {
  const { 
    isEditing, 
    saveChanges, 
    discardChanges, 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    hasUnsavedChanges,
  } = useInterfaceEditor();

  if (!isEditing) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Draggable elements */}
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-[hsl(var(--muted-foreground))] mr-2">
              拖曳新增:
            </span>
            <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-lg p-1">
              {toolbarElements.map((el) => (
                <DraggableElement
                  key={el.type}
                  type={el.type}
                  icon={el.icon}
                  label={el.label}
                />
              ))}
            </div>
          </div>

          {/* Center: History controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] disabled:opacity-40 
                         disabled:cursor-not-allowed transition-colors"
              title="復原 (Ctrl+Z)"
            >
              <Undo2 size={18} className="text-[hsl(var(--foreground))]" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] disabled:opacity-40 
                         disabled:cursor-not-allowed transition-colors"
              title="重做 (Ctrl+Shift+Z)"
            >
              <Redo2 size={18} className="text-[hsl(var(--foreground))]" />
            </button>
          </div>

          {/* Right: Save/Cancel */}
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <span className="text-xs text-[hsl(var(--accent))] font-medium">
                未儲存變更
              </span>
            )}
            <button
              onClick={saveChanges}
              className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] 
                         text-[hsl(var(--primary-foreground))] rounded-lg font-medium
                         hover:opacity-90 transition-opacity"
            >
              <Save size={16} />
              儲存
            </button>
            <button
              onClick={discardChanges}
              className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] 
                         text-[hsl(var(--foreground))] rounded-lg font-medium
                         hover:bg-[hsl(var(--secondary))] transition-colors"
            >
              <X size={16} />
              取消
            </button>
          </div>
        </div>

        {/* Hint text */}
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
          拖曳元素到頁面上放置，接近其他元素時會自動對齊。單擊選取編輯，雙擊執行功能。
        </p>
      </div>
    </div>
  );
}
