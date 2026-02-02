// Element Toolbar - Add new UI elements
import React from 'react';
import { 
  Square, 
  Type, 
  Image, 
  Columns, 
  Rows, 
  Minus, 
  MoveHorizontal,
  MousePointer
} from 'lucide-react';
import type { UIElementType, UIElement } from '@/types/ui-builder';

interface ElementToolbarProps {
  onAddElement: (type: UIElementType) => void;
}

interface ToolbarItem {
  type: UIElementType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { 
    type: 'button', 
    label: '按鈕', 
    icon: <Square className="w-5 h-5" />,
    description: '可點擊的按鈕元素'
  },
  { 
    type: 'text', 
    label: '文字', 
    icon: <Type className="w-5 h-5" />,
    description: '文字內容區塊'
  },
  { 
    type: 'icon', 
    label: '圖案', 
    icon: <MousePointer className="w-5 h-5" />,
    description: 'Lucide 圖示'
  },
  { 
    type: 'image', 
    label: '圖像', 
    icon: <Image className="w-5 h-5" />,
    description: '圖片元素'
  },
  { 
    type: 'row', 
    label: '列', 
    icon: <Columns className="w-5 h-5" />,
    description: '水平排列容器'
  },
  { 
    type: 'column', 
    label: '欄', 
    icon: <Rows className="w-5 h-5" />,
    description: '垂直排列容器'
  },
  { 
    type: 'divider', 
    label: '分隔線', 
    icon: <Minus className="w-5 h-5" />,
    description: '視覺分隔元素'
  },
  { 
    type: 'spacer', 
    label: '間距', 
    icon: <MoveHorizontal className="w-5 h-5" />,
    description: '空白間距元素'
  },
];

export function ElementToolbar({ onAddElement }: ElementToolbarProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-sm font-medium text-foreground mb-3">新增元素</h3>
      <div className="grid grid-cols-4 gap-2">
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.type}
            onClick={() => onAddElement(item.type)}
            className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors group"
            title={item.description}
          >
            <span className="text-muted-foreground group-hover:text-accent-foreground transition-colors">
              {item.icon}
            </span>
            <span className="text-xs text-muted-foreground group-hover:text-accent-foreground">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// ELEMENT FACTORY
// =============================================================================

export function createDefaultElement(type: UIElementType, order: number = 0): UIElement {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const defaultProps: Record<UIElementType, Record<string, any>> = {
    button: {
      label: '按鈕',
      variant: 'primary',
      size: 'md',
    },
    text: {
      content: '輸入文字...',
      fontSize: 16,
      fontWeight: 400,
      textAlign: 'left',
      shape: 'none',
      curve: 0,
    },
    icon: {
      iconName: 'Star',
      size: 24,
      strokeWidth: 2,
      color: 'hsl(var(--foreground))',
    },
    image: {
      src: '',
      alt: '圖片',
      objectFit: 'cover',
      width: 200,
      height: 150,
    },
    row: {
      gap: 8,
      alignItems: 'center',
      justifyContent: 'start',
      displayMode: 'normal',
      padding: 8,
    },
    column: {
      gap: 8,
      alignItems: 'stretch',
      justifyContent: 'start',
      displayMode: 'normal',
      padding: 8,
    },
    divider: {
      orientation: 'horizontal',
      thickness: 1,
      style: 'solid',
      color: 'hsl(var(--border))',
    },
    spacer: {
      size: 16,
      direction: 'vertical',
    },
  };

  return {
    id,
    type,
    order,
    props: defaultProps[type],
    children: type === 'row' || type === 'column' ? [] : undefined,
  };
}

export default ElementToolbar;
