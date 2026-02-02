// Main Canvas - Full-width editing and preview area with App Layout mode
import React, { useState, useCallback, useRef } from 'react';
import { Plus, GripVertical, ChevronDown, ChevronRight, EyeOff, Minus, LayoutTemplate, Layers } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { UIElement, ContainerProps, ButtonProps, TextProps, IconProps, DividerProps, SpacerProps, AppLayoutConfig } from '@/types/ui-builder';
import { CurvedTextRenderer } from './CurvedTextRenderer';
import { BUTTON_VARIANT_STYLES } from '@/types/ui-builder';
import { AppLayoutCanvas } from './AppLayoutCanvas';
import { DEFAULT_APP_LAYOUT } from '@/constants/defaultAppLayout';

interface MainCanvasProps {
  elements: UIElement[];
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  onReorder: (dragId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
}

type DropPosition = 'before' | 'after' | 'inside' | null;
type CanvasMode = 'elements' | 'app-layout';

interface DragState {
  dragId: string | null;
  targetId: string | null;
  position: DropPosition;
}

export function MainCanvas({
  elements,
  selectedId,
  multiSelectedIds,
  onSelect,
  onReorder,
}: MainCanvasProps) {
  const [dragState, setDragState] = useState<DragState>({ dragId: null, targetId: null, position: null });
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('app-layout');
  const [appLayout, setAppLayout] = useState<AppLayoutConfig>(DEFAULT_APP_LAYOUT);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

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

  const handleUpdateRegion = useCallback((regionId: string, newElements: UIElement[]) => {
    setAppLayout(prev => {
      const updated = { ...prev };
      // Find and update the region by ID
      const [area, section] = regionId.split('-').slice(0, 2);
      if (area === 'sidebar') {
        const key = section as keyof typeof updated.regions.sidebar;
        if (updated.regions.sidebar[key]) {
          updated.regions.sidebar[key] = {
            ...updated.regions.sidebar[key],
            children: newElements,
          };
        }
      } else if (area === 'main') {
        const key = section as keyof typeof updated.regions.main;
        if (updated.regions.main[key]) {
          updated.regions.main[key] = {
            ...updated.regions.main[key],
            children: newElements,
          };
        }
      }
      return updated;
    });
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted)/0.2)] border-b border-[hsl(var(--border))]">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">編輯模式:</span>
        <div className="flex rounded-lg overflow-hidden border border-[hsl(var(--border))]">
          <button
            onClick={() => setCanvasMode('app-layout')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              canvasMode === 'app-layout'
                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            應用佈局
          </button>
          <button
            onClick={() => setCanvasMode('elements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              canvasMode === 'elements'
                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                : 'bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            元素編輯
          </button>
        </div>
      </div>

      {/* Canvas Content */}
      {canvasMode === 'app-layout' ? (
        <AppLayoutCanvas
          layout={appLayout}
          selectedRegionId={selectedRegionId}
          selectedElementId={selectedId}
          onSelectRegion={setSelectedRegionId}
          onSelectElement={onSelect}
          onUpdateRegion={handleUpdateRegion}
        />
      ) : (
        <div 
          className="flex-1 overflow-auto p-6 bg-[hsl(var(--background))]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onSelect(null);
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDragEnd}
        >
          <div className="min-h-full max-w-4xl mx-auto">
            {elements.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-[hsl(var(--muted-foreground))] border-2 border-dashed border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--muted)/0.1)]">
                <Plus className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">尚無元素</p>
                <p className="text-sm opacity-70">使用頂部工具列的「新增元素」開始建構介面</p>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] min-h-96">
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
      )}
    </div>
  );
}

// =============================================================================
// DRAGGABLE ELEMENT
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
        <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-[hsl(var(--primary))] rounded-full z-10 animate-pulse" />
      )}

      <div
        ref={ref}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`${wrapperClasses} cursor-grab active:cursor-grabbing rounded-lg`}
        onClick={handleClick}
      >
        {/* Drag handle */}
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity p-1">
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
        <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-[hsl(var(--primary))] rounded-full z-10 animate-pulse" />
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

  if (props.displayMode === 'hidden') {
    return (
      <div className="border-2 border-dashed border-[hsl(var(--muted-foreground)/0.3)] rounded-lg p-4 opacity-50">
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

  if (props.displayMode === 'floating') {
    containerStyle.position = props.isSticky ? 'sticky' : 'relative';
    if (props.isSticky) {
      containerStyle.top = props.stickyTop || 0;
    }
    containerStyle.zIndex = props.zIndex || 10;
  }

  return (
    <div 
      className={`min-h-[40px] rounded-lg ${
        !element.children?.length ? 'border-2 border-dashed border-[hsl(var(--muted-foreground)/0.3)]' : ''
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
        <div className="flex items-center justify-center h-10 text-xs text-[hsl(var(--muted-foreground))]">
          空{isRow ? '列' : '欄'} - 拖曳元素到此處
        </div>
      )}
    </div>
  );
}

function DividerElement({ props }: { props: DividerProps }) {
  const isVertical = props.orientation === 'vertical';
  
  return (
    <div 
      className={`bg-[hsl(var(--border))] ${isVertical ? 'w-px h-full min-h-[20px]' : 'h-px w-full'}`}
      style={{
        [isVertical ? 'width' : 'height']: props.thickness || 1,
        borderStyle: props.style || 'solid',
      }}
    />
  );
}

function SpacerElement({ props }: { props: SpacerProps }) {
  const isVertical = props.direction !== 'horizontal';
  
  return (
    <div 
      className="bg-[hsl(var(--muted)/0.3)] rounded transition-colors hover:bg-[hsl(var(--muted)/0.5)]"
      style={{
        [isVertical ? 'height' : 'width']: props.size || 16,
        [isVertical ? 'width' : 'height']: '100%',
        minHeight: isVertical ? props.size || 16 : 4,
        minWidth: isVertical ? 4 : props.size || 16,
      }}
    />
  );
}