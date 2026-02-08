import { useState, useEffect } from 'react';
import {
    Search,
    X,
    Grid,
    List as ListIcon,
    Filter,
    CheckCircle2,
    Image as ImageIcon,
    Loader2
} from 'lucide-react';
import { fetchUIBuilderAssets } from '@/utils/assetPersistence';
import { ASSET_CONTEXTS, ASSET_CATEGORIES, AssetContext } from '@/constants/assetCategories';
import type { Asset } from '@/types/ui-builder';

interface AssetPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (asset: Asset) => void;
    initialContext?: AssetContext;
    allowedTypes?: ('image' | 'document' | 'data')[];
    title?: string;
}

export function AssetPicker({
    isOpen,
    onClose,
    onSelect,
    initialContext = 'general',
    allowedTypes = ['image'],
    title = "選擇資源"
}: AssetPickerProps) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContext, setSelectedContext] = useState<AssetContext>(initialContext);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        if (isOpen) {
            loadAssets();
        }
    }, [isOpen]);

    const loadAssets = async () => {
        setIsLoading(true);
        const data = await fetchUIBuilderAssets();
        setAssets(data);
        setIsLoading(false);
    };

    if (!isOpen) return null;

    const filteredAssets = assets.filter(asset => {
        const matchesType = allowedTypes.includes(asset.type);
        const matchesContext = selectedContext === 'general' || asset.context === selectedContext;
        const matchesCategory = selectedCategory === 'all' || asset.category === selectedCategory;
        const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesType && matchesContext && matchesCategory && matchesSearch;
    });

    const categories = selectedContext === 'general'
        ? []
        : ASSET_CATEGORIES[selectedContext] || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border w-full max-w-4xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Filters Bar */}
                <div className="p-4 border-b border-border flex flex-wrap items-center gap-4 bg-background">
                    {/* Context Selector */}
                    <div className="flex bg-muted p-1 rounded-lg">
                        {ASSET_CONTEXTS.map(ctx => (
                            <button
                                key={ctx.id}
                                onClick={() => {
                                    setSelectedContext(ctx.id);
                                    setSelectedCategory('all');
                                }}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${selectedContext === ctx.id
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {ctx.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="搜尋資源名稱..."
                            className="w-full pl-10 pr-4 py-2 text-sm bg-muted border-none rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-muted p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Sub-categories (Categories) */}
                {categories.length > 0 && (
                    <div className="px-4 py-3 border-b border-border bg-muted/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap border transition-all ${selectedCategory === 'all'
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                                }`}
                        >
                            全部
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-3 py-1 text-xs rounded-full whitespace-nowrap border transition-all ${selectedCategory === cat.id
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground font-medium">載入中...</p>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
                            <ImageIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">沒有找到資源</p>
                            <p className="text-sm">試試看不同的關鍵字或分類</p>
                        </div>
                    ) : (
                        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4' : 'space-y-2'}>
                            {filteredAssets.map(asset => (
                                <AssetItem
                                    key={asset.id}
                                    asset={asset}
                                    viewMode={viewMode}
                                    onSelect={() => {
                                        onSelect(asset);
                                        onClose();
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                        共 {filteredAssets.length} 個資源
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}

function AssetItem({ asset, viewMode, onSelect }: { asset: Asset; viewMode: 'grid' | 'list'; onSelect: () => void }) {
    const isImage = asset.type === 'image';
    const url = asset.image?.url;

    if (viewMode === 'list') {
        return (
            <div
                onClick={onSelect}
                className="flex items-center gap-3 p-3 bg-card border border-border hover:border-primary/50 hover:bg-primary/5 rounded-xl cursor-pointer transition-all group"
            >
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {isImage && url ? (
                        <img src={url} alt={asset.name} className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{asset.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground/60 px-1.5 py-0.5 bg-muted rounded">
                            {asset.context}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                            {asset.category}
                        </span>
                    </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        );
    }

    return (
        <div
            onClick={onSelect}
            className="flex flex-col bg-card border border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 rounded-xl cursor-pointer transition-all group overflow-hidden"
        >
            <div className="aspect-square bg-muted relative overflow-hidden">
                {isImage && url ? (
                    <img src={url} alt={asset.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                )}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-black tracking-wider text-primary-foreground bg-primary px-1.5 py-0.5 rounded shadow-sm">
                        {asset.context}
                    </span>
                </div>
            </div>
            <div className="p-3">
                <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{asset.name}</p>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                    {asset.category}
                </p>
            </div>
        </div>
    );
}
