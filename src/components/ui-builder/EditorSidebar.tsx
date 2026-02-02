// Editor Sidebar - Element tree and property panel
import React, { useState, useRef, useCallback } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  GripVertical,
  Copy,
  Trash2,
  CheckSquare,
  Layers,
  Settings,
} from 'lucide-react';
import type { UIElement, ContainerProps, ButtonProps, TextProps, IconProps, SpacerProps } from '@/types/ui-builder';
import { PropertyPanel } from './PropertyPanel';

interface EditorSidebarProps {
  elements: UIElement[];
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  selectedElement: UIElement | null;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  onReorder: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUpdateElement: (id: string, props: Record<string, any>) => void;
  onUngroup?: (id: string) => void;
}

type DropPosition = 'before' | 'after' | 'inside' | null;

interface DragState {
  dragId: string | null;
  targetId: string | null;
  position: DropPosition;
}

export function EditorSidebar({
  elements,
  selectedId,
  multiSelectedIds,
  selectedElement,
  onSelect,
  onReorder,
  onDelete,
  onDuplicate,
  onUpdateElement,
  onUngroup,
}: EditorSidebarProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({ dragId: null, targetId: null, position: null });
  const [activeTab, setActiveTab] = useState<'tree' | 'properties'>('tree');

  const toggleCollapse = (id: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragStart = useCallback((id: string) => {
    setDragState({ dragId: id, targetId: null, position: null });
  }, []);

  const handleDragOver = useCallback((targetId: string, position: DropPosition) => {
    setDragState(prev => {
      if (prev.dragId === targetId) return prev;
      return { ...prev, targetId, position };
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragState.dragId && dragState.targetId && dragState.position) {
      onReorder(dragState.dragId, dragState.targetId, dragState.position);
    }
    setDragState({ dragId: null, targetId: null, position: null });
  }, [dragState, onReorder]);

  const handleDragCancel = useCallback(() => {
    setDragState({ dragId: null, targetId: null, position: null });
  }, []);

  const canUngroup = selectedElement && 
    (selectedElement.type === 'row' || selectedElement.type === 'column') && 
    selectedElement.children && 
    selectedElement.children.length > 0;

  return (
    <div className="w-64 border-r border-[hsl(var(--border))] flex flex-col bg-[hsl(var(--card))] overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[hsl(var(--border))]">
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'tree'
              ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))] bg-[hsl(var(--muted)/0.3)]'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          <Layers className="w-4 h-4" />
          元素
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'properties'
              ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))] bg-[hsl(var(--muted)/0.3)]'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
          }`}
        >
          <Settings className="w-4 h-4" />
          屬性
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'tree' ? (
          <div className="h-full overflow-y-auto p-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2 px-2">
              元素結構 <span className="opacity-60">(Shift+點擊多選)</span>
            </p>
            {elements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-[hsl(var(--muted-foreground))]">
                <Layers className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">尚無元素</p>
                <p className="text-xs opacity-60">使用頂部工具列新增</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {elements.map((element) => (
                  <ElementTreeNode
                    key={element.id}
                    element={element}
                    depth={0}
                    selectedId={selectedId}
                    multiSelectedIds={multiSelectedIds}
                    collapsedNodes={collapsedNodes}
                    onSelect={onSelect}
                    onToggleCollapse={toggleCollapse}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    dragState={dragState}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <PropertyPanel
              element={selectedElement}
              onUpdate={onUpdateElement}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onUngroup={canUngroup ? onUngroup : undefined}
            />
          </div>
        )}
      </div>

      {/* Multi-selection info */}
      {multiSelectedIds.size > 1 && activeTab === 'tree' && (
        <div className="p-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            已選擇 <span className="font-medium text-[hsl(var(--foreground))]">{multiSelectedIds.size}</span> 個元素
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 opacity-70">
            使用群組選單合併或刪除
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ELEMENT TREE NODE
// =============================================================================

interface TreeNodeProps {
  element: UIElement;
  depth: number;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  collapsedNodes: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  onToggleCollapse: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  dragState: DragState;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: DropPosition) => void;
  onDragEnd: () => void;
  onDragCancel: () => void;
}

function ElementTreeNode({
  element,
  depth,
  selectedId,
  multiSelectedIds,
  collapsedNodes,
  onSelect,
  onToggleCollapse,
  onDelete,
  onDuplicate,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
}: TreeNodeProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const hasChildren = element.children && element.children.length > 0;
  const isCollapsed = collapsedNodes.has(element.id);
  const isSelected = selectedId === element.id;
  const isMultiSelected = multiSelectedIds.has(element.id);
  const isContainer = element.type === 'row' || element.type === 'column';
  const props = element.props as ContainerProps;
  const isHidden = props.displayMode === 'hidden';
  const isDragging = dragState.dragId === element.id;
  const isDropTarget = dragState.targetId === element.id;

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', element.id);
    onDragStart(element.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragState.dragId === element.id) return;

    const rect = nodeRef.current?.getBoundingClientRect();
    if (!rect) return;

    const y = e.clientY - rect.top;
    const height = rect.height;
    
    if (isContainer && y > height * 0.3 && y < height * 0.7) {
      onDragOver(element.id, 'inside');
    } else if (y < height / 2) {
      onDragOver(element.id, 'before');
    } else {
      onDragOver(element.id, 'after');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragEnd();
  };

  return (
    <div>
      {/* Before indicator */}
      {isDropTarget && dragState.position === 'before' && (
        <div className="h-0.5 bg-[hsl(var(--primary))] rounded-full mx-2 my-0.5 animate-pulse" />
      )}

      <div
        ref={nodeRef}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={onDragCancel}
        onDrop={handleDrop}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group transition-all ${
          isSelected
            ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
            : isMultiSelected
              ? 'bg-[hsl(var(--primary)/0.3)] text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--primary))]'
              : 'hover:bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]'
        } ${isDragging ? 'opacity-50 scale-95' : ''} ${
          isDropTarget && dragState.position === 'inside' 
            ? 'ring-2 ring-[hsl(var(--primary))] ring-inset' 
            : ''
        }`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={(e) => onSelect(element.id, e.shiftKey)}
      >
        {/* Multi-select indicator */}
        {isMultiSelected && !isSelected && (
          <CheckSquare className="w-3 h-3 text-[hsl(var(--primary))] shrink-0" />
        )}
        
        {/* Drag Handle */}
        <GripVertical className="w-3 h-3 opacity-40 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0" />

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(element.id);
            }}
            className="p-0.5"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Type indicator */}
        <span className={`text-xs ${isHidden ? 'opacity-50' : ''}`}>
          {element.type === 'button' && '▢'}
          {element.type === 'text' && 'T'}
          {element.type === 'icon' && '★'}
          {element.type === 'image' && '🖼'}
          {element.type === 'row' && '⬌'}
          {element.type === 'column' && '⬍'}
          {element.type === 'divider' && '—'}
          {element.type === 'spacer' && '⋯'}
        </span>

        {/* Label */}
        <span className={`text-xs flex-1 truncate ${isHidden ? 'opacity-50 line-through' : ''}`}>
          {getElementLabel(element)}
        </span>

        {/* Actions */}
        <div className={`flex items-center gap-0.5 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(element.id);
            }}
            className="p-0.5 hover:bg-[hsl(var(--background)/0.2)] rounded"
            title="複製"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(element.id);
            }}
            className="p-0.5 hover:bg-[hsl(var(--destructive)/0.2)] rounded"
            title="刪除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* After indicator */}
      {isDropTarget && dragState.position === 'after' && (
        <div className="h-0.5 bg-[hsl(var(--primary))] rounded-full mx-2 my-0.5 animate-pulse" />
      )}

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div>
          {element.children!.map((child) => (
            <ElementTreeNode
              key={child.id}
              element={child}
              depth={depth + 1}
              selectedId={selectedId}
              multiSelectedIds={multiSelectedIds}
              collapsedNodes={collapsedNodes}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDragCancel={onDragCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getElementLabel(element: UIElement): string {
  switch (element.type) {
    case 'button':
      return (element.props as ButtonProps).label || '按鈕';
    case 'text':
      const content = (element.props as TextProps).content || '';
      return content.substring(0, 12) + (content.length > 12 ? '...' : '') || '文字';
    case 'icon':
      return (element.props as IconProps).iconName || '圖示';
    case 'row':
      return `列 (${element.children?.length || 0})`;
    case 'column':
      return `欄 (${element.children?.length || 0})`;
    case 'divider':
      return '分隔線';
    case 'spacer':
      return `間距 ${(element.props as SpacerProps).size}px`;
    default:
      return element.type;
  }
}

export default EditorSidebar;
