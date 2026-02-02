// Layout Region Renderer - Renders and allows editing of a single app layout region
import React, { useState } from 'react';
import { Lock, Plus, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { LayoutRegion, UIElement, ButtonProps, TextProps, IconProps } from '@/types/ui-builder';
import { BUTTON_VARIANT_STYLES } from '@/types/ui-builder';

interface LayoutRegionRendererProps {
  region: LayoutRegion;
  isSelected: boolean;
  selectedElementId: string | null;
  onSelectRegion: (regionId: string) => void;
  onSelectElement: (elementId: string | null, shiftKey?: boolean) => void;
  onUpdateElements: (regionId: string, elements: UIElement[]) => void;
  onElementDoubleClick?: (element: UIElement) => void;
  compact?: boolean;
}

export function LayoutRegionRenderer({
  region,
  isSelected,
  selectedElementId,
  onSelectRegion,
  onSelectElement,
  onUpdateElements,
  onElementDoubleClick,
  compact = false,
}: LayoutRegionRendererProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleRegionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectRegion(region.id);
  };

  const regionClasses = `
    relative rounded-lg transition-all duration-200
    ${isSelected 
      ? 'ring-2 ring-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]' 
      : 'hover:ring-1 hover:ring-[hsl(var(--primary)/0.3)]'
    }
    ${!region.isEditable ? 'opacity-60' : ''}
  `;

  return (
    <div 
      className={regionClasses}
      onClick={handleRegionClick}
    >
      {/* Region Header */}
      <div className={`flex items-center gap-2 px-2 py-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="p-0.5 hover:bg-[hsl(var(--accent))] rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
          )}
        </button>
        
        <span className="font-medium text-[hsl(var(--foreground))]">{region.name}</span>
        
        {!region.isEditable && (
          <Lock className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
        )}
        
        {region.isEditable && isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Add new element to this region
            }}
            className="ml-auto p-1 hover:bg-[hsl(var(--accent))] rounded text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Region Content */}
      {isExpanded && (
        <div 
          className={`px-2 pb-2 ${!region.isEditable ? 'pointer-events-none' : ''}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: region.style?.gap || 4,
          }}
        >
          {region.children.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-xs text-[hsl(var(--muted-foreground))] border border-dashed border-[hsl(var(--border))] rounded">
              {region.isEditable ? '點擊 + 添加元素' : '固定內容區域'}
            </div>
          ) : (
            region.children.map(element => (
              <RegionElementRenderer
                key={element.id}
                element={element}
                isSelected={selectedElementId === element.id}
                onSelect={onSelectElement}
                onDoubleClick={onElementDoubleClick}
                compact={compact}
                isEditable={region.isEditable}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// REGION ELEMENT RENDERER
// =============================================================================

interface RegionElementRendererProps {
  element: UIElement;
  isSelected: boolean;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  onDoubleClick?: (element: UIElement) => void;
  compact?: boolean;
  isEditable?: boolean;
}

function RegionElementRenderer({
  element,
  isSelected,
  onSelect,
  onDoubleClick,
  compact = false,
  isEditable = true,
}: RegionElementRendererProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!isEditable) return;
    e.stopPropagation();
    onSelect(element.id, e.shiftKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.action && onDoubleClick) {
      onDoubleClick(element);
    }
  };

  const hasAction = !!element.action;

  const wrapperClasses = `
    relative rounded transition-all group
    ${isEditable ? 'cursor-pointer' : 'cursor-default'}
    ${isSelected 
      ? 'ring-2 ring-[hsl(var(--primary))] ring-offset-1' 
      : isEditable ? 'hover:ring-1 hover:ring-[hsl(var(--primary)/0.5)]' : ''
    }
  `;

  return (
    <div 
      className={wrapperClasses} 
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {isEditable && isSelected && (
        <div className="absolute -left-5 top-1/2 -translate-y-1/2">
          <GripVertical className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
        </div>
      )}
      <ElementPreview element={element} compact={compact} />
      
      {/* Double-click hint tooltip */}
      {hasAction && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        text-[10px] bg-[hsl(var(--foreground))] text-[hsl(var(--background))] 
                        px-2 py-0.5 rounded whitespace-nowrap pointer-events-none z-10">
          雙擊執行
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ELEMENT PREVIEW (simplified rendering)
// =============================================================================

function ElementPreview({ element, compact }: { element: UIElement; compact?: boolean }) {
  const scale = compact ? 0.8 : 1;

  switch (element.type) {
    case 'button': {
      const props = element.props as ButtonProps;
      const style = BUTTON_VARIANT_STYLES[props.variant || 'primary'];
      const IconComp = props.icon ? (LucideIcons as any)[props.icon] : null;
      
      return (
        <button
          className="px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-1.5"
          style={{
            backgroundColor: style.bg,
            color: style.fg,
            border: style.border ? `1px solid ${style.border}` : 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'left center',
          }}
          disabled
        >
          {IconComp && <IconComp size={14} />}
          {props.label || '按鈕'}
        </button>
      );
    }

    case 'text': {
      const props = element.props as TextProps;
      return (
        <p
          style={{
            fontSize: (props.fontSize || 14) * scale,
            fontWeight: props.fontWeight || 400,
            color: props.color || 'inherit',
          }}
        >
          {props.content || '文字'}
        </p>
      );
    }

    case 'icon': {
      const props = element.props as IconProps;
      const IconComp = (LucideIcons as any)[props.iconName];
      if (!IconComp) {
        return <div className="w-6 h-6 bg-[hsl(var(--muted))] rounded" />;
      }
      return (
        <IconComp
          size={(props.size || 24) * scale}
          color={props.color || 'currentColor'}
        />
      );
    }

    case 'row':
    case 'column': {
      const isRow = element.type === 'row';
      return (
        <div
          className={`p-2 rounded border border-dashed border-[hsl(var(--border))] ${
            isRow ? 'flex flex-row' : 'flex flex-col'
          }`}
          style={{ gap: element.props.gap || 4 }}
        >
          {element.children?.map(child => (
            <ElementPreview key={child.id} element={child} compact />
          ))}
          {(!element.children || element.children.length === 0) && (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              空{isRow ? '列' : '欄'}
            </span>
          )}
        </div>
      );
    }

    case 'divider':
      return <hr className="border-[hsl(var(--border))]" />;

    case 'spacer':
      return (
        <div 
          className="bg-[hsl(var(--muted)/0.3)] rounded"
          style={{ height: element.props.size || 16 }}
        />
      );

    default:
      return (
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          {element.type}
        </div>
      );
  }
}

export default LayoutRegionRenderer;