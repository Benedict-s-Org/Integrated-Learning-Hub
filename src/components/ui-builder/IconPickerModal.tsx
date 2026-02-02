// Icon Picker Modal - Browse and select from 1000+ Lucide icons
import React, { useState, useMemo, useCallback } from 'react';
import { X, Search, Check } from 'lucide-react';
import { icons, type LucideIcon } from 'lucide-react';

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconName: string) => void;
  currentIcon?: string;
}

// Icon categories for filtering
const ICON_CATEGORIES: Record<string, string[]> = {
  '常用': [
    'Home', 'Search', 'Settings', 'User', 'Heart', 'Star', 'Plus', 'Minus', 'Check', 'X',
    'ChevronLeft', 'ChevronRight', 'ChevronUp', 'ChevronDown', 'ArrowLeft', 'ArrowRight',
    'Menu', 'MoreHorizontal', 'MoreVertical', 'Edit', 'Trash2', 'Copy', 'Save', 'Download',
    'Upload', 'Share', 'Link', 'ExternalLink', 'Eye', 'EyeOff', 'Lock', 'Unlock',
  ],
  '箭頭': [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUpRight', 'ArrowUpLeft',
    'ArrowDownRight', 'ArrowDownLeft', 'MoveUp', 'MoveDown', 'MoveLeft', 'MoveRight',
    'ChevronUp', 'ChevronDown', 'ChevronLeft', 'ChevronRight', 'ChevronsUp', 'ChevronsDown',
    'CornerUpLeft', 'CornerUpRight', 'CornerDownLeft', 'CornerDownRight', 'Undo', 'Redo',
  ],
  '媒體': [
    'Play', 'Pause', 'Stop', 'SkipBack', 'SkipForward', 'Rewind', 'FastForward',
    'Volume', 'Volume1', 'Volume2', 'VolumeX', 'Music', 'Mic', 'MicOff', 'Video',
    'VideoOff', 'Camera', 'Image', 'Film', 'Tv', 'Radio', 'Headphones', 'Speaker',
  ],
  '通訊': [
    'Mail', 'MessageSquare', 'MessageCircle', 'Send', 'Inbox', 'Phone', 'PhoneCall',
    'PhoneOff', 'Bell', 'BellOff', 'AtSign', 'Hash', 'Podcast', 'Rss', 'Wifi', 'WifiOff',
  ],
  '使用者': [
    'User', 'Users', 'UserPlus', 'UserMinus', 'UserCheck', 'UserX', 'Contact', 'CircleUser',
    'UserCircle', 'UserCog', 'UserSquare', 'BadgeCheck', 'Crown', 'Shield', 'ShieldCheck',
  ],
  '檔案': [
    'File', 'FileText', 'FilePlus', 'FileMinus', 'FileCheck', 'FileX', 'FileSearch',
    'Folder', 'FolderOpen', 'FolderPlus', 'FolderMinus', 'Archive', 'Paperclip', 'Clipboard',
  ],
  '編輯': [
    'Edit', 'Edit2', 'Edit3', 'Pencil', 'PenTool', 'Eraser', 'Highlighter', 'Type',
    'Bold', 'Italic', 'Underline', 'Strikethrough', 'AlignLeft', 'AlignCenter', 'AlignRight',
    'List', 'ListOrdered', 'Indent', 'Outdent', 'Quote', 'Code', 'Terminal',
  ],
  '介面': [
    'Layout', 'LayoutGrid', 'LayoutList', 'Grid', 'Columns', 'Rows', 'Sidebar', 'PanelLeft',
    'PanelRight', 'Maximize', 'Minimize', 'Expand', 'Shrink', 'Move', 'GripVertical',
    'GripHorizontal', 'Separator', 'SplitSquare', 'Layers', 'Component', 'Box', 'Square',
  ],
  '圖表': [
    'BarChart', 'BarChart2', 'BarChart3', 'LineChart', 'PieChart', 'Activity', 'TrendingUp',
    'TrendingDown', 'Percent', 'Target', 'Gauge', 'Signal', 'Sliders', 'Settings2',
  ],
  '時間': [
    'Clock', 'Timer', 'TimerOff', 'Hourglass', 'Calendar', 'CalendarDays', 'CalendarCheck',
    'CalendarPlus', 'CalendarMinus', 'CalendarX', 'AlarmClock', 'Watch', 'History', 'Stopwatch',
  ],
  '地圖': [
    'Map', 'MapPin', 'Navigation', 'Compass', 'Globe', 'Globe2', 'Locate', 'LocateFixed',
    'LocateOff', 'Route', 'Signpost', 'Milestone', 'Mountain', 'Building', 'Building2',
  ],
  '天氣': [
    'Sun', 'Moon', 'Cloud', 'CloudRain', 'CloudSnow', 'CloudLightning', 'CloudSun',
    'Sunrise', 'Sunset', 'Wind', 'Snowflake', 'Thermometer', 'Umbrella', 'Rainbow',
  ],
  '購物': [
    'ShoppingCart', 'ShoppingBag', 'Package', 'Gift', 'CreditCard', 'Wallet', 'Banknote',
    'DollarSign', 'Euro', 'Coins', 'Receipt', 'Tag', 'Tags', 'Barcode', 'Store', 'Truck',
  ],
  '工具': [
    'Wrench', 'Hammer', 'Screwdriver', 'Settings', 'Cog', 'Tool', 'Zap', 'Lightbulb',
    'Key', 'Scissors', 'Ruler', 'Pipette', 'Palette', 'Brush', 'Paintbrush', 'Stamp',
  ],
  '形狀': [
    'Circle', 'Square', 'Triangle', 'Pentagon', 'Hexagon', 'Octagon', 'Diamond', 'Heart',
    'Star', 'Sparkle', 'Sparkles', 'Flower', 'Flower2', 'Shapes', 'Puzzle',
  ],
  '狀態': [
    'Check', 'CheckCircle', 'CheckSquare', 'X', 'XCircle', 'XSquare', 'AlertCircle',
    'AlertTriangle', 'Info', 'HelpCircle', 'Ban', 'Slash', 'Loader', 'Loader2', 'RefreshCw',
  ],
};

