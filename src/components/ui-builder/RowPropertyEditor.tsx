// Row/Column Property Editor - Advanced display modes
import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Move, 
  ChevronDown, 
  ChevronsUpDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Pin,
  MousePointer,
  Timer
} from 'lucide-react';
import type { UIElement, DisplayMode, ContainerProps } from '@/types/ui-builder';

interface RowPropertyEditorProps {
  element: UIElement;
  onUpdate: (props: Partial<ContainerProps>) => void;
}

const DISPLAY_MODES: { mode: DisplayMode; label: string; icon: React.ReactNode; description: string }[] = [
  { mode: 'normal', label: '正常', icon: <Eye className="w-4 h-4" />, description: '標準顯示模式' },
  { mode: 'hidden', label: '隱藏', icon: <EyeOff className="w-4 h-4" />, description: '隱藏元素（可條件顯示）' },
  { mode: 'floating', label: '浮動', icon: <Move className="w-4 h-4" />, description: '浮動定位元素' },
  { mode: 'dropdown', label: '下拉', icon: <ChevronDown className="w-4 h-4" />, description: '點擊/懸停展開' },
  { mode: 'collapsible', label: '摺疊', icon: <ChevronsUpDown className="w-4 h-4" />, description: '可展開/收起' },
];

const ANIMATION_SPEEDS = [
  { value: 'fast', label: '快速', duration: '150ms' },
  { value: 'normal', label: '正常', duration: '300ms' },
  { value: 'slow', label: '慢速', duration: '500ms' },
];

export function RowPropertyEditor({ element, onUpdate }: RowPropertyEditorProps) {
  const props = element.props as ContainerProps;
  const displayMode = props.displayMode || 'normal';

  return (
    <div className="space-y-4">
      {/* Display Mode Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">顯示模式</label>
        <div className="grid grid-cols-5 gap-1">
          {DISPLAY_MODES.map(({ mode, label, icon, description }) => (
            <button
              key={mode}
              onClick={() => onUpdate({ displayMode: mode })}
              className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-colors ${
                displayMode === mode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent hover:text-accent-foreground'
              }`}
              title={description}
            >
              {icon}
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode-specific settings */}
      {displayMode === 'hidden' && (
        <HiddenModeSettings props={props} onUpdate={onUpdate} />
      )}
      
      {displayMode === 'floating' && (
        <FloatingModeSettings props={props} onUpdate={onUpdate} />
      )}
      
      {displayMode === 'dropdown' && (
        <DropdownModeSettings props={props} onUpdate={onUpdate} />
      )}
      
      {displayMode === 'collapsible' && (
        <CollapsibleModeSettings props={props} onUpdate={onUpdate} />
      )}

      {/* Common container settings */}
      <ContainerLayoutSettings props={props} onUpdate={onUpdate} />
    </div>
  );
}

// =============================================================================
// HIDDEN MODE SETTINGS
// =============================================================================

