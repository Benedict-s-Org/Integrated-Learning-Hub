import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, AlertTriangle, CheckCircle, Tag, Filter } from 'lucide-react';

interface ErrorRecord {
    id: string;
    category: string;
    error_code: string | null;
    error_message: string;
    file_path: string | null;
    trigger_action: string | null;
    solution: string;
    prevention: string | null;
    occurrence_count: number;
    tags: string[] | null;
    resolved: boolean;
}

const CATEGORIES = [
    { id: 'all', label: '全部', color: 'bg-slate-500' },
    { id: 'file_edit', label: '檔案編輯', color: 'bg-blue-500' },
    { id: 'import_missing', label: '缺少引入', color: 'bg-purple-500' },
    { id: 'type_mismatch', label: '類型錯誤', color: 'bg-orange-500' },
    { id: 'lint_error', label: 'Lint 警告', color: 'bg-yellow-500' },
    { id: 'build_failure', label: '建置失敗', color: 'bg-red-500' },
    { id: 'runtime_error', label: '執行錯誤', color: 'bg-rose-500' },
    { id: 'database', label: '資料庫', color: 'bg-green-500' },
    { id: 'git', label: 'Git', color: 'bg-gray-500' },
    { id: 'deployment', label: '部署', color: 'bg-cyan-500' },
    { id: 'other', label: '其他', color: 'bg-slate-400' },
];

export function ErrorKnowledgeBase() {
    const [errors, setErrors] = useState<ErrorRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        loadErrors();
    }, []);

    const loadErrors = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('dev_error_log')
            .select('*')
            .order('occurrence_count', { ascending: false });

        if (error) {
            console.error('Failed to load errors:', error);
        } else {
            setErrors(data || []);
        }
        setLoading(false);
    };

    const filteredErrors = errors.filter(err => {
        const matchesCategory = selectedCategory === 'all' || err.category === selectedCategory;
        const matchesSearch = searchQuery === '' ||
            err.error_message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            err.solution.toLowerCase().includes(searchQuery.toLowerCase()) ||
            err.file_path?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            err.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    const getCategoryInfo = (categoryId: string) => {
        return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-background p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-black text-primary flex items-center gap-3">
                        <AlertTriangle className="w-7 h-7" />
                        錯誤知識庫
                    </h1>
                    <p className="text-primary/50 text-sm mt-1">
                        記錄開發過程中遇到的錯誤與解決方案
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-primary/60">
                    <span className="font-bold">{errors.length}</span> 筆記錄
                </div>
            </div>

            {/* Search & Filter */}
            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30" />
                    <input
                        type="text"
                        placeholder="搜尋錯誤訊息、解決方案、標籤..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white border-2 border-primary/10 focus:border-primary/30 outline-none transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 bg-white rounded-2xl px-4 border-2 border-primary/10">
                    <Filter className="w-4 h-4 text-primary/40" />
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="py-3 bg-transparent outline-none text-sm font-bold text-primary cursor-pointer"
                    >
                        {CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Error List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {loading ? (
                    <div className="text-center py-20 text-primary/40">
                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                        載入中...
                    </div>
                ) : filteredErrors.length === 0 ? (
                    <div className="text-center py-20 text-primary/40">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>沒有符合的記錄</p>
                    </div>
                ) : (
                    filteredErrors.map(err => {
                        const catInfo = getCategoryInfo(err.category);
                        const isExpanded = expandedId === err.id;

                        return (
                            <div
                                key={err.id}
                                className={`bg-white rounded-2xl border-2 transition-all cursor-pointer ${isExpanded ? 'border-primary/30 shadow-lg' : 'border-primary/5 hover:border-primary/20'
                                    }`}
                                onClick={() => setExpandedId(isExpanded ? null : err.id)}
                            >
                                {/* Header */}
                                <div className="p-5 flex items-start gap-4">
                                    <div className={`w-3 h-3 rounded-full mt-1.5 ${catInfo.color}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-primary/40 uppercase">
                                                {catInfo.label}
                                            </span>
                                            {err.error_code && (
                                                <code className="text-xs bg-primary/5 px-2 py-0.5 rounded text-primary/60">
                                                    {err.error_code}
                                                </code>
                                            )}
                                            {err.resolved && (
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                            )}
                                        </div>
                                        <p className="text-primary font-bold line-clamp-2">
                                            {err.error_message}
                                        </p>
                                        {err.file_path && (
                                            <p className="text-xs text-primary/40 mt-1 font-mono truncate">
                                                {err.file_path}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs text-primary/40">發生次數</div>
                                        <div className="text-2xl font-black text-primary/20">
                                            {err.occurrence_count}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-0 space-y-4 border-t border-primary/5 mt-2">
                                        {err.trigger_action && (
                                            <div>
                                                <h4 className="text-xs font-bold text-primary/40 uppercase mb-1">
                                                    觸發原因
                                                </h4>
                                                <p className="text-sm text-primary/70">
                                                    {err.trigger_action}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="text-xs font-bold text-emerald-600 uppercase mb-1">
                                                ✅ 解決方案
                                            </h4>
                                            <p className="text-sm text-primary bg-emerald-50 p-3 rounded-xl">
                                                {err.solution}
                                            </p>
                                        </div>
                                        {err.prevention && (
                                            <div>
                                                <h4 className="text-xs font-bold text-blue-600 uppercase mb-1">
                                                    🛡️ 預防措施
                                                </h4>
                                                <p className="text-sm text-primary bg-blue-50 p-3 rounded-xl">
                                                    {err.prevention}
                                                </p>
                                            </div>
                                        )}
                                        {err.tags && err.tags.length > 0 && (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Tag className="w-4 h-4 text-primary/30" />
                                                {err.tags.map(tag => (
                                                    <span
                                                        key={tag}
                                                        className="text-xs bg-primary/5 text-primary/60 px-2 py-1 rounded-full"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
