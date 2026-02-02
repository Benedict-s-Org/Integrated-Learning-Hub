// Property Panel - Edit selected element properties
import React, { useState } from 'react';
import { Trash2, Copy, Palette, Type, Layout, Settings, Grid, Ungroup } from 'lucide-react';
import type { UIElement, ButtonProps, TextProps, IconProps, ContainerProps, DividerProps, SpacerProps, ImageProps } from '@/types/ui-builder';
import { RowPropertyEditor } from './RowPropertyEditor';
import { TextStyleEditor } from './TextStyleEditor';
import { IconPickerModal } from './IconPickerModal';
import { BUTTON_VARIANT_STYLES } from '@/types/ui-builder';

interface PropertyPanelProps {
  element: UIElement | null;
  onUpdate: (id: string, props: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUngroup?: (id: string) => void;
}

export function PropertyPanel({ element, onUpdate, onDelete, onDuplicate, onUngroup }: PropertyPanelProps) {
  if (!element) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--muted-foreground))] p-4">
        <Settings className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm text-center">選擇一個元素以編輯其屬性</p>
        <p className="text-xs text-center mt-2 opacity-60">
          提示：按住 Shift 點擊可多選元素
        </p>
      </div>
    );
  }

  const handleUpdate = (props: Record<string, any>) => {
    onUpdate(element.id, { ...element.props, ...props });
  };

  const isContainer = element.type === 'row' || element.type === 'column';
  const hasChildren = element.children && element.children.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
        <div>
          <h3 className="text-sm font-medium text-[hsl(var(--foreground))] capitalize">
            {getElementTypeName(element.type)}
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{element.id.substring(0, 12)}...</p>
        </div>
        <div className="flex items-center gap-1">
          {onUngroup && isContainer && hasChildren && (
            <button
              onClick={() => onUngroup(element.id)}
              className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors"
              title="解除群組"
            >
              <Ungroup className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDuplicate(element.id)}
            className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors"
            title="複製元素"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(element.id)}
            className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] rounded-md transition-colors"
            title="刪除元素"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {renderPropertyEditor(element, handleUpdate)}
      </div>
    </div>
  );
}

function getElementTypeName(type: string): string {
  const names: Record<string, string> = {
    button: '按鈕',
    text: '文字',
    icon: '圖示',
    image: '圖像',
    row: '列容器',
    column: '欄容器',
    divider: '分隔線',
    spacer: '間距',
  };
  return names[type] || type;
}

function renderPropertyEditor(element: UIElement, onUpdate: (props: Record<string, any>) => void) {
  switch (element.type) {
    case 'button':
      return <ButtonPropertyEditor props={element.props as ButtonProps} onUpdate={onUpdate} />;
    case 'text':
      return <TextStyleEditor element={element} onUpdate={onUpdate} />;
    case 'icon':
      return <IconPropertyEditor props={element.props as IconProps} onUpdate={onUpdate} />;
    case 'image':
      return <ImagePropertyEditor props={element.props as ImageProps} onUpdate={onUpdate} />;
    case 'row':
    case 'column':
      return <RowPropertyEditor element={element} onUpdate={onUpdate} />;
    case 'divider':
      return <DividerPropertyEditor props={element.props as DividerProps} onUpdate={onUpdate} />;
    case 'spacer':
      return <SpacerPropertyEditor props={element.props as SpacerProps} onUpdate={onUpdate} />;
    default:
      return <p className="text-sm text-muted-foreground">此元素類型不支援編輯</p>;
  }
}

// =============================================================================
// BUTTON PROPERTY EDITOR
// =============================================================================

