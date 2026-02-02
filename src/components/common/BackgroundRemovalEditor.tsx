import React, { useState, useEffect, useCallback } from 'react';
import { X, Wand2, RotateCcw, Check, Loader2 } from 'lucide-react';
import { removeWhiteBackground } from '@/utils/imageProcessing';

interface BackgroundRemovalEditorProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (processedDataUrl: string) => void;
}

export const BackgroundRemovalEditor: React.FC<BackgroundRemovalEditorProps> = ({
  imageUrl,
  isOpen,
  onClose,
  onApply,
}) => {
  const [tolerance, setTolerance] = useState(30);
  const [edgeSmoothing, setEdgeSmoothing] = useState(false);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback(async () => {
    if (!imageUrl) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await removeWhiteBackground(imageUrl, tolerance, edgeSmoothing);
      setProcessedUrl(result);
    } catch (err) {
      console.error('Background removal failed:', err);
      setError('處理圖片時發生錯誤');
    } finally {
      setIsProcessing(false);
    }
  }, [imageUrl, tolerance, edgeSmoothing]);

  // Process on initial load and when settings change
  useEffect(() => {
    if (isOpen && imageUrl) {
      processImage();
    }
  }, [isOpen, imageUrl, tolerance, edgeSmoothing, processImage]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setProcessedUrl(null);
      setTolerance(30);
      setEdgeSmoothing(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (processedUrl) {
      onApply(processedUrl);
    }
  };

  const handleReset = () => {
    setTolerance(30);
    setEdgeSmoothing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-[hsl(var(--primary))]" />
            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">去背設定</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] text-sm">
              {error}
            </div>
          )}

          {/* Image comparison */}
          <div className="flex gap-4 items-center justify-center">
            {/* Original */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">原始圖片</span>
              <div className="w-48 h-48 rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center">
                <img
                  src={imageUrl}
                  alt="Original"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>

            {/* Arrow */}
            <div className="text-2xl text-[hsl(var(--muted-foreground))]">→</div>

            {/* Processed */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">去背預覽</span>
              <div 
                className="w-48 h-48 rounded-xl border border-[hsl(var(--border))] overflow-hidden flex items-center justify-center"
                style={{
                  backgroundImage: `
                    linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
                    linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
                    linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)
                  `,
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  backgroundColor: 'hsl(var(--background))',
                }}
              >
                {isProcessing ? (
                  <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--muted-foreground))]" />
                ) : processedUrl ? (
                  <img
                    src={processedUrl}
                    alt="Processed"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : null}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 pt-2">
            {/* Tolerance slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[hsl(var(--foreground))]">
                  容差值
                </label>
                <span className="text-sm font-mono text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-2 py-0.5 rounded">
                  {tolerance}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={tolerance}
                onChange={(e) => setTolerance(parseInt(e.target.value))}
                className="w-full h-2 rounded-full bg-[hsl(var(--muted))] appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-[hsl(var(--primary))]
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:shadow-md
                  [&::-moz-range-thumb]:w-4
                  [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-[hsl(var(--primary))]
                  [&::-moz-range-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:border-0"
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                (0 = 精確匹配白色, 100 = 移除更多淺色)
              </p>
            </div>

            {/* Edge smoothing toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={edgeSmoothing}
                  onChange={(e) => setEdgeSmoothing(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-[hsl(var(--muted))] rounded-full peer peer-checked:bg-[hsl(var(--primary))] transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
              </div>
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">邊緣平滑處理</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[hsl(var(--border))]">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重設
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={isProcessing || !processedUrl}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  套用去背
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
