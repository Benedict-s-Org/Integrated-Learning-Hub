// UI Builder Type Definitions

// =============================================================================
// ELEMENT TYPES
// =============================================================================

export type UIElementType = 
  | 'button' 
  | 'text' 
  | 'icon' 
  | 'row' 
  | 'column' 
  | 'divider' 
  | 'spacer'
  | 'image';

export type DisplayMode = 'normal' | 'hidden' | 'floating' | 'dropdown' | 'collapsible';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'gold';

export type TextShape = 'none' | 'arch-up' | 'arch-down' | 'wave' | 'bridge' | 'valley' | 'circle' | 'square';

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export type AlignItems = 'start' | 'center' | 'end' | 'stretch';

export type JustifyContent = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

// =============================================================================
// ELEMENT PROPS
// =============================================================================

export interface BaseElementProps {
  // Common styling
  color?: string;
  backgroundColor?: string;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  margin?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  opacity?: number;
  
  // Size
  width?: number | 'auto' | 'full';
  height?: number | 'auto';
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface ButtonProps extends BaseElementProps {
  label: string;
  variant: ButtonVariant;
  icon?: string;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export interface TextProps extends BaseElementProps {
  content: string;
  fontSize?: number;
  fontWeight?: FontWeight;
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
  
  // Canva-style text effects
  shape?: TextShape;
  curve?: number; // -100 to 100
  
  // Text shadow
  textShadow?: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
}

export interface IconProps extends BaseElementProps {
  iconName: string;
  size?: number;
  strokeWidth?: number;
}

export interface ContainerProps extends BaseElementProps {
  gap?: number;
  alignItems?: AlignItems;
  justifyContent?: JustifyContent;
  wrap?: boolean;
  
  // Advanced display modes
  displayMode?: DisplayMode;
  
  // Hidden mode
  isHidden?: boolean;
  hiddenCondition?: string;
  
  // Floating mode
  floatPosition?: 'left' | 'right' | 'center';
  floatOffset?: { x: number; y: number };
  isSticky?: boolean;
  stickyTop?: number;
  zIndex?: number;
  
  // Dropdown mode
  dropdownTrigger?: 'click' | 'hover';
  dropdownDirection?: 'down' | 'up' | 'left' | 'right';
  dropdownLabel?: string;
  dropdownIcon?: string;
  autoClose?: boolean;
  
  // Collapsible mode
  defaultCollapsed?: boolean;
  collapseIcon?: 'chevron' | 'plus' | 'arrow';
  collapseLabel?: string;
  animationSpeed?: 'fast' | 'normal' | 'slow';
}

export interface DividerProps extends BaseElementProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface SpacerProps {
  size: number;
  direction?: 'horizontal' | 'vertical';
}

export interface ImageProps extends BaseElementProps {
  src: string;
  alt?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none';
}

export type ElementProps = 
  | ({ type: 'button' } & ButtonProps)
  | ({ type: 'text' } & TextProps)
  | ({ type: 'icon' } & IconProps)
  | ({ type: 'row' } & ContainerProps)
  | ({ type: 'column' } & ContainerProps)
  | ({ type: 'divider' } & DividerProps)
  | ({ type: 'spacer' } & SpacerProps)
  | ({ type: 'image' } & ImageProps);

// =============================================================================
// ELEMENT ACTIONS (for double-click behavior)
// =============================================================================

export type UIElementActionType = 'navigate-tab' | 'trigger-function' | 'toggle-mode' | 'link' | 'edit-text';

export interface UIElementAction {
  type: UIElementActionType;
  target?: string;      // Tab ID, function name, or URL
  payload?: any;        // Additional parameters
}

// =============================================================================
// UI ELEMENT
// =============================================================================

export interface UIElement {
  id: string;
  type: UIElementType;
  props: Record<string, any>;
  children?: UIElement[];
  parentId?: string;
  order: number;
  action?: UIElementAction;  // Double-click action
}

// =============================================================================
// APP LAYOUT CONFIGURATION (for full app interface editor)
// =============================================================================

export type LayoutRegionType = 'container' | 'slot' | 'fixed';

export interface LayoutRegion {
  id: string;
  name: string;
  type: LayoutRegionType;
  isEditable: boolean;
  description?: string;
  children: UIElement[];
  style?: Record<string, any>;
}

export interface AppLayoutConfig {
  id: string;
  name: string;
  description?: string;
  regions: {
    sidebar: SidebarLayoutConfig;
    main: MainAreaLayoutConfig;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface SidebarLayoutConfig {
  header: LayoutRegion;
  tabs: LayoutRegion;
  content: LayoutRegion;
  footer: LayoutRegion;
}

export interface MainAreaLayoutConfig {
  header: LayoutRegion;
  content: LayoutRegion; // Usually fixed (IsometricRoom)
  floatingElements: LayoutRegion;
}

// =============================================================================
// TEMPLATES
// =============================================================================

export interface UITemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  elements: UIElement[];
  createdAt: string;
  updatedAt?: string;
  isPreset?: boolean;
}

// =============================================================================
// ASSETS
// =============================================================================

export type AssetType = 'image' | 'document' | 'data';

export interface DirectionalImages {
  south?: string;
  west?: string;
  north?: string;
  east?: string;
}

export interface ConditionalImages {
  new?: string;
  dusty?: string;
  sealed?: string;
  damaged?: string;
}

export interface SpriteSheet {
  url: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns?: number;
}

export interface ImageAsset {
  id: string;
  name: string;
  type: 'single' | 'directional' | 'conditional' | 'sprite-sheet';
  url?: string;
  directionalImages?: DirectionalImages;
  conditionalImages?: ConditionalImages;
  spriteSheet?: SpriteSheet;
  tags?: string[];
  createdAt: string;
}

export interface ParsedDocument {
  id: string;
  fileName: string;
  fileType: 'txt' | 'md' | 'docx' | 'pdf';
  fileSize: number;
  text?: string;
  html?: string;
  pages?: number;
  parsedAt: string;
}

export interface DataAsset {
  id: string;
  fileName: string;
  fileType: 'json' | 'csv';
  data: Record<string, any>[];
  columns?: string[];
  rowCount: number;
  parsedAt: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  image?: ImageAsset;
  document?: ParsedDocument;
  data?: DataAsset;
  linkedAssets?: string[];
  createdAt: string;
}

// =============================================================================
// BUILDER STATE
// =============================================================================

export interface UIBuilderState {
  elements: UIElement[];
  selectedId: string | null;
  multiSelectedIds: string[];
  clipboard: UIElement | null;
  history: UIElement[][];
  historyIndex: number;
  templates: UITemplate[];
  assets: Asset[];
}

// =============================================================================
// PRESET TEMPLATES
// =============================================================================

export const PRESET_TEMPLATES: UITemplate[] = [
  {
    id: 'nav-buttons',
    name: '導航按鈕組',
    description: '4個水平排列的導航按鈕',
    category: '導航',
    isPreset: true,
    createdAt: new Date().toISOString(),
    elements: [
      {
        id: 'nav-row',
        type: 'row',
        order: 0,
        props: { gap: 8, alignItems: 'center', justifyContent: 'center' },
        children: [
          { id: 'btn-1', type: 'button', order: 0, props: { label: '首頁', variant: 'primary' } },
          { id: 'btn-2', type: 'button', order: 1, props: { label: '關於', variant: 'secondary' } },
          { id: 'btn-3', type: 'button', order: 2, props: { label: '服務', variant: 'secondary' } },
          { id: 'btn-4', type: 'button', order: 3, props: { label: '聯絡', variant: 'ghost' } },
        ]
      }
    ]
  },
  {
    id: 'confirm-dialog',
    name: '確認對話框按鈕',
    description: '取消與確認按鈕組合',
    category: '對話框',
    isPreset: true,
    createdAt: new Date().toISOString(),
    elements: [
      {
        id: 'dialog-row',
        type: 'row',
        order: 0,
        props: { gap: 12, alignItems: 'center', justifyContent: 'end' },
        children: [
          { id: 'cancel-btn', type: 'button', order: 0, props: { label: '取消', variant: 'ghost' } },
          { id: 'confirm-btn', type: 'button', order: 1, props: { label: '確認', variant: 'primary' } },
        ]
      }
    ]
  },
  {
    id: 'feature-card',
    name: '功能卡片',
    description: '圖示、標題、說明與按鈕的組合',
    category: '卡片',
    isPreset: true,
    createdAt: new Date().toISOString(),
    elements: [
      {
        id: 'card-col',
        type: 'column',
        order: 0,
        props: { gap: 12, alignItems: 'center', padding: 24, backgroundColor: 'hsl(var(--card))' },
        children: [
          { id: 'card-icon', type: 'icon', order: 0, props: { iconName: 'Star', size: 48, color: 'hsl(var(--primary))' } },
          { id: 'card-title', type: 'text', order: 1, props: { content: '功能標題', fontSize: 20, fontWeight: 600 } },
          { id: 'card-desc', type: 'text', order: 2, props: { content: '這是功能的簡短說明文字', fontSize: 14, color: 'hsl(var(--muted-foreground))' } },
          { id: 'card-btn', type: 'button', order: 3, props: { label: '了解更多', variant: 'primary' } },
        ]
      }
    ]
  },
  {
    id: 'info-bar',
    name: '資訊列',
    description: '圖示、文字與操作按鈕的橫向排列',
    category: '資訊',
    isPreset: true,
    createdAt: new Date().toISOString(),
    elements: [
      {
        id: 'info-row',
        type: 'row',
        order: 0,
        props: { gap: 12, alignItems: 'center', justifyContent: 'between', padding: 12, backgroundColor: 'hsl(var(--muted))' },
        children: [
          {
            id: 'info-left',
            type: 'row',
            order: 0,
            props: { gap: 8, alignItems: 'center' },
            children: [
              { id: 'info-icon', type: 'icon', order: 0, props: { iconName: 'Info', size: 20 } },
              { id: 'info-text', type: 'text', order: 1, props: { content: '這是一條重要資訊', fontSize: 14 } },
            ]
          },
          { id: 'info-btn', type: 'button', order: 1, props: { label: '操作', variant: 'secondary', size: 'sm' } },
        ]
      }
    ]
  }
];

// =============================================================================
// TEXT SHAPE PATHS
// =============================================================================

export const TEXT_SHAPE_CONFIGS: Record<TextShape, { name: string; icon: string }> = {
  'none': { name: '無', icon: 'Type' },
  'arch-up': { name: '上弧', icon: 'ArrowUpFromLine' },
  'arch-down': { name: '下弧', icon: 'ArrowDownFromLine' },
  'wave': { name: '波浪', icon: 'Waves' },
  'bridge': { name: '橋型', icon: 'Spline' },
  'valley': { name: 'V型', icon: 'ChevronDown' },
  'circle': { name: '圓形', icon: 'Circle' },
  'square': { name: '方形', icon: 'Square' },
};

// =============================================================================
// BUTTON VARIANT STYLES
// =============================================================================

export const BUTTON_VARIANT_STYLES: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: 'hsl(var(--primary))', fg: 'hsl(var(--primary-foreground))' },
  secondary: { bg: 'hsl(var(--secondary))', fg: 'hsl(var(--secondary-foreground))' },
  success: { bg: 'hsl(140 60% 45%)', fg: 'hsl(0 0% 100%)' },
  danger: { bg: 'hsl(var(--destructive))', fg: 'hsl(var(--destructive-foreground))' },
  ghost: { bg: 'transparent', fg: 'hsl(var(--foreground))', border: 'hsl(var(--border))' },
  gold: { bg: 'hsl(45 90% 50%)', fg: 'hsl(30 50% 15%)' },
};