// Text Style Editor - Canva-style text manipulation
import React, { useState, useMemo } from 'react';
import { 
  Type, 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CaseSensitive,
  CaseUpper,
  CaseLower,
  Sparkles
} from 'lucide-react';
import type { UIElement, TextProps, TextShape, FontWeight, TEXT_SHAPE_CONFIGS } from '@/types/ui-builder';
import { CurvedTextRenderer } from './CurvedTextRenderer';

interface TextStyleEditorProps {
  element: UIElement;
  onUpdate: (props: Partial<TextProps>) => void;
}

const FONT_WEIGHTS: { value: FontWeight; label: string }[] = [
  { value: 100, label: '極細' },
  { value: 200, label: '超細' },
  { value: 300, label: '細體' },
  { value: 400, label: '正常' },
  { value: 500, label: '中等' },
  { value: 600, label: '半粗' },
  { value: 700, label: '粗體' },
  { value: 800, label: '超粗' },
  { value: 900, label: '極粗' },
];

const TEXT_SHAPES: { shape: TextShape; label: string; preview: string }[] = [
  { shape: 'none', label: '無', preview: '—' },
  { shape: 'arch-up', label: '上弧', preview: '⌒' },
  { shape: 'arch-down', label: '下弧', preview: '⌣' },
  { shape: 'wave', label: '波浪', preview: '∿' },
  { shape: 'bridge', label: '橋型', preview: '⌓' },
  { shape: 'valley', label: 'V型', preview: '∨' },
  { shape: 'circle', label: '圓形', preview: '○' },
  { shape: 'square', label: '方形', preview: '□' },
];

const PRESET_STYLES = [
  { name: '標題', props: { fontSize: 32, fontWeight: 700 as FontWeight, shape: 'none' as TextShape, curve: 0 } },
  { name: '副標題', props: { fontSize: 20, fontWeight: 500 as FontWeight, shape: 'none' as TextShape, curve: 0 } },
  { name: '弧形標語', props: { fontSize: 24, fontWeight: 600 as FontWeight, shape: 'arch-up' as TextShape, curve: 50 } },
  { name: '波浪文字', props: { fontSize: 18, fontWeight: 400 as FontWeight, shape: 'wave' as TextShape, curve: 30 } },
  { name: '徽章文字', props: { fontSize: 14, fontWeight: 700 as FontWeight, shape: 'circle' as TextShape, curve: 80 } },
];

