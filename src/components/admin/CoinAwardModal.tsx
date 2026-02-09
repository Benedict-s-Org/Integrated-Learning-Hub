import React, { useEffect, useState } from 'react';
import {
    X, Plus, Trash2, Edit2, Check, Star
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { REWARD_ICON_MAP, REWARD_COLOR_OPTIONS } from '@/constants/rewardConfig';

interface CoinAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAward: (amount: number, reason: string) => void;
    selectedCount: number;
    selectedStudentIds?: string[]; // Add this prop
}

export interface ClassReward {
    id: string;
    title: string;
    coins: number;
    type: 'reward' | 'consequence';
    icon: string;
    color: string;
}

const SUB_OPTIONS = ["中文", "英文", "數學", "常識", "其他"];
// Special reward handling is now done via robust string matching

export function CoinAwardModal({ isOpen, onClose, onAward, selectedCount, selectedStudentIds }: CoinAwardModalProps) {
    const { isAdmin, user, isUserView } = useAuth();
    const [rewards, setRewards] = useState<ClassReward[]>([]);
    const [activeTab, setActiveTab] = useState<'reward' | 'consequence'>('reward');
    const [isLoading, setIsLoading] = useState(true);

    // Edit Mode State
    const [isEditMode, setIsEditMode] = useState(false);
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<ClassReward>>({});
    const [customValues, setCustomValues] = useState<Record<string, number>>({});

    // Sub-options for specific reward
    const [pendingSubOptions, setPendingSubOptions] = useState<{ reward: ClassReward; selected: string[] } | null>(null);

    // Daily Count State
    const [maxDailyCount, setMaxDailyCount] = useState<number>(0);

    /* ... existing code ... */

    // Help admins notice why management is hidden
    const showAdminHint = !isAdmin && user?.role === 'admin' && isUserView;

    useEffect(() => {
        if (isOpen) {
            fetchRewards();
            setPendingSubOptions(null);
        }
    }, [isOpen]);

    const fetchRewards = async () => {
        setIsLoading(true);
        const { data, error } = await (supabase
            .from('class_rewards' as any)
            .select('*')
            .order('created_at', { ascending: true }) as any);

        if (error) {
            console.error('Error fetching rewards:', error);
        } else {
            setRewards(data || []);
        }
        setIsLoading(false);
        setIsLoading(false);
    };

    // Fetch daily counts for selected students
    useEffect(() => {
        const fetchDailyCounts = async () => {
            if (!isOpen || !selectedCount || !selectedStudentIds?.length) {
                setMaxDailyCount(0);
                return;
            }

            const { data } = await supabase
                .from('user_room_data')
                .select('daily_counts')
                .in('user_id', selectedStudentIds);

            if (data) {
                const today = new Date().toISOString().split('T')[0];
                let max = 0;
                data.forEach((row: any) => {
                    if (row.daily_counts?.date === today) {
                        max = Math.max(max, row.daily_counts?.count || 0);
                    }
                });
                setMaxDailyCount(max);
            }
        };

        fetchDailyCounts();
    }, [isOpen, selectedCount, selectedStudentIds]);


    const handleRewardClick = (item: ClassReward) => {
        if (isEditMode || isCustomMode) return;
        if (selectedCount === 0) return;

        // Robust title matching for "完成班務（欠功課）"
        const isSpecialReward = item.title.includes("完成班務") && item.title.includes("欠功課");

        if (isSpecialReward) {
            setPendingSubOptions({ reward: item, selected: [] });
        } else {
            onAward(item.coins, item.title);
        }
    };

    const handleSubOptionToggle = (option: string) => {
        if (!pendingSubOptions) return;
        const selected = pendingSubOptions.selected.includes(option)
            ? pendingSubOptions.selected.filter(o => o !== option)
            : [...pendingSubOptions.selected, option];
        setPendingSubOptions({ ...pendingSubOptions, selected });
    };

    const handleSubOptionSubmit = () => {
        if (!pendingSubOptions || pendingSubOptions.selected.length === 0) return;
        const reason = `${pendingSubOptions.reward.title}: ${pendingSubOptions.selected.join(', ')}`;
        onAward(pendingSubOptions.reward.coins, reason);
        setPendingSubOptions(null);
    };

    const handleSave = async () => {
        if (!editForm.title || !editForm.coins) return;

        try {
            const rewardData = {
                title: editForm.title,
                coins: Number(editForm.coins),
                type: activeTab,
                icon: editForm.icon || 'Star',
                color: editForm.color || 'text-yellow-500 bg-yellow-100'
            };

            if (editingId && editingId !== 'new') {
                const { error } = await (supabase
                    .from('class_rewards' as any)
                    .update(rewardData)
                    .eq('id', editingId) as any);
                if (error) throw error;
            } else {
                const { error } = await (supabase
                    .from('class_rewards' as any)
                    .insert([rewardData]) as any);
                if (error) throw error;
            }

            setEditingId(null);
            setEditForm({});
            fetchRewards();
        } catch (error) {
            console.error('Error saving reward:', error);
            alert('Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            const { error } = await (supabase
                .from('class_rewards' as any)
                .delete()
                .eq('id', id) as any);

            if (error) throw error;
            fetchRewards();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete');
        }
    };

    const startEditing = (reward?: ClassReward) => {
        if (reward) {
            setEditingId(reward.id);
            setEditForm(reward);
        } else {
            setEditingId('new');
            setEditForm({
                type: activeTab,
                coins: activeTab === 'reward' ? 1 : -1,
                icon: activeTab === 'reward' ? 'Star' : 'AlertCircle',
                color: activeTab === 'reward' ? 'text-yellow-500 bg-yellow-100' : 'text-red-500 bg-red-100'
            });
        }
    };

    const filteredRewards = rewards.filter(r => r.type === activeTab);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {isEditMode ? 'Manage Feedback Items' : 'Give Feedback'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {isEditMode
                                ? 'Add, edit, or remove categories'
                                : selectedCount > 0
                                    ? `Awarding ${selectedCount} student${selectedCount !== 1 ? 's' : ''}`
                                    : 'Select a feedback category'
                            }
                        </p>
                        {showAdminHint && (
                            <p className="text-[10px] text-orange-500 font-bold mt-1 bg-orange-50 px-2 py-0.5 rounded-full inline-block animate-pulse">
                                Admin management disabled in User View
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <>
                                <button
                                    onClick={() => {
                                        setIsCustomMode(!isCustomMode);
                                        if (isEditMode) setIsEditMode(false);
                                    }}
                                    className={`p-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                                        ${isCustomMode ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    title="Award custom amounts"
                                >
                                    <Plus size={16} />
                                    {isCustomMode ? 'Custom: ON' : 'Custom'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditMode(!isEditMode);
                                        if (isCustomMode) setIsCustomMode(false);
                                    }}
                                    className={`p-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                                        ${isEditMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                    title="Edit rewards and consequences"
                                >
                                    <Edit2 size={16} />
                                    {isEditMode ? 'Finish Editing' : 'Edit Items'}
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('reward')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 
                            ${activeTab === 'reward'
                                ? 'border-green-500 text-green-600 bg-green-50'
                                : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Rewards
                    </button>
                    <button
                        onClick={() => setActiveTab('consequence')}
                        className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 
                            ${activeTab === 'consequence'
                                ? 'border-red-500 text-red-600 bg-red-50'
                                : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Consequences
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50 relative">
                    {/* Sub-option Selection Overlay */}
                    {pendingSubOptions && (
                        <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm p-8 flex flex-col items-center justify-center animate-in slide-in-from-bottom duration-300">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">{pendingSubOptions.reward.title}</h3>
                            <p className="text-sm text-gray-500 mb-6 text-center">Select subjects to complete (Total 10 Coins)</p>

                            <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-8">
                                {SUB_OPTIONS.map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => handleSubOptionToggle(opt)}
                                        className={`px-4 py-3 rounded-xl border-2 font-bold transition-all
                                            ${pendingSubOptions.selected.includes(opt)
                                                ? 'border-blue-500 bg-blue-50 text-blue-600'
                                                : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3 w-full max-w-sm">
                                <button
                                    onClick={() => setPendingSubOptions(null)}
                                    className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubOptionSubmit}
                                    disabled={pendingSubOptions.selected.length === 0}
                                    className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                                >
                                    Award 10 Coins
                                </button>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {isEditMode && editingId === 'new' && (
                                <div className="col-span-full p-4 bg-white rounded-xl border-2 border-dashed border-blue-200 shadow-sm animate-in slide-in-from-top duration-300">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-blue-600 flex items-center gap-2">
                                            <Plus size={18} />
                                            New {activeTab === 'reward' ? 'Reward' : 'Consequence'}
                                        </h4>
                                    </div>
                                    <RewardEditor
                                        form={editForm}
                                        onChange={setEditForm}
                                        onSave={handleSave}
                                        onCancel={() => setEditingId(null)}
                                    />
                                </div>
                            )}

                            {filteredRewards.map(item => (
                                <div key={item.id} className="relative group">
                                    {editingId === item.id ? (
                                        <div className="col-span-full absolute inset-0 z-10 bg-white p-2 shadow-xl rounded-xl border border-blue-200">
                                            <RewardEditor
                                                form={editForm}
                                                onChange={setEditForm}
                                                onSave={handleSave}
                                                onCancel={() => setEditingId(null)}
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleRewardClick(item)}
                                            disabled={isEditMode || (selectedCount === 0 && !isEditMode && !isCustomMode)}
                                            className={`w-full flex flex-col items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 transition-all duration-200 shadow-sm
                                                ${(isEditMode || (selectedCount === 0 && !isEditMode && !isCustomMode)) ? 'opacity-50 cursor-default' : 'hover:bg-blue-50/50 hover:border-blue-200 hover:-translate-y-1 hover:shadow-md'}
                                                ${isCustomMode ? 'bg-orange-50/50 border-orange-100' : ''}`}
                                        >
                                            <div className={`w-16 h-16 rounded-2xl ${item.color} flex items-center justify-center text-3xl shadow-sm`}>
                                                {React.createElement(REWARD_ICON_MAP[item.icon] || Star, { size: 32 })}
                                            </div>
                                            <div className="text-center w-full">
                                                <div className="font-bold text-gray-700 truncate px-1">{item.title}</div>

                                                {isCustomMode ? (
                                                    <div className="mt-2 flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="number"
                                                            value={customValues[item.id] ?? item.coins}
                                                            onChange={(e) => setCustomValues({
                                                                ...customValues,
                                                                [item.id]: parseInt(e.target.value) || 0
                                                            })}
                                                            className="w-16 px-1 py-0.5 text-xs border rounded text-center font-bold focus:ring-1 focus:ring-orange-300 outline-none"
                                                        />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (selectedCount > 0) {
                                                                    onAward(customValues[item.id] ?? item.coins, item.title);
                                                                } else {
                                                                    alert('Please select students first');
                                                                }
                                                            }}
                                                            className="p-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                                            title="Award custom amount"
                                                        >
                                                            <Check size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className={`text-xs font-bold inline-block px-2 py-0.5 rounded-full mt-1
                                                        ${item.title.includes('回答問題')
                                                            ? maxDailyCount >= 2
                                                                ? 'bg-red-100 text-red-700'
                                                                : maxDailyCount === 1
                                                                    ? 'bg-yellow-100 text-yellow-700'
                                                                    : 'bg-green-100 text-green-700'
                                                            : item.coins > 0 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
                                                        }`}>
                                                        {item.coins > 0 ? '+' : ''}{item.coins}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    )}

                                    {isEditMode && editingId !== item.id && (
                                        <div className="absolute top-2 right-2 flex gap-1 bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); startEditing(item); }}
                                                className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                className="p-1.5 hover:bg-red-50 text-red-600 rounded"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isEditMode && !editingId && (
                                <button
                                    onClick={() => startEditing()}
                                    className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition-all bg-white/50"
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                        <Plus size={24} />
                                    </div>
                                    <span className="font-bold text-sm">Add New Item</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function RewardEditor({ form, onChange, onSave, onCancel }: any) {
    return (
        <div className="space-y-3 w-full" onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Title</label>
                    <input
                        type="text"
                        placeholder="e.g. Helping Others"
                        value={form.title || ''}
                        onChange={e => onChange({ ...form, title: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Coins</label>
                    <input
                        type="number"
                        placeholder="e.g. 5"
                        value={form.coins || ''}
                        onChange={e => onChange({ ...form, coins: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Color Picker */}
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Color Style</label>
                <div className="flex gap-1.5 overflow-x-auto p-1 pb-2 scrollbar-none">
                    {REWARD_COLOR_OPTIONS.map(opt => (
                        <button
                            key={opt.name}
                            type="button"
                            onClick={() => onChange({ ...form, color: opt.class })}
                            className={`w-8 h-8 rounded-full ${opt.class} flex-shrink-0 border-2 transition-all
                                ${form.color === opt.class ? 'border-blue-600 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                            title={opt.name}
                        />
                    ))}
                </div>
            </div>

            {/* Icon Picker */}
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-t border-gray-100 pt-2 block w-full">Pick Icon</label>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-gray-50 rounded-lg">
                    {Object.keys(REWARD_ICON_MAP).map(iconName => (
                        <button
                            key={iconName}
                            type="button"
                            onClick={() => onChange({ ...form, icon: iconName })}
                            className={`p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all
                                ${form.icon === iconName ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {React.createElement(REWARD_ICON_MAP[iconName] || Star, { size: 18 })}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    disabled={!form.title || !form.coins}
                    className="px-6 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <Check size={16} />
                    Save Item
                </button>
            </div>
        </div>
    );
}
