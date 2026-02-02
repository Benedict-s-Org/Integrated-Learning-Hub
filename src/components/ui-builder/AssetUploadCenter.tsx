// Asset Upload Center - Multi-format file management
import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  Image, 
  FileText, 
  Database, 
  X, 
  Check,
  File,
  Folder,
  Grid,
  List,
  Search,
  Trash2,
  Eye,
  Link2,
  Download
} from 'lucide-react';
import { parseDocument, getFileCategory, formatFileSize, getSupportedExtensions } from '@/utils/documentParser';
import type { 
  Asset, 
  ImageAsset, 
  ParsedDocument, 
  DataAsset,
  DirectionalImages,
  ConditionalImages 
} from '@/types/ui-builder';

interface AssetUploadCenterProps {
  assets: Asset[];
  onAddAsset: (asset: Asset) => void;
  onRemoveAsset: (id: string) => void;
  onLinkAssets: (sourceId: string, targetId: string) => void;
}

type TabType = 'images' | 'documents' | 'data';
type ViewMode = 'grid' | 'list';
type ImageUploadType = 'single' | 'directional' | 'conditional';

export function AssetUploadCenter({ 
  assets, 
  onAddAsset, 
  onRemoveAsset,
  onLinkAssets 
}: AssetUploadCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>('images');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageUploadType, setImageUploadType] = useState<ImageUploadType>('single');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Filter assets by tab and search
  const filteredAssets = assets.filter(asset => {
    const matchesTab = activeTab === 'images' ? asset.type === 'image' 
      : activeTab === 'documents' ? asset.type === 'document'
      : asset.type === 'data';
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(files)) {
        const category = getFileCategory(file.name);
        
        if (category === 'image') {
          // Create image asset
          const url = URL.createObjectURL(file);
          const imageAsset: ImageAsset = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: 'single',
            url,
            createdAt: new Date().toISOString(),
          };
          
          onAddAsset({
            id: imageAsset.id,
            name: file.name,
            type: 'image',
            image: imageAsset,
            createdAt: imageAsset.createdAt,
          });
        } else if (category === 'document') {
          // Parse document
          const parsed = await parseDocument(file);
          const docAsset: ParsedDocument = {
            id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: file.name,
            fileType: file.name.split('.').pop()?.toLowerCase() as any,
            fileSize: file.size,
            text: parsed.text,
            html: parsed.html,
            pages: parsed.pages,
            parsedAt: new Date().toISOString(),
          };
          
          onAddAsset({
            id: docAsset.id,
            name: file.name,
            type: 'document',
            document: docAsset,
            createdAt: docAsset.parsedAt,
          });
        } else if (category === 'data') {
          // Parse data file
          const parsed = await parseDocument(file);
          const dataAsset: DataAsset = {
            id: `data-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: file.name,
            fileType: file.name.split('.').pop()?.toLowerCase() as any,
            data: parsed.data || [],
            columns: parsed.columns,
            rowCount: parsed.data?.length || 0,
            parsedAt: new Date().toISOString(),
          };
          
          onAddAsset({
            id: dataAsset.id,
            name: file.name,
            type: 'data',
            data: dataAsset,
            createdAt: dataAsset.parsedAt,
          });
        } else {
          setUploadError(`不支援的檔案格式: ${file.name}`);
        }
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上傳失敗');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  }, [onAddAsset]);

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-lg font-medium text-foreground">資源上傳中心</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {([
          { key: 'images', label: '圖像資源', icon: <Image className="w-4 h-4" /> },
          { key: 'documents', label: '文件資料', icon: <FileText className="w-4 h-4" /> },
          { key: 'data', label: '資料檔案', icon: <Database className="w-4 h-4" /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Search & Upload */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋資源..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <label className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors">
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">上傳</span>
          <input
            type="file"
            multiple
            accept={getSupportedExtensions().map(ext => `.${ext}`).join(',')}
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Image Upload Type Selector (only for images tab) */}
      {activeTab === 'images' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50">
          <span className="text-xs text-muted-foreground">圖組類型:</span>
          {([
            { type: 'single', label: '單張' },
            { type: 'directional', label: '方向圖組' },
            { type: 'conditional', label: '狀態圖組' },
          ] as const).map(({ type, label }) => (
            <button
              key={type}
              onClick={() => setImageUploadType(type)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                imageUploadType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive text-sm">
          <X className="w-4 h-4" />
          {uploadError}
          <button onClick={() => setUploadError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {isUploading && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 text-primary text-sm">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          上傳中...
        </div>
      )}

      {/* Asset Grid/List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Folder className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">沒有找到資源</p>
            <p className="text-xs">上傳檔案以開始使用</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4">
            {filteredAssets.map((asset) => (
              <AssetGridItem 
                key={asset.id} 
                asset={asset} 
                onRemove={() => onRemoveAsset(asset.id)}
                onSelect={() => setSelectedAsset(asset)}
                isSelected={selectedAsset?.id === asset.id}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssets.map((asset) => (
              <AssetListItem 
                key={asset.id} 
                asset={asset} 
                onRemove={() => onRemoveAsset(asset.id)}
                onSelect={() => setSelectedAsset(asset)}
                isSelected={selectedAsset?.id === asset.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected Asset Detail */}
      {selectedAsset && (
        <AssetDetailPanel 
          asset={selectedAsset} 
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// ASSET GRID ITEM
// =============================================================================

function AssetGridItem({ 
  asset, 
  onRemove, 
  onSelect,
  isSelected 
}: { 
  asset: Asset; 
  onRemove: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <div 
      className={`relative group rounded-lg border overflow-hidden cursor-pointer transition-all ${
        isSelected 
          ? 'border-primary ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/50'
      }`}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-muted flex items-center justify-center">
        {asset.type === 'image' && asset.image?.url ? (
          <img 
            src={asset.image.url} 
            alt={asset.name} 
            className="w-full h-full object-cover"
          />
        ) : asset.type === 'document' ? (
          <FileText className="w-8 h-8 text-muted-foreground" />
        ) : (
          <Database className="w-8 h-8 text-muted-foreground" />
        )}
      </div>
      
      {/* Name */}
      <div className="p-2">
        <p className="text-xs text-foreground truncate">{asset.name}</p>
        <p className="text-xs text-muted-foreground">
          {asset.type === 'document' && asset.document 
            ? formatFileSize(asset.document.fileSize)
            : asset.type === 'data' && asset.data
            ? `${asset.data.rowCount} 筆資料`
            : '圖像'}
        </p>
      </div>
      
      {/* Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 bg-destructive text-destructive-foreground rounded-md"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// ASSET LIST ITEM
// =============================================================================

function AssetListItem({ 
  asset, 
  onRemove, 
  onSelect,
  isSelected 
}: { 
  asset: Asset; 
  onRemove: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        {asset.type === 'image' && asset.image?.url ? (
          <img 
            src={asset.image.url} 
            alt={asset.name} 
            className="w-full h-full object-cover rounded-lg"
          />
        ) : asset.type === 'document' ? (
          <FileText className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Database className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{asset.name}</p>
        <p className="text-xs text-muted-foreground">
          {asset.type === 'document' && asset.document 
            ? `${asset.document.fileType.toUpperCase()} · ${formatFileSize(asset.document.fileSize)}`
            : asset.type === 'data' && asset.data
            ? `${asset.data.fileType.toUpperCase()} · ${asset.data.rowCount} 筆`
            : asset.image?.type === 'directional' ? '方向圖組' : '圖像'}
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1">
        <button 
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// ASSET DETAIL PANEL
// =============================================================================

function AssetDetailPanel({ 
  asset, 
  onClose 
}: { 
  asset: Asset; 
  onClose: () => void;
}) {
  return (
    <div className="border-t border-border p-4 bg-muted/30 max-h-[200px] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-foreground">{asset.name}</h4>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {asset.type === 'image' && asset.image?.url && (
        <div className="flex gap-4">
          <img 
            src={asset.image.url} 
            alt={asset.name} 
            className="w-24 h-24 object-cover rounded-lg"
          />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>類型: {asset.image.type === 'directional' ? '方向圖組' : asset.image.type === 'conditional' ? '狀態圖組' : '單張'}</p>
            <p>建立時間: {new Date(asset.createdAt).toLocaleString()}</p>
          </div>
        </div>
      )}
      
      {asset.type === 'document' && asset.document && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>格式: {asset.document.fileType.toUpperCase()}</p>
            <p>大小: {formatFileSize(asset.document.fileSize)}</p>
            {asset.document.pages && <p>頁數: {asset.document.pages}</p>}
          </div>
          {asset.document.text && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">內容預覽:</p>
              <div className="p-2 bg-background rounded text-xs text-foreground max-h-[80px] overflow-y-auto">
                {asset.document.text.substring(0, 500)}...
              </div>
            </div>
          )}
        </div>
      )}
      
      {asset.type === 'data' && asset.data && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>格式: {asset.data.fileType.toUpperCase()}</p>
            <p>資料筆數: {asset.data.rowCount}</p>
            {asset.data.columns && <p>欄位: {asset.data.columns.join(', ')}</p>}
          </div>
          {asset.data.data.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">資料預覽:</p>
              <div className="p-2 bg-background rounded text-xs text-foreground max-h-[80px] overflow-y-auto">
                <pre>{JSON.stringify(asset.data.data.slice(0, 3), null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AssetUploadCenter;
