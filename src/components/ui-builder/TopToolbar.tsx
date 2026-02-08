// Top Toolbar - Consolidated toolbar with dropdowns for all UI Builder actions
import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Save,
  X,
  ChevronDown,
  Rows,
  Columns,
  Ungroup,
  Trash2,
  BookTemplate,
  Folder,
  Square,
  Type,
  MousePointer,
  Image,
  Minus,
  MoveHorizontal,
} from 'lucide-react';
import type { UIElementType, UIElement, Asset, UITemplate } from '@/types/ui-builder';

interface TopToolbarProps {
  // Element actions
  onAddElement: (type: UIElementType) => void;

  // Group actions
  onGroupAsRow: () => void;
  onGroupAsColumn: () => void;
  onUngroup: (id: string) => void;
  onDeleteSelected: () => void;

  // History actions
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  // Selection state
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  canUngroup: boolean;

  // Panel actions
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onOpenAssets: () => void;
  onSave: () => void;
  onClose?: () => void;

  // Templates
  presetTemplates: UITemplate[];
  onApplyTemplate: (elements: UIElement[]) => void;

  // Assets
  assets: Asset[];
  onAddAsset: (asset: Asset) => void;
  onRemoveAsset: (id: string) => void;
}

type DropdownType = 'elements' | 'group' | 'templates' | null;

const ELEMENT_ITEMS: { type: UIElementType; label: string; icon: React.ReactNode }[] = [
  { type: 'button', label: '按鈕', icon: <Square className="w-4 h-4" /> },
  { type: 'text', label: '文字', icon: <Type className="w-4 h-4" /> },
  { type: 'icon', label: '圖案', icon: <MousePointer className="w-4 h-4" /> },
  { type: 'image', label: '圖像', icon: <Image className="w-4 h-4" /> },
  { type: 'row', label: '列', icon: <Columns className="w-4 h-4" /> },
  { type: 'column', label: '欄', icon: <Rows className="w-4 h-4" /> },
  { type: 'divider', label: '分隔線', icon: <Minus className="w-4 h-4" /> },
  { type: 'spacer', label: '間距', icon: <MoveHorizontal className="w-4 h-4" /> },
];

export function TopToolbar({
  onAddElement,
  onGroupAsRow,
  onGroupAsColumn,
  onUngroup,
  onDeleteSelected,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedId,
  multiSelectedIds,
  canUngroup,
  isMaximized,
  onToggleMaximize,
  onOpenAssets,
  onSave,
  onClose,
  presetTemplates,
  onApplyTemplate,
}: TopToolbarProps) {
  const [openDropdown, setOpenDropdown] = useState<DropdownType>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasMultiSelection = multiSelectedIds.size > 1;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (type: DropdownType) => {
    setOpenDropdown(prev => prev === type ? null : type);
  };

  const handleAddElement = (type: UIElementType) => {
    onAddElement(type);
    setOpenDropdown(null);
  };

  const handleApplyTemplate = (template: UITemplate) => {
    if (window.confirm(`確定要載入模板「${template.name}」嗎？這將覆蓋目前的設計。`)) {
      const clonedElements = JSON.parse(JSON.stringify(template.elements));
      regenerateIds(clonedElements);
      onApplyTemplate(clonedElements);
    }
    setOpenDropdown(null);
  };

  return (
    <div
      ref={dropdownRef}
      className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]"
    >
      {/* Left: Action Dropdowns */}
      <div className="flex items-center gap-1">
        {/* Add Element Dropdown */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('elements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${openDropdown === 'elements'
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              : 'bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
              }`}
          >
            <Plus className="w-4 h-4" />
            新增元素
            <ChevronDown className="w-3 h-3" />
          </button>

          {openDropdown === 'elements' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-50 py-1">
              {ELEMENT_ITEMS.map(item => (
                <button
                  key={item.type}
                  onClick={() => handleAddElement(item.type)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  <span className="text-[hsl(var(--muted-foreground))]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Group Actions Dropdown */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('group')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${openDropdown === 'group'
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              : hasMultiSelection || canUngroup
                ? 'bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
                : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
              }`}
          >
            <Rows className="w-4 h-4" />
            群組
            {hasMultiSelection && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-full">
                {multiSelectedIds.size}
              </span>
            )}
            <ChevronDown className="w-3 h-3" />
          </button>

          {openDropdown === 'group' && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-50 py-1">
              <button
                onClick={() => { onGroupAsRow(); setOpenDropdown(null); }}
                disabled={!hasMultiSelection}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${hasMultiSelection
                  ? 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
                  : 'text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                  }`}
              >
                <Columns className="w-4 h-4" />
                合併為列
              </button>
              <button
                onClick={() => { onGroupAsColumn(); setOpenDropdown(null); }}
                disabled={!hasMultiSelection}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${hasMultiSelection
                  ? 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
                  : 'text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                  }`}
              >
                <Rows className="w-4 h-4" />
                合併為欄
              </button>

              <div className="h-px bg-[hsl(var(--border))] my-1" />

              <button
                onClick={() => {
                  if (selectedId) onUngroup(selectedId);
                  setOpenDropdown(null);
                }}
                disabled={!canUngroup}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${canUngroup
                  ? 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
                  : 'text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                  }`}
              >
                <Ungroup className="w-4 h-4" />
                解除群組
              </button>

              <div className="h-px bg-[hsl(var(--border))] my-1" />

              <button
                onClick={() => { onDeleteSelected(); setOpenDropdown(null); }}
                disabled={multiSelectedIds.size === 0}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${multiSelectedIds.size > 0
                  ? 'text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)]'
                  : 'text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                  }`}
              >
                <Trash2 className="w-4 h-4" />
                刪除選中
              </button>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-2 rounded-md transition-colors ${canUndo
              ? 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
              : 'text-[hsl(var(--muted-foreground)/0.4)] cursor-not-allowed'
              }`}
            title="復原"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-2 rounded-md transition-colors ${canRedo
              ? 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
              : 'text-[hsl(var(--muted-foreground)/0.4)] cursor-not-allowed'
              }`}
            title="重做"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-[hsl(var(--border))] mx-1" />

        {/* Templates Dropdown */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('templates')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${openDropdown === 'templates'
              ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
              : 'bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
              }`}
          >
            <BookTemplate className="w-4 h-4" />
            模板
            <ChevronDown className="w-3 h-3" />
          </button>

          {openDropdown === 'templates' && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
              <div className="px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))] font-medium">
                預設模板
              </div>
              {presetTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template)}
                  className="w-full flex flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  <span className="text-sm text-[hsl(var(--foreground))]">{template.name}</span>
                  {template.description && (
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{template.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Panel Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenAssets}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors"
          title="資源管理"
        >
          <Folder className="w-4 h-4" />
          資源
        </button>

        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--primary)/0.9)] transition-colors"
        >
          <Save className="w-4 h-4" />
          儲存
        </button>

        {onClose && (
          <>
            <button
              onClick={onToggleMaximize}
              className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors"
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function regenerateIds(elements: UIElement[]): void {
  for (const element of elements) {
    element.id = `${element.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    if (element.children) {
      regenerateIds(element.children);
    }
  }
}

export default TopToolbar;