export function TextStyleEditor({ element, onUpdate }: TextStyleEditorProps) {
  const props = element.props as TextProps;
  const [showShadowSettings, setShowShadowSettings] = useState(props.textShadow?.enabled || false);

  return (
    <div className="space-y-4">
      {/* Content */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">文字內容</label>
        <textarea
          value={props.content || ''}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="輸入文字..."
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none"
          rows={3}
        />
      </div>

      {/* Preset Styles */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">快速樣式</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_STYLES.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onUpdate(preset.props)}
              className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-accent transition-colors"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size & Weight */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-foreground">字體大小</label>
            <span className="text-xs text-muted-foreground">{props.fontSize || 16}px</span>
          </div>
          <input
            type="range"
            min="8"
            max="72"
            step="1"
            value={props.fontSize || 16}
            onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">粗細 (Thickness)</label>
          <select
            value={props.fontWeight || 400}
            onChange={(e) => onUpdate({ fontWeight: parseInt(e.target.value) as FontWeight })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md"
          >
            {FONT_WEIGHTS.map(({ value, label }) => (
              <option key={value} value={value}>{label} ({value})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Text Shape (Canva-style) */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">形狀 (Shape)</label>
        <div className="grid grid-cols-4 gap-2">
          {TEXT_SHAPES.map(({ shape, label, preview }) => (
            <button
              key={shape}
              onClick={() => onUpdate({ shape })}
              className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-colors ${
                props.shape === shape || (shape === 'none' && !props.shape)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              <span className="text-lg">{preview}</span>
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Curve Intensity */}
      {props.shape && props.shape !== 'none' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-foreground">弧度 (Curve)</label>
            <span className="text-xs text-muted-foreground">{props.curve || 0}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            step="5"
            value={props.curve || 0}
            onChange={(e) => onUpdate({ curve: parseInt(e.target.value) })}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>-100 (反向)</span>
            <span>0</span>
            <span>100 (正向)</span>
          </div>
        </div>
      )}

      {/* Letter Spacing */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-foreground">字距</label>
          <span className="text-xs text-muted-foreground">{props.letterSpacing || 0}px</span>
        </div>
        <input
          type="range"
          min="-5"
          max="20"
          step="0.5"
          value={props.letterSpacing || 0}
          onChange={(e) => onUpdate({ letterSpacing: parseFloat(e.target.value) })}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Line Height */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-foreground">行高</label>
          <span className="text-xs text-muted-foreground">{props.lineHeight || 1.5}</span>
        </div>
        <input
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={props.lineHeight || 1.5}
          onChange={(e) => onUpdate({ lineHeight: parseFloat(e.target.value) })}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Text Align */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">對齊方式</label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { value: 'left', icon: <AlignLeft className="w-4 h-4" /> },
            { value: 'center', icon: <AlignCenter className="w-4 h-4" /> },
            { value: 'right', icon: <AlignRight className="w-4 h-4" /> },
          ].map(({ value, icon }) => (
            <button
              key={value}
              onClick={() => onUpdate({ textAlign: value as 'left' | 'center' | 'right' })}
              className={`flex items-center justify-center p-2 rounded-md border transition-colors ${
                props.textAlign === value || (value === 'left' && !props.textAlign)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Text Transform */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">大小寫轉換</label>
        <div className="grid grid-cols-4 gap-1">
          {[
            { value: 'none', icon: <Type className="w-4 h-4" />, label: '原始' },
            { value: 'uppercase', icon: <CaseUpper className="w-4 h-4" />, label: '大寫' },
            { value: 'lowercase', icon: <CaseLower className="w-4 h-4" />, label: '小寫' },
            { value: 'capitalize', icon: <CaseSensitive className="w-4 h-4" />, label: '首字大寫' },
          ].map(({ value, icon, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ textTransform: value as TextProps['textTransform'] })}
              className={`flex flex-col items-center gap-1 p-2 rounded-md border transition-colors ${
                props.textTransform === value || (value === 'none' && !props.textTransform)
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

      {/* Text Decoration */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">文字裝飾</label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { value: 'none', icon: <Type className="w-4 h-4" />, label: '無' },
            { value: 'underline', icon: <Underline className="w-4 h-4" />, label: '底線' },
            { value: 'line-through', icon: <Strikethrough className="w-4 h-4" />, label: '刪除線' },
          ].map(({ value, icon, label }) => (
            <button
              key={value}
              onClick={() => onUpdate({ textDecoration: value as TextProps['textDecoration'] })}
              className={`flex items-center justify-center gap-1 p-2 rounded-md border transition-colors ${
                props.textDecoration === value || (value === 'none' && !props.textDecoration)
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

      {/* Text Shadow */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            文字陰影
          </label>
          <button
            onClick={() => {
              setShowShadowSettings(!showShadowSettings);
              onUpdate({
                textShadow: {
                  enabled: !showShadowSettings,
                  offsetX: props.textShadow?.offsetX || 2,
                  offsetY: props.textShadow?.offsetY || 2,
                  blur: props.textShadow?.blur || 4,
                  color: props.textShadow?.color || 'rgba(0,0,0,0.3)',
                }
              });
            }}
            className={`w-10 h-6 rounded-full transition-colors ${
              showShadowSettings ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform mx-1 ${
              showShadowSettings ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </button>
        </div>
        
        {showShadowSettings && (
          <div className="p-3 bg-muted rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">X 偏移</label>
                <input
                  type="number"
                  value={props.textShadow?.offsetX || 2}
                  onChange={(e) => onUpdate({
                    textShadow: {
                      ...props.textShadow!,
                      offsetX: parseInt(e.target.value) || 0,
                    }
                  })}
                  className="w-full px-2 py-1 text-sm bg-background border border-border rounded"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Y 偏移</label>
                <input
                  type="number"
                  value={props.textShadow?.offsetY || 2}
                  onChange={(e) => onUpdate({
                    textShadow: {
                      ...props.textShadow!,
                      offsetY: parseInt(e.target.value) || 0,
                    }
                  })}
                  className="w-full px-2 py-1 text-sm bg-background border border-border rounded"
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-muted-foreground">模糊程度</label>
                <span className="text-xs text-muted-foreground">{props.textShadow?.blur || 4}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={props.textShadow?.blur || 4}
                onChange={(e) => onUpdate({
                  textShadow: {
                    ...props.textShadow!,
                    blur: parseInt(e.target.value),
                  }
                })}
                className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      {props.shape && props.shape !== 'none' ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">效果預覽</label>
          <div className="p-4 bg-muted rounded-lg min-h-[100px] flex items-center justify-center overflow-hidden">
            <CurvedTextRenderer
              text={props.content || '預覽文字'}
              shape={props.shape}
              curve={props.curve || 0}
              fontSize={props.fontSize || 16}
              fontWeight={props.fontWeight || 400}
              color={props.color || 'hsl(var(--foreground))'}
              letterSpacing={props.letterSpacing || 0}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">效果預覽</label>
          <div 
            className="p-4 bg-muted rounded-lg min-h-[60px] flex items-center justify-center"
            style={{
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
            }}
          >
            {props.content || '預覽文字'}
          </div>
        </div>
      )}
    </div>
  );
}

export default TextStyleEditor;
