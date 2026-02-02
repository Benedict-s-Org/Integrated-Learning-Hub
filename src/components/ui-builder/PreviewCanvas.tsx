// Preview Canvas - Render and interact with UI elements with drag-and-drop reordering
import React, { useState, useCallback, useRef } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Eye,
  EyeOff,
  Trash2,
  Copy,
  GripVertical,
  Plus,
  Minus,
  CheckSquare
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { UIElement, ContainerProps, ButtonProps, TextProps, IconProps, DividerProps, SpacerProps, DisplayMode } from '@/types/ui-builder';
import { CurvedTextRenderer } from './CurvedTextRenderer';
import { BUTTON_VARIANT_STYLES } from '@/types/ui-builder';

interface PreviewCanvasProps {
  elements: UIElement[];
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  onReorder: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

type DropPosition = 'before' | 'after' | 'inside' | null;

interface DragState {
  dragId: string | null;
  targetId: string | null;
  position: DropPosition;
}

export function PreviewCanvas({
  elements,
  selectedId,
  multiSelectedIds,
  onSelect,
  onReorder,
  onDelete,
  onDuplicate,
}: PreviewCanvasProps) {
  const [showTree, setShowTree] = useState(true);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({ dragId: null, targetId: null, position: null });

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
      if (prev.dragId === targetId) return prev; // Can't drop on self
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

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[hsl(var(--foreground))]">預覽畫布</h3>
          {multiSelectedIds.size > 1 && (
            <span className="px-2 py-0.5 text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-full">
              {multiSelectedIds.size} 已選
            </span>
          )}
        </div>
        <button
          onClick={() => setShowTree(!showTree)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          {showTree ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showTree ? '隱藏樹狀圖' : '顯示樹狀圖'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Element Tree */}
        {showTree && (
          <div className="w-48 border-r border-[hsl(var(--border))] overflow-y-auto p-2 bg-[hsl(var(--muted)/0.3)]">
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2 px-2">
              元素結構 <span className="opacity-60">(Shift+點擊多選)</span>
            </p>
            {elements.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-4">
                沒有元素
              </p>
            ) : (
              <div className="space-y-1">
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
        )}

        {/* Live Preview */}
        <div 
          className="flex-1 overflow-auto p-4 bg-[hsl(var(--background))]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onSelect(null);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDragEnd}
        >
          {elements.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--muted-foreground))]">
              <Plus className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">使用工具列新增元素</p>
            </div>
          ) : (
            <div className="space-y-2">
              {elements.map((element, index) => (
                <DraggableElement
                  key={element.id}
                  element={element}
                  selectedId={selectedId}
                  multiSelectedIds={multiSelectedIds}
                  onSelect={onSelect}
                  dragState={dragState}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  isFirst={index === 0}
                  isLast={index === elements.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ELEMENT TREE NODE WITH DRAG & DROP
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
      return content.substring(0, 15) + (content.length > 15 ? '...' : '') || '文字';
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

// =============================================================================
// DRAGGABLE ELEMENT RENDERER
// =============================================================================

interface DraggableElementProps {
  element: UIElement;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  dragState: DragState;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: DropPosition) => void;
  onDragEnd: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function DraggableElement({
  element,
  selectedId,
  multiSelectedIds,
  onSelect,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
  isFirst,
  isLast,
}: DraggableElementProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isSelected = selectedId === element.id;
  const isMultiSelected = multiSelectedIds.has(element.id);
  const isDragging = dragState.dragId === element.id;
  const isDropTarget = dragState.targetId === element.id;
  const isContainer = element.type === 'row' || element.type === 'column';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(element.id, e.shiftKey);
  };

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

    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const y = e.clientY - rect.top;
    const height = rect.height;
    
    if (isContainer && y > height * 0.25 && y < height * 0.75) {
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

  const wrapperClasses = `relative transition-all ${
    isSelected 
      ? 'ring-2 ring-[hsl(var(--primary))] ring-offset-2' 
      : isMultiSelected
        ? 'ring-2 ring-[hsl(var(--primary)/0.5)] ring-offset-1 bg-[hsl(var(--primary)/0.05)]'
        : 'hover:ring-1 hover:ring-[hsl(var(--primary)/0.5)]'
  } ${isDragging ? 'opacity-50 scale-95' : ''} ${
    isDropTarget && dragState.position === 'inside' ? 'ring-2 ring-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.1)]' : ''
  }`;

  return (
    <div className="relative">
      {/* Before drop indicator */}
      {isDropTarget && dragState.position === 'before' && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-[hsl(var(--primary))] rounded-full z-10 animate-pulse" />
      )}

      <div
        ref={ref}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`${wrapperClasses} cursor-grab active:cursor-grabbing`}
        onClick={handleClick}
      >
        {/* Drag handle overlay on hover */}
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        </div>

        <ElementContent
          element={element}
          selectedId={selectedId}
          multiSelectedIds={multiSelectedIds}
          onSelect={onSelect}
          dragState={dragState}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        />
      </div>

      {/* After drop indicator */}
      {isDropTarget && dragState.position === 'after' && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[hsl(var(--primary))] rounded-full z-10 animate-pulse" />
      )}
    </div>
  );
}

// =============================================================================
// ELEMENT CONTENT RENDERER
// =============================================================================

function ElementContent({
  element,
  selectedId,
  multiSelectedIds,
  onSelect,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  element: UIElement;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  dragState: DragState;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: DropPosition) => void;
  onDragEnd: () => void;
}) {
  switch (element.type) {
    case 'button':
      return <ButtonElement props={element.props as ButtonProps} />;
    case 'text':
      return <TextElement props={element.props as TextProps} />;
    case 'icon':
      return <IconElement props={element.props as IconProps} />;
    case 'row':
    case 'column':
      return (
        <ContainerElement
          element={element}
          isSelected={selectedId === element.id}
          selectedId={selectedId}
          multiSelectedIds={multiSelectedIds}
          onSelect={onSelect}
          dragState={dragState}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        />
      );
    case 'divider':
      return <DividerElement props={element.props as DividerProps} />;
    case 'spacer':
      return <SpacerElement props={element.props as SpacerProps} />;
    default:
      return null;
  }
}

// =============================================================================
// INDIVIDUAL ELEMENT RENDERERS
// =============================================================================

function ButtonElement({ props }: { props: ButtonProps }) {
  const variantStyle = BUTTON_VARIANT_STYLES[props.variant || 'primary'];
  
  return (
    <button
      className="px-4 py-2 rounded-md font-medium transition-colors"
      style={{
        backgroundColor: variantStyle.bg,
        color: variantStyle.fg,
        border: variantStyle.border ? `1px solid ${variantStyle.border}` : 'none',
        opacity: props.disabled ? 0.5 : 1,
        fontSize: props.size === 'sm' ? 12 : props.size === 'lg' ? 18 : 14,
        padding: props.size === 'sm' ? '4px 12px' : props.size === 'lg' ? '12px 24px' : '8px 16px',
      }}
      disabled
    >
      {props.label || '按鈕'}
    </button>
  );
}

function TextElement({ props }: { props: TextProps }) {
  const textStyle: React.CSSProperties = {
    fontSize: props.fontSize || 16,
    fontWeight: props.fontWeight || 400,
    letterSpacing: props.letterSpacing || 0,
    lineHeight: props.lineHeight || 1.5,
    textAlign: props.textAlign || 'left',
    textTransform: props.textTransform || 'none',
    textDecoration: props.textDecoration || 'none',
    color: props.color || 'inherit',
    textShadow: props.textShadow?.enabled
      ? `${props.textShadow.offsetX}px ${props.textShadow.offsetY}px ${props.textShadow.blur}px ${props.textShadow.color}`
      : 'none',
  };

  if (props.shape && props.shape !== 'none') {
    return (
      <CurvedTextRenderer
        text={props.content || '文字'}
        shape={props.shape}
        curve={props.curve || 0}
        fontSize={props.fontSize || 16}
        fontWeight={props.fontWeight || 400}
        color={props.color || 'currentColor'}
        letterSpacing={props.letterSpacing || 0}
      />
    );
  }

  return (
    <p style={textStyle}>
      {props.content || '文字'}
    </p>
  );
}

function IconElement({ props }: { props: IconProps }) {
  const IconComponent = (LucideIcons as any)[props.iconName];
  
  if (!IconComponent) {
    return (
      <div 
        className="flex items-center justify-center bg-[hsl(var(--muted))] rounded"
        style={{ 
          width: props.size || 24, 
          height: props.size || 24,
          color: props.color || 'currentColor',
        }}
      >
        ?
      </div>
    );
  }

  return (
    <IconComponent
      size={props.size || 24}
      strokeWidth={props.strokeWidth || 2}
      color={props.color || 'currentColor'}
    />
  );
}

function ContainerElement({
  element,
  isSelected,
  selectedId,
  multiSelectedIds,
  onSelect,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  element: UIElement;
  isSelected: boolean;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  dragState: DragState;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: DropPosition) => void;
  onDragEnd: () => void;
}) {
  const props = element.props as ContainerProps;
  const isRow = element.type === 'row';
  const [isExpanded, setIsExpanded] = useState(!(props.defaultCollapsed));

  // Handle display modes
  if (props.displayMode === 'hidden') {
    return (
      <div 
        className={`border-2 border-dashed border-[hsl(var(--muted-foreground)/0.3)] rounded-lg p-4 opacity-50`}
      >
        <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
          <EyeOff className="w-4 h-4" />
          <span className="text-sm">隱藏的{isRow ? '列' : '欄'}</span>
        </div>
      </div>
    );
  }

  if (props.displayMode === 'collapsible') {
    return (
      <div className="border border-[hsl(var(--border))] rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center gap-2 p-3 bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted)/0.8)] transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {props.collapseIcon === 'plus' ? (
            isExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />
          ) : props.collapseIcon === 'arrow' ? (
            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          ) : (
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
          )}
          <span className="text-sm font-medium">{props.collapseLabel || '點擊展開'}</span>
        </button>
        
        <div 
          className={`overflow-hidden transition-all ${
            props.animationSpeed === 'fast' ? 'duration-150' 
            : props.animationSpeed === 'slow' ? 'duration-500' 
            : 'duration-300'
          }`}
          style={{ maxHeight: isExpanded ? '1000px' : '0' }}
        >
          <div 
            className={`p-${props.padding || 0} ${isRow ? 'flex' : 'flex flex-col'}`}
            style={{ 
              gap: props.gap || 0,
              alignItems: props.alignItems || 'stretch',
              justifyContent: props.justifyContent === 'between' ? 'space-between' 
                : props.justifyContent === 'around' ? 'space-around'
                : props.justifyContent === 'evenly' ? 'space-evenly'
                : props.justifyContent || 'flex-start',
            }}
          >
            {element.children?.map((child, index) => (
              <DraggableElement
                key={child.id}
                element={child}
                selectedId={selectedId}
                multiSelectedIds={multiSelectedIds}
                onSelect={onSelect}
                dragState={dragState}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                isFirst={index === 0}
                isLast={index === (element.children?.length || 0) - 1}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Normal container
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isRow ? 'row' : 'column',
    gap: props.gap || 0,
    padding: props.padding || 0,
    alignItems: props.alignItems || 'stretch',
    justifyContent: props.justifyContent === 'between' ? 'space-between' 
      : props.justifyContent === 'around' ? 'space-around'
      : props.justifyContent === 'evenly' ? 'space-evenly'
      : props.justifyContent || 'flex-start',
    backgroundColor: props.backgroundColor || 'transparent',
    borderRadius: props.borderRadius || 0,
  };

  // Floating positioning
  if (props.displayMode === 'floating') {
    containerStyle.position = props.isSticky ? 'sticky' : 'relative';
    if (props.isSticky) {
      containerStyle.top = props.stickyTop || 0;
    }
    containerStyle.zIndex = props.zIndex || 10;
  }

  return (
    <div 
      className={`min-h-[40px] ${
        !element.children?.length ? 'border-2 border-dashed border-[hsl(var(--muted-foreground)/0.3)] rounded-lg' : ''
      }`}
      style={containerStyle}
    >
      {element.children?.length ? (
        element.children.map((child, index) => (
          <DraggableElement
            key={child.id}
            element={child}
            selectedId={selectedId}
            multiSelectedIds={multiSelectedIds}
            onSelect={onSelect}
            dragState={dragState}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            isFirst={index === 0}
            isLast={index === (element.children?.length || 0) - 1}
          />
        ))
      ) : (
        <div className="flex items-center justify-center h-full text-[hsl(var(--muted-foreground))] text-xs p-4">
          拖放元素到此{isRow ? '列' : '欄'}
        </div>
      )}
    </div>
  );
}

function DividerElement({ props }: { props: DividerProps }) {
  const isHorizontal = props.orientation !== 'vertical';
  
  return (
    <div
      className="bg-[hsl(var(--border))]"
      style={{
        width: isHorizontal ? '100%' : props.thickness || 1,
        height: isHorizontal ? props.thickness || 1 : '100%',
        minHeight: isHorizontal ? undefined : 20,
        borderStyle: props.style || 'solid',
        backgroundColor: props.color || 'hsl(var(--border))',
      }}
    />
  );
}

function SpacerElement({ props }: { props: SpacerProps }) {
  const isVertical = props.direction !== 'horizontal';
  
  return (
    <div
      className="bg-[hsl(var(--muted)/0.3)] rounded border border-dashed border-[hsl(var(--muted-foreground)/0.2)]"
      style={{
        width: isVertical ? '100%' : props.size || 16,
        height: isVertical ? props.size || 16 : '100%',
      }}
    />
  );
}

export default PreviewCanvas;
