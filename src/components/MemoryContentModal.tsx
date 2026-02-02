import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Search,
  Brain,
  Sofa,
  LayoutGrid,
  Square,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MemoryItem {
  id: string;
  target_type: string | null;
  item_instance_id: string | null;
  title: string | null;
  content: string | null;
  position: { x: number; y: number } | null;
  created_at: string | null;
  updated_at: string | null;
}

interface MemoryContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

const TARGET_TYPE_ICONS: Record<string, React.ElementType> = {
  furniture: Sofa,
  wall: Square,
  floor: LayoutGrid,
  tile: LayoutGrid,
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  furniture: '傢俱',
  wall: '牆壁',
  floor: '地板',
  tile: '磚塊',
};

const ITEMS_PER_PAGE = 10;

export function MemoryContentModal({
  isOpen,
  onClose,
  userId,
  userName,
}: MemoryContentModalProps) {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch memories function - defined with useCallback for stability
  const fetchMemories = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('memories')
      .select('id, target_type, item_instance_id, title, content, position, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching memories:', error);
      setMemories([]);
    } else {
      setMemories(data || []);
    }
    setIsLoading(false);
  }, [userId]);

  // Effect to fetch memories when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchMemories();
    }
  }, [isOpen, userId, fetchMemories]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setFilterType(null);
      setCurrentPage(1);
    }
  }, [isOpen]);

  const filteredMemories = useMemo(() => {
    let result = memories;

    // Filter by type
    if (filterType) {
      result = result.filter((m) => m.target_type === filterType);
    }

    // Filter by search term
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.title?.toLowerCase().includes(lower) ||
          m.content?.toLowerCase().includes(lower)
      );
    }

    return result;
  }, [memories, filterType, searchTerm]);

  const totalPages = Math.ceil(filteredMemories.length / ITEMS_PER_PAGE);
  
  const paginatedMemories = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMemories.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMemories, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTargetLabel = (memory: MemoryItem) => {
    const type = memory.target_type || 'furniture';
    if (type === 'tile' && memory.position) {
      return `磚塊 (${memory.position.x}, ${memory.position.y})`;
    }
    return TARGET_TYPE_LABELS[type] || type;
  };

  // Early return AFTER all hooks
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-2xl max-h-[85vh] bg-[hsl(var(--card))] rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--primary)/0.1)]">
              <Brain className="w-5 h-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                {userName} 的記憶內容
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                共 {memories.length} 個記憶點
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-[hsl(var(--border))] space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋標題或內容..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterType(null)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                filterType === null
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
              }`}
            >
              全部
            </button>
            {['furniture', 'wall', 'floor', 'tile'].map((type) => {
              const Icon = TARGET_TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    filterType === type
                      ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                      : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {TARGET_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : paginatedMemories.length === 0 ? (
            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
              {searchTerm || filterType ? '找不到符合的記憶點' : '此用戶尚無記憶點'}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedMemories.map((memory) => {
                const Icon = TARGET_TYPE_ICONS[memory.target_type || 'furniture'];
                return (
                  <div
                    key={memory.id}
                    className="bg-[hsl(var(--muted))] rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[hsl(var(--background))]">
                        <Icon className="w-4 h-4 text-[hsl(var(--primary))]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]">
                            {getTargetLabel(memory)}
                          </span>
                          {memory.item_instance_id && (
                            <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                              ID: {memory.item_instance_id}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-[hsl(var(--foreground))] mb-1">
                          {memory.title || '無標題'}
                        </h4>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">
                          {memory.content || '無內容'}
                        </p>
                        <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                          建立：{formatDate(memory.created_at)}
                          {memory.updated_at !== memory.created_at && (
                            <span className="ml-2">
                              更新：{formatDate(memory.updated_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[hsl(var(--border))] flex items-center justify-between">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              顯示 {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredMemories.length)} / 共{' '}
              {filteredMemories.length} 項
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-[hsl(var(--foreground))]">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
