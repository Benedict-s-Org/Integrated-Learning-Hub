import { useState } from 'react';
import { Star, Check } from 'lucide-react';
import { DEFAULT_SUB_OPTIONS } from '@/constants/rewardConfig';
import { ClassReward } from './CoinAwardModal';

interface RewardSubOptionOverlayProps {
    reward: ClassReward;
    onClose: () => void;
    onSubmit: (selectedItems: string[]) => void;
    accentColor?: string;
    isDark?: boolean;
}

export function RewardSubOptionOverlay({
    reward,
    onClose,
    onSubmit,
    accentColor = "blue",
    isDark = false
}: RewardSubOptionOverlayProps) {
    const getEffectiveSubOptions = (r: ClassReward) => {
        if (r.sub_options && Object.keys(r.sub_options).length > 0) {
            return r.sub_options;
        }
        return DEFAULT_SUB_OPTIONS;
    };

    const effectiveSubs = getEffectiveSubOptions(reward);
    const [selected, setSelected] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string>(Object.keys(effectiveSubs)[0] || "中文");

    const currentItems = effectiveSubs[activeTab] || [];

    const handleToggle = (item: string) => {
        setSelected(prev =>
            prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
        );
    };

    const textColor = isDark ? "text-white" : "text-slate-800";
    const subTextColor = isDark ? "text-slate-400" : "text-slate-400";
    const cardColor = isDark ? "bg-slate-800" : "bg-white";
    const gridItemHoverColor = isDark ? "hover:bg-slate-700" : "hover:bg-slate-100";

    const accentBg = accentColor === "blue" ? "bg-blue-600" : "bg-orange-600";
    const accentText = accentColor === "blue" ? "text-blue-600" : "text-orange-600";
    const accentBorder = accentColor === "blue" ? "border-blue-600" : "border-orange-600";
    const accentShadow = accentColor === "blue" ? "shadow-blue-200" : "shadow-orange-200";

    return (
        <div className={`fixed inset-0 z-[100] ${isDark ? 'bg-black/80' : 'bg-black/40'} backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in duration-300`}>
            <div className={`${cardColor} rounded-[2.5rem] p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] border ${isDark ? 'border-white/10' : 'border-white/20'}`}>
                {/* Header Section */}
                <div className="text-center mb-6">
                    <h3 className={`text-xl font-black ${textColor} mb-1 transition-colors`}>{reward.title}</h3>
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${accentBg} text-white rounded-full shadow-lg ${isDark ? 'shadow-none' : accentShadow}`}>
                        <Star size={14} fill="currentColor" />
                        <p className="text-[11px] font-black tracking-[0.2em] uppercase">Total 10 Coins</p>
                    </div>
                </div>

                {/* Subject Tabs */}
                <div className="mb-6">
                    <label className={`text-[10px] font-bold ${subTextColor} uppercase tracking-widest mb-3 block text-center`}>1. Select Subject</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-center">
                        {Object.keys(effectiveSubs).map(sub => (
                            <button
                                key={sub}
                                onClick={() => setActiveTab(sub)}
                                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap border-2
                                    ${activeTab === sub
                                        ? `${accentBg} ${accentBorder} text-white shadow-md`
                                        : `${cardColor} ${isDark ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-500'} hover:border-blue-400 hover:text-blue-600`}`}
                            >
                                {sub}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Items Grid */}
                <div className={`flex-1 overflow-y-auto min-h-[300px] mb-6 ${isDark ? 'bg-black/20' : 'bg-slate-50/50'} rounded-2xl border ${isDark ? 'border-white/5' : 'border-slate-100'} p-4`}>
                    <label className={`text-[10px] font-bold ${subTextColor} uppercase tracking-widest mb-4 block text-center`}>
                        2. Choose {activeTab} Items
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {currentItems.map(opt => (
                            <button
                                key={opt}
                                onClick={() => handleToggle(opt)}
                                className={`px-3 py-4 rounded-xl border-2 font-bold transition-all text-xs flex items-center justify-center text-center min-h-[60px]
                                    ${selected.includes(opt)
                                        ? `${accentBorder} ${accentColor === 'blue' ? 'bg-blue-50' : 'bg-orange-50'} ${accentText} shadow-sm`
                                        : `${isDark ? 'border-transparent bg-white/5 text-white/40' : 'border-white bg-white text-slate-400'} ${gridItemHoverColor}`}`}
                            >
                                {opt}
                            </button>
                        ))}
                        {currentItems.length === 0 && (
                            <div className={`col-span-full py-12 text-center ${subTextColor} text-sm italic`}>
                                No items defined for {activeTab}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className={`flex-1 py-4 ${subTextColor} font-bold ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100'} rounded-2xl transition-all`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(selected)}
                        disabled={selected.length === 0}
                        className={`flex-[2] py-4 ${accentBg} text-white font-black rounded-2xl shadow-xl ${isDark ? 'shadow-none' : accentShadow} disabled:opacity-30 disabled:shadow-none transition-all active:scale-95 uppercase tracking-wider text-sm flex items-center justify-center gap-2`}
                    >
                        <Check size={18} />
                        Award 10 Coins
                    </button>
                </div>
            </div>
        </div>
    );
}