function HiddenModeSettings({ 
  props, 
  onUpdate 
}: { 
  props: ContainerProps; 
  onUpdate: (props: Partial<ContainerProps>) => void;
}) {
  return (
    <div className="p-3 bg-muted rounded-lg space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <EyeOff className="w-4 h-4" />
        <span>隱藏設定</span>
      </div>
      
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">條件表達式（選填）</label>
        <input
          type="text"
          value={props.hiddenCondition || ''}
          onChange={(e) => onUpdate({ hiddenCondition: e.target.value })}
          placeholder="例如: isLoggedIn === false"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
        />
        <p className="text-xs text-muted-foreground">
          留空時永久隱藏；設定條件可實現動態顯示
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// FLOATING MODE SETTINGS
// =============================================================================

function FloatingModeSettings({ 
  props, 
  onUpdate 
}: { 
  props: ContainerProps; 
  onUpdate: (props: Partial<ContainerProps>) => void;
}) {
  const floatOffset = props.floatOffset || { x: 0, y: 0 };

  return (
    <div className="p-3 bg-muted rounded-lg space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Move className="w-4 h-4" />
        <span>浮動設定</span>
      </div>
      
      {/* Position */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">浮動位置</label>
        <div className="grid grid-cols-3 gap-1">
          {(['left', 'center', 'right'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => onUpdate({ floatPosition: pos })}
              className={`p-2 text-xs rounded-md border transition-colors ${
                props.floatPosition === pos
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {pos === 'left' ? '左側' : pos === 'center' ? '居中' : '右側'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Offset */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">X 偏移</label>
          <input
            type="number"
            value={floatOffset.x}
            onChange={(e) => onUpdate({ floatOffset: { ...floatOffset, x: parseInt(e.target.value) || 0 } })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Y 偏移</label>
          <input
            type="number"
            value={floatOffset.y}
            onChange={(e) => onUpdate({ floatOffset: { ...floatOffset, y: parseInt(e.target.value) || 0 } })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
      </div>
      
      {/* Sticky */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">固定定位 (Sticky)</span>
        </div>
        <button
          onClick={() => onUpdate({ isSticky: !props.isSticky })}
          className={`w-10 h-6 rounded-full transition-colors ${
            props.isSticky ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
            props.isSticky ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>
      </div>
      
      {props.isSticky && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">頂部距離 (px)</label>
          <input
            type="number"
            value={props.stickyTop || 0}
            onChange={(e) => onUpdate({ stickyTop: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
      )}
      
      {/* Z-Index */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">層級 (z-index)</label>
        <input
          type="number"
          value={props.zIndex || 10}
          onChange={(e) => onUpdate({ zIndex: parseInt(e.target.value) || 10 })}
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
        />
      </div>
    </div>
  );
}

// =============================================================================
// DROPDOWN MODE SETTINGS
// =============================================================================

function DropdownModeSettings({ 
  props, 
  onUpdate 
}: { 
  props: ContainerProps; 
  onUpdate: (props: Partial<ContainerProps>) => void;
}) {
  return (
    <div className="p-3 bg-muted rounded-lg space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ChevronDown className="w-4 h-4" />
        <span>下拉設定</span>
      </div>
      
      {/* Trigger Type */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">觸發方式</label>
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => onUpdate({ dropdownTrigger: 'click' })}
            className={`flex items-center justify-center gap-2 p-2 text-xs rounded-md border transition-colors ${
              props.dropdownTrigger === 'click' || !props.dropdownTrigger
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-accent'
            }`}
          >
            <MousePointer className="w-3 h-3" />
            點擊
          </button>
          <button
            onClick={() => onUpdate({ dropdownTrigger: 'hover' })}
            className={`flex items-center justify-center gap-2 p-2 text-xs rounded-md border transition-colors ${
              props.dropdownTrigger === 'hover'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-accent'
            }`}
          >
            <Move className="w-3 h-3" />
            懸停
          </button>
        </div>
      </div>
      
      {/* Direction */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">展開方向</label>
        <div className="grid grid-cols-4 gap-1">
          {(['down', 'up', 'left', 'right'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => onUpdate({ dropdownDirection: dir })}
              className={`p-2 text-xs rounded-md border transition-colors ${
                props.dropdownDirection === dir || (dir === 'down' && !props.dropdownDirection)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {dir === 'down' ? '下' : dir === 'up' ? '上' : dir === 'left' ? '左' : '右'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Label */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">觸發按鈕文字</label>
        <input
          type="text"
          value={props.dropdownLabel || ''}
          onChange={(e) => onUpdate({ dropdownLabel: e.target.value })}
          placeholder="點擊展開"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
        />
      </div>
      
      {/* Auto Close */}
      <div className="flex items-center justify-between">
        <span className="text-sm">點擊外部自動關閉</span>
        <button
          onClick={() => onUpdate({ autoClose: !props.autoClose })}
          className={`w-10 h-6 rounded-full transition-colors ${
            props.autoClose !== false ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
            props.autoClose !== false ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// COLLAPSIBLE MODE SETTINGS
// =============================================================================

function CollapsibleModeSettings({ 
  props, 
  onUpdate 
}: { 
  props: ContainerProps; 
  onUpdate: (props: Partial<ContainerProps>) => void;
}) {
  return (
    <div className="p-3 bg-muted rounded-lg space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ChevronsUpDown className="w-4 h-4" />
        <span>摺疊設定</span>
      </div>
      
      {/* Default State */}
      <div className="flex items-center justify-between">
        <span className="text-sm">預設收合</span>
        <button
          onClick={() => onUpdate({ defaultCollapsed: !props.defaultCollapsed })}
          className={`w-10 h-6 rounded-full transition-colors ${
            props.defaultCollapsed ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
            props.defaultCollapsed ? 'translate-x-4' : 'translate-x-0'
          }`} />
        </button>
      </div>
      
      {/* Collapse Label */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">標題文字</label>
        <input
          type="text"
          value={props.collapseLabel || ''}
          onChange={(e) => onUpdate({ collapseLabel: e.target.value })}
          placeholder="點擊展開/收合"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
        />
      </div>
      
      {/* Icon Style */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">圖示樣式</label>
        <div className="grid grid-cols-3 gap-1">
          {(['chevron', 'plus', 'arrow'] as const).map((icon) => (
            <button
              key={icon}
              onClick={() => onUpdate({ collapseIcon: icon })}
              className={`p-2 text-xs rounded-md border transition-colors ${
                props.collapseIcon === icon || (icon === 'chevron' && !props.collapseIcon)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {icon === 'chevron' ? '箭頭 ▼' : icon === 'plus' ? '加號 ＋' : '三角 ►'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Animation Speed */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">動畫速度</label>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {ANIMATION_SPEEDS.map(({ value, label, duration }) => (
            <button
              key={value}
              onClick={() => onUpdate({ animationSpeed: value as 'fast' | 'normal' | 'slow' })}
              className={`p-2 text-xs rounded-md border transition-colors ${
                props.animationSpeed === value || (value === 'normal' && !props.animationSpeed)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              <div>{label}</div>
              <div className="text-[10px] opacity-70">{duration}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMMON CONTAINER LAYOUT SETTINGS
// =============================================================================

function ContainerLayoutSettings({ 
  props, 
  onUpdate 
}: { 
  props: ContainerProps; 
  onUpdate: (props: Partial<ContainerProps>) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Gap */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-foreground">間距</label>
          <span className="text-xs text-muted-foreground">{props.gap || 0}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="48"
          step="4"
          value={props.gap || 0}
          onChange={(e) => onUpdate({ gap: parseInt(e.target.value) })}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
      </div>
      
      {/* Padding */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-foreground">內距</label>
          <span className="text-xs text-muted-foreground">{props.padding || 0}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="48"
          step="4"
          value={props.padding || 0}
          onChange={(e) => onUpdate({ padding: parseInt(e.target.value) })}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
      </div>
      
      {/* Align Items */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">交叉軸對齊</label>
        <div className="grid grid-cols-4 gap-1">
          {[
            { value: 'start', icon: <AlignVerticalJustifyStart className="w-4 h-4" />, label: '起始' },
            { value: 'center', icon: <AlignVerticalJustifyCenter className="w-4 h-4" />, label: '居中' },
            { value: 'end', icon: <AlignVerticalJustifyEnd className="w-4 h-4" />, label: '結束' },
            { value: 'stretch', icon: <Columns className="w-4 h-4" />, label: '延展' },
          ].map(({ value, icon, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ alignItems: value as ContainerProps['alignItems'] })}
              className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-colors ${
                props.alignItems === value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
      
      {/* Justify Content */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">主軸對齊</label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { value: 'start', icon: <AlignLeft className="w-4 h-4" />, label: '起始' },
            { value: 'center', icon: <AlignCenter className="w-4 h-4" />, label: '居中' },
            { value: 'end', icon: <AlignRight className="w-4 h-4" />, label: '結束' },
            { value: 'between', label: '兩端' },
            { value: 'around', label: '環繞' },
            { value: 'evenly', label: '平均' },
          ].map(({ value, icon, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ justifyContent: value as ContainerProps['justifyContent'] })}
              className={`flex items-center justify-center gap-1 p-2 text-xs rounded-md border transition-colors ${
                props.justifyContent === value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {icon || label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RowPropertyEditor;
