import React, { useEffect, useState } from 'react';
import {
    X, Heart, Star, Zap, Trophy, BookOpen, Users,
    AlertCircle, Clock, XCircle, Plus, Trash2, Edit2, Check,
    Lightbulb, Flame, Award, ThumbsUp, Medal, Crown, Target,
    Smile, Frown, AlertTriangle, Ban
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface CoinAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAward: (amount: number, reason: string) => void;
    selectedCount: number;
}

interface ClassReward {
    id: string;
    title: string;
    coins: number;
    type: 'reward' | 'consequence';
    icon: string;
    color: string;
}

// Map string icon names to Lucide components
const ICON_MAP: Record<string, any> = {
    Heart, Star, Zap, Trophy, BookOpen, Users,
    AlertCircle, Clock, XCircle, Lightbulb, Flame,
    Award, ThumbsUp, Medal, Crown, Target,
    Smile, Frown, AlertTriangle, Ban
};

const COLOR_OPTIONS = [
    { name: 'Pink', class: 'text-pink-500 bg-pink-100' },
    { name: 'Yellow', class: 'text-yellow-500 bg-yellow-100' },
    { name: 'Purple', class: 'text-purple-500 bg-purple-100' },
    { name: 'Blue', class: 'text-blue-500 bg-blue-100' },
    { name: 'Orange', class: 'text-orange-500 bg-orange-100' },
    { name: 'Green', class: 'text-green-500 bg-green-100' },
    { name: 'Red', class: 'text-red-500 bg-red-100' },
    { name: 'Gray', class: 'text-gray-500 bg-gray-100' },
    { name: 'Teal', class: 'text-teal-500 bg-teal-100' },
    { name: 'Indigo', class: 'text-indigo-500 bg-indigo-100' },
];

export function CoinAwardModal({ isOpen, onClose, onAward, selectedCount }: CoinAwardModalProps) {
    const { isAdmin } = useAuth();
    const [rewards, setRewards] = useState<ClassReward[]>([]);
    const [activeTab, setActiveTab] = useState<'reward' | 'consequence'>('reward');
    const [isLoading, setIsLoading] = useState(true);

    // Edit Mode State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<ClassReward>>({});

    useEffect(() => {
        if (isOpen) {
            fetchRewards();
        }
    }, [isOpen]);

    const fetchRewards = async () => {
        setIsLoading(true);
        // Cast to any to bypass missing type definition for class_rewards
        const { data, error } = await (supabase
            .from('class_rewards' as any)
            .select('*')
            .order('created_at', { ascending: true }));

        if (error) {
            console.error('Error fetching rewards:', error);
            // alert('Failed to load rewards'); // Optional: don't annoy user on load fail
        } else {
            setRewards(data as any || []);
        }
        setIsLoading(false);
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
                    .eq('id', editingId));
                if (error) throw error;
                // alert('Updated successfully');
            } else {
                const { error } = await (supabase
                    .from('class_rewards' as any)
                    .insert([rewardData]));
                if (error) throw error;
                // alert('Created successfully');
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
                .eq('id', id));

            if (error) throw error;
            // alert('Deleted successfully');
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
                            {isEditMode ? 'Manage Rewards' : 'Give Feedback'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {isEditMode
                                ? 'Add, edit, or remove items'
                                : selectedCount > 0
                                    ? `Awarding ${selectedCount} student${selectedCount !== 1 ? 's' : ''}`
                                    : 'Select a reward category'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button
                                onClick={() => setIsEditMode(!isEditMode)}
                                className={`p-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                                    ${isEditMode ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                <Edit2 size={16} />
                                {isEditMode ? 'Done' : 'Edit'}
                            </button>
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
                <div className="p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {isEditMode && editingId === 'new' && (
                                <div className="col-span-full p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <h4 className="font-bold text-gray-600 mb-3">New Item</h4>
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
                                            onClick={() => !isEditMode && selectedCount > 0 && onAward(item.coins, item.title)}
                                            disabled={isEditMode || (selectedCount === 0 && !isEditMode)}
                                            className={`w-full flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-200 
                                                ${(isEditMode || (selectedCount === 0 && !isEditMode)) ? 'opacity-50 cursor-default' : 'hover:bg-gray-50 hover:-translate-y-1'}`}
                                        >
                                            <div className={`w-16 h-16 rounded-2xl ${item.color} flex items-center justify-center text-3xl shadow-sm`}>
                                                {React.createElement(ICON_MAP[item.icon] || Star, { size: 32 })}
                                            </div>
                                            <div className="text-center">
                                                <div className="font-bold text-gray-700">{item.title}</div>
                                                <div className={`text-xs font-bold inline-block px-2 py-0.5 rounded-full mt-1
                                                    ${item.coins > 0 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                                                    {item.coins > 0 ? '+' : ''}{item.coins}
                                                </div>
                                            </div>
                                        </button>
                                    )}

                                    {isEditMode && editingId !== item.id && (
                                        <div className="absolute top-2 right-2 flex gap-1 bg-white/80 backdrop-blur rounded-lg p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
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
                                    className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all"
                                >
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                        <Plus size={24} />
                                    </div>
                                    <span className="font-bold text-sm">Add New</span>
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
                <input
                    type="text"
                    placeholder="Title"
                    value={form.title || ''}
                    onChange={e => onChange({ ...form, title: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border rounded"
                />
                <input
                    type="number"
                    placeholder="Coins"
                    value={form.coins || ''}
                    onChange={e => onChange({ ...form, coins: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border rounded"
                />
            </div>

            {/* Color Picker */}
            <div className="flex gap-1 overflow-x-auto p-1">
                {COLOR_OPTIONS.map(opt => (
                    <button
                        key={opt.name}
                        type="button"
                        onClick={() => onChange({ ...form, color: opt.class })}
                        className={`w-6 h-6 rounded-full ${opt.class} flex-shrink-0 border-2 
                            ${form.color === opt.class ? 'border-gray-600' : 'border-transparent'}`}
                    />
                ))}
            </div>

            {/* Icon Picker (Simplified) */}
            <div className="flex gap-1 overflow-x-auto p-1 border-t border-gray-100 pt-2">
                {Object.keys(ICON_MAP).map(iconName => (
                    <button
                        key={iconName}
                        type="button"
                        onClick={() => onChange({ ...form, icon: iconName })}
                        className={`p-1 rounded hover:bg-gray-100 
                            ${form.icon === iconName ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
                    >
                        {React.createElement(ICON_MAP[iconName], { size: 16 })}
                    </button>
                ))}
            </div>

            <div className="flex justify-end gap-2 mt-2">
                <button
                    onClick={onCancel}
                    className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    className="px-2 py-1 text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 rounded flex items-center gap-1"
                >
                    <Check size={12} />
                    Save
                </button>
            </div>
        </div>
    );
}
