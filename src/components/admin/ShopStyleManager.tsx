import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    CheckSquare,
    Square,
    Save,
    X,
    Search,
    Filter,
    Type,
    DollarSign,
    Palette,
    AlertCircle
} from 'lucide-react';

interface ShopStyle {
    id: string;
    name: string;
    type: 'wall' | 'floor';
    color_hex: string;
    category: string;
    price: number;
}

interface ShopStyleManagerProps {
    onClose: () => void;
}

export function ShopStyleManager({ onClose }: ShopStyleManagerProps) {
    const [styles, setStyles] = useState<ShopStyle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filtering/Searching
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'wall' | 'floor'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // Bulk Edit
    const [bulkPrice, setBulkPrice] = useState<number | ''>('');

    // Editing individual rows
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempPrice, setTempPrice] = useState<number>(0);

    useEffect(() => {
        fetchStyles();
    }, []);

    const fetchStyles = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase
                .from('shop_system_styles' as any) as any)
                .select('*')
                .order('category', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;
            setStyles(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredStyles.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredStyles.map(s => s.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleBulkUpdate = async () => {
        if (selectedIds.size === 0 || bulkPrice === '') return;

        setLoading(true);
        setError(null);
        try {
            const { error } = await (supabase
                .from('shop_system_styles' as any) as any)
                .update({ price: bulkPrice })
                .in('id', Array.from(selectedIds));

            if (error) throw error;

            setSuccess(`已成功更新 ${selectedIds.size} 個項目的價格`);
            setSelectedIds(new Set());
            setBulkPrice('');
            await fetchStyles();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePrice = async (id: string) => {
        try {
            const { error } = await (supabase
                .from('shop_system_styles' as any) as any)
                .update({ price: tempPrice })
                .eq('id', id);

            if (error) throw error;
            setEditingId(null);
            await fetchStyles();
            setSuccess('價格已更新');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const filteredStyles = styles.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'all' || s.type === typeFilter;
        const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
        return matchesSearch && matchesType && matchesCategory;
    });

    const categories = Array.from(new Set(styles.map(s => s.category))).sort();

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <Palette size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Shop Style Manager</h2>
                            <p className="text-sm text-slate-500">管理牆面與地板顏色價格</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Filters and Search */}
                <div className="p-4 border-b bg-slate-50 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="搜尋名稱或系列..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-slate-400" />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        >
                            <option value="all">所有類型</option>
                            <option value="wall">牆面</option>
                            <option value="floor">地板</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Type size={16} className="text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        >
                            <option value="all">所有系列</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            placeholder="批量價格"
                            value={bulkPrice}
                            onChange={(e) => setBulkPrice(e.target.value === '' ? '' : parseInt(e.target.value))}
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        />
                        <button
                            onClick={handleBulkUpdate}
                            disabled={selectedIds.size === 0 || bulkPrice === '' || loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition text-sm font-medium whitespace-nowrap"
                        >
                            批量更新 ({selectedIds.size})
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg flex items-center gap-2 text-sm animate-in slide-in-from-top-2">
                            <Save size={16} />
                            {success}
                        </div>
                    )}

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 w-12">
                                        <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600 transition">
                                            {selectedIds.size === filteredStyles.length && filteredStyles.length > 0 ?
                                                <CheckSquare size={18} className="text-indigo-600" /> :
                                                <Square size={18} />
                                            }
                                        </button>
                                    </th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">樣式</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">顏色預覽</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">類型</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 uppercase tracking-wider">價格</th>
                                    <th className="p-4 text-sm font-semibold text-slate-600 uppercase tracking-wider text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStyles.map(style => (
                                    <tr key={style.id} className={`hover:bg-slate-50 transition ${selectedIds.has(style.id) ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="p-4">
                                            <button onClick={() => toggleSelect(style.id)} className="text-slate-400 hover:text-indigo-600 transition">
                                                {selectedIds.has(style.id) ?
                                                    <CheckSquare size={18} className="text-indigo-600" /> :
                                                    <Square size={18} />
                                                }
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-medium text-slate-800">{style.name}</div>
                                            <div className="text-xs text-slate-400">{style.category}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-8 h-8 rounded-lg shadow-inner border border-slate-200"
                                                    style={{ backgroundColor: style.color_hex }}
                                                />
                                                <code className="text-xs text-slate-400">{style.color_hex}</code>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.type === 'wall' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                                                }`}>
                                                {style.type === 'wall' ? '牆面' : '地板'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {editingId === style.id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={tempPrice}
                                                        onChange={(e) => setTempPrice(parseInt(e.target.value))}
                                                        className="w-20 px-2 py-1 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                                        autoFocus
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                                                    <DollarSign size={14} className="text-slate-400" />
                                                    {style.price}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            {editingId === style.id ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleSavePrice(style.id)}
                                                        className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                                                    >
                                                        <Save size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setEditingId(style.id);
                                                        setTempPrice(style.price);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition"
                                                >
                                                    編輯價格
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredStyles.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                                            找不到符合條件的樣式
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-slate-50 flex justify-between items-center whitespace-nowrap overflow-x-auto">
                    <div className="text-sm text-slate-500">
                        共 {styles.length} 個項目
                        {selectedIds.size > 0 && ` (已選取 ${selectedIds.size} 個)`}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition"
                    >
                        關閉
                    </button>
                </div>
            </div>
        </div>
    );
}
