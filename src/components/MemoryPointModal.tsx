import React, { useState, useEffect } from 'react';
import { X, Brain, MapPin, Save, Trash2, Sofa, Square, Grid } from 'lucide-react';

interface MemoryPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetInfo: {
    type: 'furniture' | 'wall' | 'floor' | 'tile';
    id: string;
    name: string;
    image?: string;
  };
  existingData?: { title: string; content: string };
  onSave: (data: { title: string; content: string }) => void;
  onDelete?: () => void;
}

export function MemoryPointModal({ 
  isOpen, 
  onClose,
  targetInfo, 
  existingData,
  onSave,
  onDelete 
}: MemoryPointModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (existingData) {
      setTitle(existingData.title);
      setContent(existingData.content);
    } else {
      setTitle('');
      setContent('');
    }
  }, [existingData, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) {
      alert('請輸入標題');
      return;
    }
    onSave({ title: title.trim(), content: content.trim() });
  };

  const getIcon = () => {
    switch (targetInfo.type) {
      case 'furniture': return <Sofa size={20} className="text-indigo-500" />;
      case 'wall': return <Square size={20} className="text-amber-500" />;
      case 'floor': return <Grid size={20} className="text-emerald-500" />;
      case 'tile': return <MapPin size={20} className="text-blue-500" />;
      default: return <MapPin size={20} />;
    }
  };

  const getTypeLabel = () => {
    switch (targetInfo.type) {
      case 'furniture': return '家具';
      case 'wall': return '牆壁';
      case 'floor': return '地板';
      case 'tile': return '地板格子';
      default: return '位置';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Brain size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {existingData ? '編輯記憶點' : '新增記憶點'}
                </h2>
                <p className="text-white/80 text-sm">建立你的記憶宮殿</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Target Info */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
              {getIcon()}
            </div>
            <div className="flex-1">
              <div className="text-xs text-slate-500 font-medium uppercase">
                {getTypeLabel()}
              </div>
              <div className="font-bold text-slate-800">{targetInfo.name}</div>
            </div>
            {targetInfo.image && (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-slate-200">
                <img 
                  src={targetInfo.image} 
                  alt={targetInfo.name} 
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              記憶標題 *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例：重要日期、公式、名詞..."
              className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              記憶內容
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="輸入你要記住的內容、聯想畫面、故事..."
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              <strong>💡 記憶技巧：</strong>
              將記憶內容與這個{getTypeLabel()}連結，想像一個誇張、有趣的畫面，越生動越容易記住！
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between">
          {existingData && onDelete ? (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Trash2 size={16} />
              刪除記憶點
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Save size={16} />
              儲存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