function ButtonPropertyEditor({ 
  props, 
  onUpdate 
}: { 
  props: ButtonProps; 
  onUpdate: (props: Partial<ButtonProps>) => void;
}) {
  const variants = Object.keys(BUTTON_VARIANT_STYLES) as (keyof typeof BUTTON_VARIANT_STYLES)[];

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">按鈕文字</label>
        <input
          type="text"
          value={props.label || ''}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          placeholder="按鈕"
        />
      </div>

      {/* Variant */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">按鈕樣式</label>
        <div className="grid grid-cols-3 gap-2">
          {variants.map((variant) => (
            <button
              key={variant}
              onClick={() => onUpdate({ variant })}
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                props.variant === variant
                  ? 'ring-2 ring-primary ring-offset-1'
                  : 'hover:bg-accent'
              }`}
              style={{
                backgroundColor: BUTTON_VARIANT_STYLES[variant].bg,
                color: BUTTON_VARIANT_STYLES[variant].fg,
                border: BUTTON_VARIANT_STYLES[variant].border 
                  ? `1px solid ${BUTTON_VARIANT_STYLES[variant].border}` 
                  : '1px solid transparent',
              }}
            >
              {variant}
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">大小</label>
        <div className="grid grid-cols-3 gap-2">
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <button
              key={size}
              onClick={() => onUpdate({ size })}
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                props.size === size || (size === 'md' && !props.size)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {size === 'sm' ? '小' : size === 'md' ? '中' : '大'}
            </button>
          ))}
        </div>
      </div>

      {/* Icon */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">圖示（選填）</label>
        <input
          type="text"
          value={props.icon || ''}
          onChange={(e) => onUpdate({ icon: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          placeholder="Lucide 圖示名稱，如 Star"
        />
        {props.icon && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">位置:</span>
            {(['left', 'right'] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => onUpdate({ iconPosition: pos })}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  props.iconPosition === pos || (pos === 'left' && !props.iconPosition)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {pos === 'left' ? '左側' : '右側'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Disabled */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">禁用狀態</label>
        <button
          onClick={() => onUpdate({ disabled: !props.disabled })}
          className={`w-10 h-6 rounded-full transition-colors ${
            props.disabled ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
            props.disabled ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// ICON PROPERTY EDITOR
// =============================================================================

function IconPropertyEditor({ 
  props, 
  onUpdate 
}: { 
  props: IconProps; 
  onUpdate: (props: Partial<IconProps>) => void;
}) {
  const [showIconPicker, setShowIconPicker] = useState(false);

  return (
    <div className="space-y-4">
      {/* Icon Name with Picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[hsl(var(--foreground))]">圖示名稱</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={props.iconName || ''}
            onChange={(e) => onUpdate({ iconName: e.target.value })}
            className="flex-1 px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md"
            placeholder="Star, Heart, Home..."
          />
          <button
            onClick={() => setShowIconPicker(true)}
            className="px-3 py-2 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--primary)/0.9)] transition-colors flex items-center gap-1"
          >
            <Grid className="w-4 h-4" />
            選擇
          </button>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">大小</label>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{props.size || 24}px</span>
        </div>
        <input
          type="range"
          min="12"
          max="96"
          step="4"
          value={props.size || 24}
          onChange={(e) => onUpdate({ size: parseInt(e.target.value) })}
          className="w-full h-2 bg-[hsl(var(--muted))] rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Stroke Width */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-[hsl(var(--foreground))]">線條粗細</label>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{props.strokeWidth || 2}</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="4"
          step="0.5"
          value={props.strokeWidth || 2}
          onChange={(e) => onUpdate({ strokeWidth: parseFloat(e.target.value) })}
          className="w-full h-2 bg-[hsl(var(--muted))] rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Color */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[hsl(var(--foreground))]">顏色</label>
        <input
          type="text"
          value={props.color || ''}
          onChange={(e) => onUpdate({ color: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-md"
          placeholder="hsl(var(--foreground)) 或 #000000"
        />
      </div>

      {/* Icon Picker Modal */}
      <IconPickerModal
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={(iconName) => onUpdate({ iconName })}
        currentIcon={props.iconName}
      />
    </div>
  );
}

// =============================================================================
// IMAGE PROPERTY EDITOR
// =============================================================================

function ImagePropertyEditor({ 
  props, 
  onUpdate 
}: { 
  props: ImageProps; 
  onUpdate: (props: Partial<ImageProps>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Source URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">圖片網址</label>
        <input
          type="text"
          value={props.src || ''}
          onChange={(e) => onUpdate({ src: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          placeholder="https://..."
        />
      </div>

      {/* Alt Text */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">替代文字</label>
        <input
          type="text"
          value={props.alt || ''}
          onChange={(e) => onUpdate({ alt: e.target.value })}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          placeholder="圖片描述"
        />
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">寬度</label>
          <input
            type="number"
            value={props.width || 200}
            onChange={(e) => onUpdate({ width: parseInt(e.target.value) || 200 })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">高度</label>
          <input
            type="number"
            value={props.height || 150}
            onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 150 })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
      </div>

      {/* Object Fit */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">縮放方式</label>
        <div className="grid grid-cols-2 gap-2">
          {(['contain', 'cover', 'fill', 'none'] as const).map((fit) => (
            <button
              key={fit}
              onClick={() => onUpdate({ objectFit: fit })}
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                props.objectFit === fit || (fit === 'cover' && !props.objectFit)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {fit}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DIVIDER PROPERTY EDITOR
// =============================================================================

function DividerPropertyEditor({ 
  props, 
  onUpdate 
}: { 
  props: DividerProps; 
  onUpdate: (props: Partial<DividerProps>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Orientation */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">方向</label>
        <div className="grid grid-cols-2 gap-2">
          {(['horizontal', 'vertical'] as const).map((orientation) => (
            <button
              key={orientation}
              onClick={() => onUpdate({ orientation })}
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                props.orientation === orientation || (orientation === 'horizontal' && !props.orientation)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {orientation === 'horizontal' ? '水平' : '垂直'}
            </button>
          ))}
        </div>
      </div>

      {/* Thickness */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-foreground">粗細</label>
          <span className="text-xs text-muted-foreground">{props.thickness || 1}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="8"
          step="1"
          value={props.thickness || 1}
          onChange={(e) => onUpdate({ thickness: parseInt(e.target.value) })}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Style */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">樣式</label>
        <div className="grid grid-cols-3 gap-2">
          {(['solid', 'dashed', 'dotted'] as const).map((style) => (
            <button
              key={style}
              onClick={() => onUpdate({ style })}
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                props.style === style || (style === 'solid' && !props.style)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {style === 'solid' ? '實線' : style === 'dashed' ? '虛線' : '點線'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SPACER PROPERTY EDITOR
// =============================================================================

function SpacerPropertyEditor({ 
  props, 
  onUpdate 
}: { 
  props: SpacerProps; 
  onUpdate: (props: Partial<SpacerProps>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Size */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-foreground">間距大小</label>
          <span className="text-xs text-muted-foreground">{props.size || 16}px</span>
        </div>
        <input
          type="range"
          min="4"
          max="128"
          step="4"
          value={props.size || 16}
          onChange={(e) => onUpdate({ size: parseInt(e.target.value) })}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Direction */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">方向</label>
        <div className="grid grid-cols-2 gap-2">
          {(['vertical', 'horizontal'] as const).map((direction) => (
            <button
              key={direction}
              onClick={() => onUpdate({ direction })}
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                props.direction === direction || (direction === 'vertical' && !props.direction)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {direction === 'vertical' ? '垂直' : '水平'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PropertyPanel;
