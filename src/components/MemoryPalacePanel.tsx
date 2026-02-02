import React, { useState } from 'react';
import { Brain, MapPin, Plus, Search, Sofa, Square, Grid, ChevronRight, Eye, Edit2, Trash2 } from 'lucide-react';

interface MemoryPoint {
  id: string;
  targetType: 'furniture' | 'wall' | 'floor' | 'tile';
  targetId: string;
  title: string;
  content: string;
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

interface MemoryPalacePanelProps {
  memoryPoints: MemoryPoint[];
  onAddMemory: (targetType: string) => void;
  onEditMemory: (memoryPoint: MemoryPoint) => void;
  onDeleteMemory: (id: string) => void;
  onViewMemory: (memoryPoint: MemoryPoint) => void;
  getTargetName: (type: string, id: string) => string;
}

export function MemoryPalacePanel({
  memoryPoints,
  onAddMemory,
  onEditMemory,
  onDeleteMemory,
  onViewMemory,
  getTargetName
}: MemoryPalacePanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'furniture' | 'wall' | 'floor' | 'tile'>('all');

  const filteredPoints = memoryPoints.filter(point => {
    const matchesSearch = 
      point.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      point.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || point.targetType === filterType;
    return matchesSearch && matchesType;
  });

  const groupedPoints = {
    furniture: filteredPoints.filter(p => p.targetType === 'furniture'),
    wall: filteredPoints.filter(p => p.targetType === 'wall'),
    floor: filteredPoints.filter(p => p.targetType === 'floor'),
    tile: filteredPoints.filter(p => p.targetType === 'tile'),
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'furniture': return <Sofa size={14} className="text-indigo-500" />;
      case 'wall': return <Square size={14} className="text-amber-500" />;
      case 'floor': return <Grid size={14} className="text-emerald-500" />;
      case 'tile': return <MapPin size={14} className="text-blue-500" />;
      default: return <MapPin size={14} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'furniture': return '家具';
      case 'wall': return '牆壁';
      case 'floor': return '地板';
      case 'tile': return '格子';
      default: return '位置';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white">
            <Brain size={20} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">記憶宮殿</h2>
            <p className="text-xs text-slate-500">{memoryPoints.length} 個記憶點</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜尋記憶..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mt-3">
          {['all', 'furniture', 'wall', 'floor', 'tile'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                filterType === type 
                  ? 'bg-indigo-100 text-indigo-700 font-medium' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {type === 'all' ? '全部' : getTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredPoints.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 text-sm">尚無記憶點</p>
            <p className="text-slate-400 text-xs mt-1">點擊房間中的物件來添加記憶</p>
          </div>
        ) : (
          <>
            {Object.entries(groupedPoints).map(([type, points]) => {
              if (points.length === 0 || (filterType !== 'all' && filterType !== type)) return null;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                    {getIcon(type)}
                    {getTypeLabel(type)} ({points.length})
                  </div>
                  {points.map(point => (
                    <div 
                      key={point.id}
                      className="bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate">
                            {point.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 truncate">
                            {getTargetName(point.targetType, point.targetId)}
                          </div>
                          {point.content && (
                            <div className="text-xs text-slate-400 mt-2 line-clamp-2">
                              {point.content}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onViewMemory(point)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
                            title="查看"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => onEditMemory(point)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600"
                            title="編輯"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteMemory(point.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"
                            title="刪除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Quick Add Buttons */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="text-xs font-bold text-slate-500 mb-2">快速新增記憶點</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onAddMemory('furniture')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            <Sofa size={14} className="text-indigo-500" />
            家具
          </button>
          <button
            onClick={() => onAddMemory('wall')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50 transition-colors"
          >
            <Square size={14} className="text-amber-500" />
            牆壁
          </button>
          <button
            onClick={() => onAddMemory('floor')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
          >
            <Grid size={14} className="text-emerald-500" />
            地板
          </button>
          <button
            onClick={() => onAddMemory('tile')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <MapPin size={14} className="text-blue-500" />
            格子
          </button>
        </div>
      </div>
    </div>
  );
}