// Get all icon names from lucide-react
const ALL_ICON_NAMES = Object.keys(icons).filter(
  key => key !== 'createLucideIcon' && key !== 'icons' && typeof (icons as any)[key] === 'function'
);

export function IconPickerModal({
  isOpen,
  onClose,
  onSelect,
  currentIcon,
}: IconPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState(48);

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    let iconList: string[];

    if (selectedCategory && ICON_CATEGORIES[selectedCategory]) {
      iconList = ICON_CATEGORIES[selectedCategory].filter(name => 
        ALL_ICON_NAMES.includes(name)
      );
    } else {
      iconList = ALL_ICON_NAMES;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      iconList = iconList.filter(name => 
        name.toLowerCase().includes(query)
      );
    }

    return iconList.slice(0, 200); // Limit for performance
  }, [searchQuery, selectedCategory]);

  const handleSelect = useCallback((iconName: string) => {
    onSelect(iconName);
    onClose();
  }, [onSelect, onClose]);

  const renderIcon = useCallback((iconName: string, size: number = 20) => {
    const IconComponent = (icons as Record<string, LucideIcon>)[iconName];
    if (!IconComponent) return null;
    return <IconComponent size={size} />;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-xl shadow-2xl w-[90vw] max-w-[900px] h-[80vh] max-h-[700px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
            選擇圖示
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[hsl(var(--border))]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋圖示名稱 (例如: heart, star, arrow)..."
              className="w-full pl-10 pr-4 py-2.5 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-lg text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Categories Sidebar */}
          <div className="w-36 border-r border-[hsl(var(--border))] overflow-y-auto p-2 bg-[hsl(var(--muted)/0.3)]">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedCategory === null
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
              }`}
            >
              全部 ({ALL_ICON_NAMES.length})
            </button>
            {Object.entries(ICON_CATEGORIES).map(([category, categoryIcons]) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedCategory === category
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
                }`}
              >
                {category} ({categoryIcons.filter(n => ALL_ICON_NAMES.includes(n)).length})
              </button>
            ))}
          </div>

          {/* Icons Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredIcons.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[hsl(var(--muted-foreground))]">
                <Search className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">找不到符合的圖示</p>
              </div>
            ) : (
              <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1">
                {filteredIcons.map((iconName) => (
                  <button
                    key={iconName}
                    onClick={() => handleSelect(iconName)}
                    onMouseEnter={() => setPreviewIcon(iconName)}
                    onMouseLeave={() => setPreviewIcon(null)}
                    className={`relative p-3 rounded-lg transition-all hover:bg-[hsl(var(--accent))] hover:scale-110 ${
                      currentIcon === iconName
                        ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] ring-2 ring-[hsl(var(--primary))]'
                        : 'text-[hsl(var(--foreground))]'
                    }`}
                    title={iconName}
                  >
                    {renderIcon(iconName)}
                    {currentIcon === iconName && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-[hsl(var(--primary-foreground))]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {filteredIcons.length === 200 && (
              <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-4 py-2">
                顯示前 200 個結果，請使用搜尋縮小範圍
              </p>
            )}
          </div>

          {/* Preview Panel */}
          <div className="w-48 border-l border-[hsl(var(--border))] p-4 bg-[hsl(var(--muted)/0.3)] flex flex-col">
            <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase mb-3">
              即時預覽
            </h3>
            
            <div className="flex-1 flex flex-col items-center justify-center bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg p-4">
              {previewIcon || currentIcon ? (
                <>
                  <div className="mb-3">
                    {renderIcon(previewIcon || currentIcon || '', previewSize)}
                  </div>
                  <p className="text-xs text-[hsl(var(--foreground))] font-mono text-center break-all">
                    {previewIcon || currentIcon}
                  </p>
                </>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                  移動滑鼠到圖示上預覽
                </p>
              )}
            </div>

            {/* Size slider */}
            <div className="mt-4">
              <label className="text-xs text-[hsl(var(--muted-foreground))]">
                預覽尺寸: {previewSize}px
              </label>
              <input
                type="range"
                min="16"
                max="96"
                value={previewSize}
                onChange={(e) => setPreviewSize(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>

            {/* Quick sizes */}
            <div className="mt-3 grid grid-cols-4 gap-1">
              {[16, 24, 32, 48].map((size) => (
                <button
                  key={size}
                  onClick={() => setPreviewSize(size)}
                  className={`px-2 py-1 text-xs rounded ${
                    previewSize === size
                      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                      : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {filteredIcons.length} 個圖示
            {currentIcon && ` · 已選擇: ${currentIcon}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              取消
            </button>
            {currentIcon && (
              <button
                onClick={() => handleSelect(currentIcon)}
                className="px-4 py-2 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--primary)/0.9)] transition-colors"
              >
                確認選擇
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IconPickerModal;
