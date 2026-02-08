// Asset Upload Center - Multi-format file management
import React, { useState, useCallback } from 'react';
import {
  Upload,
  Image,
  FileText,
  Database,
  X,
  Folder,
  Grid,
  List,
  Search,
  Trash2,
  Eye,
  Cloud,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { parseDocument, getFileCategory, formatFileSize, getSupportedExtensions } from '@/utils/documentParser';
import type {
  Asset,
} from '@/types/ui-builder';
import { ASSET_CONTEXTS, ASSET_CATEGORIES, AssetContext } from '@/constants/assetCategories';
import { updateAssetCategorization } from '@/utils/assetPersistence';
import { Button } from '@/components/ui/Button';

interface AssetUploadCenterProps {
  assets: Asset[];
  onAddAsset: (asset: Asset) => void;
  onRemoveAsset: (id: string) => void;
}

type MainTab = 'upload' | 'library';
type FileTypeTab = 'images' | 'documents' | 'data';
type ViewMode = 'grid' | 'list';
type ImageUploadType = 'single' | 'directional' | 'conditional';

export function AssetUploadCenter({
  assets,
  onAddAsset,
  onRemoveAsset,
}: AssetUploadCenterProps) {
  const [mainTab, setMainTab] = useState<MainTab>('upload');

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden">
      {/* Main Tab Navigation */}
      <div className="flex border-b border-border bg-muted/30">
        <button
          onClick={() => setMainTab('upload')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${mainTab === 'upload'
              ? 'bg-background border-t-2 border-t-primary text-primary shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
        >
          <Cloud className="w-4 h-4" />
          上傳資源
        </button>
        <button
          onClick={() => setMainTab('library')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-all ${mainTab === 'library'
              ? 'bg-background border-t-2 border-t-primary text-primary shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
        >
          <Folder className="w-4 h-4" />
          資源庫
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {mainTab === 'upload' ? (
          <UploadTab onAddAsset={onAddAsset} />
        ) : (
          <LibraryTab assets={assets} onRemoveAsset={onRemoveAsset} onUpdateAsset={onAddAsset} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// UPLOAD TAB
// =============================================================================

function UploadTab({ onAddAsset }: { onAddAsset: (asset: Asset) => void }) {
  const [uploadContext, setUploadContext] = useState<AssetContext>('general');
  const [uploadCategory, setUploadCategory] = useState<string>('general');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const { uploadAssetPersistently } = await import('@/utils/assetPersistence');
      const { compressImage } = await import('@/utils/imageOptimizer');

      let successCount = 0;

      for (const file of Array.from(files)) {
        const category = getFileCategory(file.name);

        if (category === 'image') {
          // Compress image before upload
          const compressedFile = await compressImage(file, {
            maxWidth: 1600,
            maxHeight: 1200,
            quality: 0.85
          });

          const asset = await uploadAssetPersistently(compressedFile, 'image', {
            category: uploadCategory,
            context: uploadContext
          });
          if (asset) {
            onAddAsset(asset);
            successCount++;
          }
        } else if (category === 'document') {
          // Parse document for metadata
          const parsed = await parseDocument(file);
          const metadata = {
            text: parsed.text,
            html: parsed.html,
            pages: parsed.pages,
            category: uploadCategory,
            context: uploadContext
          };

          const asset = await uploadAssetPersistently(file, 'document', metadata);
          if (asset) {
            onAddAsset(asset);
            successCount++;
          }
        } else if (category === 'data') {
          // Parse data file for metadata
          const parsed = await parseDocument(file);
          const metadata = {
            data: parsed.data || [],
            columns: parsed.columns,
            rowCount: parsed.data?.length || 0,
            category: uploadCategory,
            context: uploadContext
          };

          const asset = await uploadAssetPersistently(file, 'data', metadata);
          if (asset) {
            onAddAsset(asset);
            successCount++;
          }
        } else {
          throw new Error(`不支援的檔案格式: ${file.name}`);
        }
      }

      setUploadStatus({ type: 'success', message: `成功上傳 ${successCount} 個檔案` });
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus({ type: 'error', message: error instanceof Error ? error.message : '上傳失敗' });
    } finally {
      setIsUploading(false);
    }
  }, [onAddAsset, uploadCategory, uploadContext]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Step 1: Categorization */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-lg font-bold text-foreground">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">1</div>
            <h3>選擇分類</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-11">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-muted-foreground">使用場景 (Context)</label>
              <select
                value={uploadContext}
                onChange={(e) => {
                  const ctx = e.target.value as AssetContext;
                  setUploadContext(ctx);
                  setUploadCategory(ASSET_CATEGORIES[ctx][0].id);
                }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {ASSET_CONTEXTS.map(ctx => (
                  <option key={ctx.id} value={ctx.id}>{ctx.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-muted-foreground">資源分類 (Category)</label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {ASSET_CATEGORIES[uploadContext].map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Upload Area */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-lg font-bold text-foreground">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">2</div>
            <h3>上傳檔案</h3>
          </div>

          <div
            className={`pl-11 relative transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <label
              className={`
                flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                ${dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/5 hover:bg-muted/10 hover:border-primary/50'}
              `}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Cloud className={`w-8 h-8 ${dragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <p className="mb-2 text-sm text-foreground font-medium">
                  <span className="font-bold text-primary">點擊上傳</span> 或將檔案拖曳至此
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  支援 JPG, PNG, GIF, PDF, CSV, JSON 等多種格式
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                multiple
                accept={getSupportedExtensions().map(ext => `.${ext}`).join(',')}
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </label>
          </div>
        </div>

        {/* Status Message */}
        {uploadStatus && (
          <div className={`
            mx-11 p-4 rounded-lg flex items-center gap-3
            ${uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}
          `}>
            {uploadStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">{uploadStatus.message}</span>
            <button onClick={() => setUploadStatus(null)} className="ml-auto p-1 hover:bg-black/5 rounded-full">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isUploading && (
          <div className="mx-11 flex items-center gap-3 text-primary p-4 bg-primary/5 rounded-lg border border-primary/10">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">正在處理您的檔案...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// LIBRARY TAB
// =============================================================================

function LibraryTab({
  assets,
  onRemoveAsset,
  onUpdateAsset
}: {
  assets: Asset[],
  onRemoveAsset: (id: string) => void,
  onUpdateAsset: (asset: Asset) => void
}) {
  const [activeTypeTab, setActiveTypeTab] = useState<FileTypeTab>('images');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Filter assets by tab and search
  const filteredAssets = assets.filter(asset => {
    const matchesTab = activeTypeTab === 'images' ? asset.type === 'image'
      : activeTypeTab === 'documents' ? asset.type === 'document'
        : asset.type === 'data';
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleUpdateAssetMetadata = async (assetId: string, category: string, context: string) => {
    const updated = await updateAssetCategorization(assetId, category, context);
    if (updated) {
      onUpdateAsset(updated);
      setSelectedAsset(updated);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Sub-header Controls */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="flex items-center justify-between">

          {/* File Type Tabs */}
          <div className="flex p-1 bg-muted rounded-lg">
            {([
              { key: 'images', label: '圖像', icon: <Image className="w-4 h-4" /> },
              { key: 'documents', label: '文件', icon: <FileText className="w-4 h-4" /> },
              { key: 'data', label: '資料', icon: <Database className="w-4 h-4" /> },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTypeTab(key)}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${activeTypeTab === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-background/50'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:bg-background/50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`搜尋${activeTypeTab === 'images' ? '圖像' : activeTypeTab === 'documents' ? '文件' : '資料'}...`}
            className="w-full pl-10 pr-4 py-2 text-sm bg-muted/20 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
      </div>

      {/* Asset Grid/List */}
      <div className="flex-1 overflow-y-auto p-4 bg-muted/5">
        {filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
            <Folder className="w-16 h-16 mb-4 opacity-50 stroke-1" />
            <p className="text-lg font-medium">沒有找到資源</p>
            <p className="text-sm">切換到「上傳資源」分頁來新增檔案</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
          onUpdateCategorization={handleUpdateAssetMetadata}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB COMPONENTS (Reused)
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
      className={`relative group rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 ${isSelected
        ? 'border-primary ring-2 ring-primary/20 shadow-lg'
        : 'border-border bg-card hover:border-primary/50 hover:shadow-md'
        }`}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-muted/20 flex items-center justify-center overflow-hidden">
        {asset.type === 'image' && asset.image?.url ? (
          <img
            src={asset.image.url}
            alt={asset.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : asset.type === 'document' ? (
          <FileText className="w-10 h-10 text-muted-foreground/50" />
        ) : (
          <Database className="w-10 h-10 text-muted-foreground/50" />
        )}
      </div>

      {/* Name */}
      <div className="p-3">
        <p className="text-xs font-semibold text-foreground truncate">{asset.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-[10px] text-muted-foreground">
            {asset.type === 'document' && asset.document
              ? formatFileSize(asset.document.fileSize)
              : asset.type === 'data' && asset.data
                ? `${asset.data.rowCount} 筆資料`
                : '圖像'}
          </p>
          <span className="text-[9px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">
            {asset.context}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 shadow-sm"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

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
      className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all ${isSelected
        ? 'border-primary bg-primary/5 shadow-sm'
        : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
        }`}
      onClick={onSelect}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0 overflow-hidden border border-border/50">
        {asset.type === 'image' && asset.image?.url ? (
          <img
            src={asset.image.url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : asset.type === 'document' ? (
          <FileText className="w-6 h-6 text-muted-foreground/60" />
        ) : (
          <Database className="w-6 h-6 text-muted-foreground/60" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{asset.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
            {asset.context}
          </span>
          <p className="text-xs text-muted-foreground">
            {asset.type === 'document' && asset.document
              ? `${asset.document.fileType.toUpperCase()} · ${formatFileSize(asset.document.fileSize)}`
              : asset.type === 'data' && asset.data
                ? `${asset.data.fileType.toUpperCase()} · ${asset.data.rowCount} 筆`
                : asset.image?.type === 'directional' ? '方向圖組' : '圖像'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function AssetDetailPanel({
  asset,
  onClose,
  onUpdateCategorization
}: {
  asset: Asset;
  onClose: () => void;
  onUpdateCategorization: (id: string, cat: string, ctx: string) => void;
}) {
  return (
    <div className="border-t border-border p-4 bg-background max-h-[250px] overflow-y-auto animate-in slide-in-from-bottom-2">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-base font-bold text-foreground">{asset.name}</h4>
          <p className="text-xs text-muted-foreground">{new Date(asset.createdAt).toLocaleString()}</p>
        </div>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-6">
        <div className="shrink-0">
          {asset.type === 'image' && asset.image?.url ? (
            <img
              src={asset.image.url}
              alt={asset.name}
              className="w-32 h-32 object-cover rounded-xl border border-border bg-muted/20 shadow-sm"
            />
          ) : (
            <div className="w-32 h-32 rounded-xl border border-border bg-muted/20 flex items-center justify-center">
              {asset.type === 'document' ? <FileText className="w-12 h-12 text-muted-foreground/30" /> : <Database className="w-12 h-12 text-muted-foreground/30" />}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          {/* Categorization Edit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">使用場景</label>
              <select
                value={asset.context || 'general'}
                onChange={(e) => onUpdateCategorization(asset.id, asset.category || 'general', e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none"
              >
                {ASSET_CONTEXTS.map(ctx => (
                  <option key={ctx.id} value={ctx.id}>{ctx.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">分類</label>
              <select
                value={asset.category || 'general'}
                onChange={(e) => onUpdateCategorization(asset.id, e.target.value, asset.context || 'general')}
                className="w-full bg-muted/30 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-primary outline-none"
              >
                {(ASSET_CATEGORIES[(asset.context as AssetContext) || 'general'] || []).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Metadata Display */}
          <div className="p-3 bg-muted/20 rounded-lg border border-border/50 text-sm">
            {asset.type === 'document' && asset.document && (
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-muted-foreground">格式:</span> <span className="font-medium">{asset.document.fileType.toUpperCase()}</span>
                <span className="text-muted-foreground">大小:</span> <span className="font-medium">{formatFileSize(asset.document.fileSize)}</span>
                {asset.document.pages && <><span className="text-muted-foreground">頁數:</span> <span className="font-medium">{asset.document.pages}</span></>}
              </div>
            )}
            {asset.type === 'data' && asset.data && (
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-muted-foreground">格式:</span> <span className="font-medium">{asset.data.fileType.toUpperCase()}</span>
                <span className="text-muted-foreground">筆數:</span> <span className="font-medium">{asset.data.rowCount}</span>
              </div>
            )}
            {asset.type === 'image' && (
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-muted-foreground">類型:</span> <span className="font-medium">圖像</span>
                <span className="text-muted-foreground">URL:</span> <span className="font-medium truncate max-w-[150px]">{asset.image?.url}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssetUploadCenter;
