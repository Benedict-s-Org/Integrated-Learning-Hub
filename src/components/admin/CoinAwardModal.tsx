import React, { useEffect, useState } from 'react';
import {
    X, Plus, Trash2, Edit2, Check, Star, Trophy
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { REWARD_ICON_MAP, REWARD_COLOR_OPTIONS, getEffectiveSubOptions } from '@/constants/rewardConfig';
import { RewardSubOptionOverlay } from './RewardSubOptionOverlay';
import { DictationBonusOverlay } from './DictationBonusOverlay';
import { UserWithCoins } from '@/pages/ClassDashboardPage';

interface CoinAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAward: (amount: number, reason: string, kind: 'reward' | 'consequence') => void;
    selectedCount: number;
    selectedStudentIds?: string[];
    students?: UserWithCoins[];
    onAwardBulk?: (awards: { userId: string, amount: number }[]) => void;
    activeClass?: string;
}

export interface ClassReward {
    id: string;
    title: string;
    coins: number;
    type: 'reward' | 'consequence';
    icon: string;
    color: string;
    sub_options?: Record<string, string[]>;
}

// Special reward handling is now done via robust string matching

export interface QuickRewardShortcut {
    id: string;
    rewardId: string | null;
}

export function CoinAwardModal({ isOpen, onClose, onAward, selectedCount, selectedStudentIds, students = [], onAwardBulk, activeClass }: CoinAwardModalProps) {
    const { isAdmin, user, isUserView } = useAuth();
    const [rewards, setRewards] = useState<ClassReward[]>([]);
    const [activeTab, setActiveTab] = useState<'reward' | 'consequence' | 'shortcuts'>('reward');
    const [isLoading, setIsLoading] = useState(true);

    // Edit Mode State
    const [isEditMode, setIsEditMode] = useState(false);
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<ClassReward>>({});
    const [customValues, setCustomValues] = useState<Record<string, number>>({});
    
    // Shortcut State
    const [localShortcuts, setLocalShortcuts] = useState<{ id: string, rewardId: string | null }[]>([]);

    const [pendingSubOptions, setPendingSubOptions] = useState<{ reward: ClassReward; selected: string[] } | null>(null);
    const [showDictationBonus, setShowDictationBonus] = useState(false);

    // Daily Count State
    const [maxDailyCount, setMaxDailyCount] = useState<number>(0);

    // Help admins notice why management is hidden
    const showAdminHint = !isAdmin && user?.role === 'admin' && isUserView;

    useEffect(() => {
        if (isOpen) {
            fetchRewards();
            setPendingSubOptions(null);
            
            // Load shortcuts if activeClass is provided
            if (activeClass) {
                const storageKey = `quick_reward_shortcuts_${activeClass}`;
                const saved = localStorage.getItem(storageKey);
                if (saved) {
                    try {
                        setLocalShortcuts(JSON.parse(saved));
                    } catch (e) {
                        setLocalShortcuts(generateDefaultShortcuts());
                    }
                } else {
                    setLocalShortcuts(generateDefaultShortcuts());
                }
            }
        }
    }, [isOpen, activeClass]);

    const generateDefaultShortcuts = () => [
        { id: 'slot-1', rewardId: null },
        { id: 'slot-2', rewardId: null },
        { id: 'slot-3', rewardId: null },
        { id: 'slot-4', rewardId: null },
        { id: 'slot-5', rewardId: null },
        { id: 'slot-6', rewardId: null },
    ];

    const saveShortcuts = (newShortcuts: { id: string, rewardId: string | null }[]) => {
        if (!activeClass) return;
        setLocalShortcuts(newShortcuts);
        localStorage.setItem(`quick_reward_shortcuts_${activeClass}`, JSON.stringify(newShortcuts));
        // Force update of toolbars (they listen to storage events or we can use custom event)
        window.dispatchEvent(new Event('storage')); 
    };

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

        const effectiveSubs = getEffectiveSubOptions(item);
        const hasSubs = Object.keys(effectiveSubs).length > 0;

        if (hasSubs) {
            setPendingSubOptions({ reward: item, selected: [] });
        } else {
            onAward(item.coins, item.title, item.type);
        }
    };


    const handleSave = async () => {
        if (!editForm.title || editForm.coins === undefined || editForm.coins === null || String(editForm.coins) === '') return;

        const coinsValue = Number(editForm.coins);
        const itemType = editForm.type || activeTab; // Use form type, fallback to tab

        // Strict Validation (multiples of 5)
        if (itemType === 'reward') {
            if (coinsValue < 0) {
                alert('Rewards cannot have a negative coin value.');
                return;
            }
            if (coinsValue % 5 !== 0) {
                alert('Rewards must be a multiple of 5 (e.g., 5, 10, 15).');
                return;
            }
        } else if (itemType === 'consequence') {
            if (coinsValue > 0) {
                alert('Consequences cannot have a positive coin value. Must be 0 or negative.');
                return;
            }
            if (coinsValue % 5 !== 0) {
                alert('Consequences must be a multiple of 5 (e.g., 0, -5, -10).');
                return;
            }
        }

        try {
            const rewardData = {
                title: editForm.title,
                coins: coinsValue,
                type: itemType,
                icon: editForm.icon || 'Star',
                color: editForm.color || 'text-yellow-500 bg-yellow-100',
                sub_options: editForm.sub_options || null
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
                type: (activeTab === 'shortcuts' ? 'reward' : activeTab) as 'reward' | 'consequence',
                coins: undefined, // Force explicit input
                icon: (activeTab === 'reward' || activeTab === 'shortcuts') ? 'Star' : 'AlertCircle',
                color: (activeTab === 'reward' || activeTab === 'shortcuts') ? 'text-yellow-500 bg-yellow-100' : 'text-red-500 bg-red-100'
            });
        }
    };

    const filteredRewards = activeTab === 'shortcuts' ? [] : rewards.filter(r => r.type === activeTab);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
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
                        {(isAdmin || user?.role === 'admin') && (
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

                {/* Sub-option Selection Overlay (Shared Component) */}
                {pendingSubOptions && (
                    <RewardSubOptionOverlay
                        reward={pendingSubOptions.reward}
                        onClose={() => setPendingSubOptions(null)}
                        onSubmit={(selectedItems) => {
                            const reason = `${pendingSubOptions.reward.title}: ${selectedItems.join(', ')}`;
                            onAward(pendingSubOptions.reward.coins, reason, pendingSubOptions.reward.type);
                            setPendingSubOptions(null);
                        }}
                    />
                )}

                {showDictationBonus && onAwardBulk && (
                    <DictationBonusOverlay
                        isOpen={showDictationBonus}
                        onClose={() => setShowDictationBonus(false)}
                        students={selectedStudentIds
                            ? students.filter(s => selectedStudentIds.includes(s.id))
                            : students
                        }
                        onAwardBulk={(awards) => {
                            onAwardBulk(awards);
                            setShowDictationBonus(false);
                            onClose();
                        }}
                    />
                )}

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
                    {selectedCount === 0 && (
                        <button
                            onClick={() => setActiveTab('shortcuts')}
                            className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2
                                ${activeTab === 'shortcuts'
                                    ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            Toolbar Shortcuts
                        </button>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 relative">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {activeTab === 'shortcuts' ? (
                                <div className="col-span-full">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        {/* Left: Preview */}
                                        <div className="md:w-1/3 space-y-3">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Toolbar Preview</h3>
                                            {localShortcuts.map((s, idx) => {
                                                const linked = rewards.find(r => r.id === s.rewardId);
                                                const IconComp = linked ? (REWARD_ICON_MAP[linked.icon] || Star) : null;
                                                
                                                return (
                                                    <div 
                                                        key={s.id}
                                                        className={`
                                                            p-3 rounded-2xl border transition-all flex items-center gap-3
                                                            ${linked ? 'bg-white border-blue-100 shadow-sm' : 'bg-white/40 border-dashed border-slate-200'}
                                                        `}
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-black text-[10px] shrink-0">
                                                            {idx + 1}
                                                        </div>
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${linked?.color || 'bg-gray-50 text-gray-200'}`}>
                                                            {IconComp ? <IconComp size={20} /> : <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-dashed" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-xs truncate text-gray-700">
                                                                {linked?.title || 'Unassigned'}
                                                            </div>
                                                            {linked && (
                                                                <div className="text-[10px] font-black text-gray-400">
                                                                    {linked.coins > 0 ? '+' : ''}{linked.coins} Coins
                                                                </div>
                                                            )}
                                                        </div>
                                                        {linked && (
                                                            <button 
                                                                onClick={() => saveShortcuts(localShortcuts.map(curr => curr.id === s.id ? { ...curr, rewardId: null } : curr))}
                                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Right: Picker */}
                                        <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                                            <div className="p-4 border-b border-gray-50 bg-gray-50/30">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Item to Assign</h4>
                                            </div>
                                            <div className="p-4 overflow-y-auto max-h-[400px]">
                                                <div className="grid grid-cols-2 gap-2">
                                                    {rewards.map(item => {
                                                        const IconComp = REWARD_ICON_MAP[item.icon] || Star;
                                                        const isAssigned = localShortcuts.some(s => s.rewardId === item.id);
                                                        
                                                        return (
                                                            <button
                                                                key={item.id}
                                                                disabled={isAssigned}
                                                                onClick={() => {
                                                                    const firstEmpty = localShortcuts.findIndex(s => !s.rewardId);
                                                                    if (firstEmpty !== -1) {
                                                                        saveShortcuts(localShortcuts.map((s, idx) => idx === firstEmpty ? { ...s, rewardId: item.id } : s));
                                                                    } else {
                                                                        alert('All slots are filled. Remove one first.');
                                                                    }
                                                                }}
                                                                className={`
                                                                    p-3 rounded-2xl border text-left flex items-center gap-3 transition-all
                                                                    ${isAssigned ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'bg-white border-gray-100 hover:border-blue-300 hover:bg-blue-50/30'}
                                                                `}
                                                            >
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                                                                    <IconComp size={16} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-bold text-[11px] text-gray-700 truncate">{item.title}</div>
                                                                    <div className="text-[9px] font-black text-gray-400">{item.coins > 0 ? '+' : ''}{item.coins} Coins</div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Quick Custom card */}
                                    {!isEditMode && (
                                        <>
                                            <button
                                                onClick={() => setIsCustomMode(!isCustomMode)}
                                                className={`w-full flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all duration-200
                                                    ${isCustomMode
                                                        ? 'border-orange-400 bg-orange-50 text-orange-600'
                                                        : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:bg-gray-50'}`}
                                            >
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl bg-orange-100 text-orange-600`}>
                                                    <Plus size={24} />
                                                </div>
                                                <div className="font-bold text-xs uppercase tracking-wider">Custom</div>
                                            </button>

                                            <button
                                                onClick={() => setShowDictationBonus(true)}
                                                className="w-full flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-400 hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-600 transition-all duration-200"
                                            >
                                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl bg-yellow-100 text-yellow-600">
                                                    <Trophy size={24} />
                                                </div>
                                                <div className="font-bold text-xs uppercase tracking-wider">Dictation Bonus</div>
                                            </button>
                                        </>
                                    )}

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
                                                <div
                                                    onClick={() => {
                                                        if (!(isEditMode || (selectedCount === 0 && !isEditMode && !isCustomMode))) {
                                                            handleRewardClick(item);
                                                        }
                                                    }}
                                                    className={`w-full flex flex-col items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 transition-all duration-200 shadow-sm cursor-pointer
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
                                                                        if (selectedCount === 0) {
                                                                            alert('Please select students first');
                                                                            return;
                                                                        }

                                                                        const val = customValues[item.id];

                                                                        if (val === undefined || String(val).trim() === '') {
                                                                            alert('Please enter a valid number');
                                                                            return;
                                                                        }

                                                                        const amount = Number(val);
                                                                        if (isNaN(amount)) {
                                                                            alert('Please enter a valid number');
                                                                            return;
                                                                        }

                                                                        const effectiveSubs = getEffectiveSubOptions(item);
                                                                        if (Object.keys(effectiveSubs).length > 0) {
                                                                            setPendingSubOptions({ reward: { ...item, coins: amount }, selected: [] });
                                                                        } else {
                                                                            onAward(amount, item.title, item.type);
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
                                                                {item.coins > 0 ? `+${item.coins}` : item.coins}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
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
                                </>
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
                        value={form.coins ?? ''}
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

            {/* Sub-options Editor */}
            <div className="space-y-1">
                <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sub-options (Tabs & Items)</label>
                    <button
                        type="button"
                        onClick={() => {
                            const name = prompt("Enter category name (e.g. 中文):");
                            if (name) {
                                onChange({ ...form, sub_options: { ...(form.sub_options || {}), [name]: [] } });
                            }
                        }}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                        + Add Tab
                    </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 mt-2">
                    {Object.entries(form.sub_options || {}).map(([cat, items]: [string, any]) => (
                        <div key={cat} className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-gray-700">{cat}</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const item = prompt(`Enter item for ${cat}:`);
                                            if (item) {
                                                const newSubs = { ...(form.sub_options || {}) };
                                                newSubs[cat] = [...(newSubs[cat] || []), item];
                                                onChange({ ...form, sub_options: newSubs });
                                            }
                                        }}
                                        className="text-[10px] text-green-600 hover:underline"
                                    >
                                        Add Item
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newSubs = { ...(form.sub_options || {}) };
                                            delete newSubs[cat];
                                            onChange({ ...form, sub_options: newSubs });
                                        }}
                                        className="text-[10px] text-red-600 hover:underline"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {items.map((it: string) => (
                                    <div key={it} className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-gray-200 text-[10px]">
                                        {it}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newSubs = { ...(form.sub_options || {}) };
                                                newSubs[cat] = newSubs[cat].filter((i: string) => i !== it);
                                                onChange({ ...form, sub_options: newSubs });
                                            }}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                {items.length === 0 && <span className="text-[10px] text-gray-400 italic">No items added</span>}
                            </div>
                        </div>
                    ))}
                    {Object.keys(form.sub_options || {}).length === 0 && (
                        <p className="text-[10px] text-gray-400 text-center py-2 bg-gray-50 rounded-lg">No structured sub-options defined</p>
                    )}
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
                    disabled={!form.title || form.coins === undefined || form.coins === null || String(form.coins) === ''}
                    className="px-6 py-2 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <Check size={16} />
                    Save Item
                </button>
            </div>
        </div>
    );
}
