import { useState, useEffect } from 'react';
import { X, BookOpen, Check, ClipboardCheck, AlertCircle, FileText } from 'lucide-react';
import { DEFAULT_SUB_OPTIONS } from '@/constants/rewardConfig';

interface HomeworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentName: string;
    onRecord: (reason: string, coins?: number) => void;
    isGuestMode?: boolean;
}

type TabType = 'general' | 'specific';

export function HomeworkModal({ isOpen, onClose, studentName, onRecord, isGuestMode }: HomeworkModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [selectedSubject, setSelectedSubject] = useState<string>(Object.keys(DEFAULT_SUB_OPTIONS)[0]);
    const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
    const [hasTriggeredSpecific, setHasTriggeredSpecific] = useState(false);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setActiveTab('general');
            setHasTriggeredSpecific(false);
            setSelectedItems({});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const generalOptions = [
        { label: '交齊功課', value: '完成班務（交齊功課）', icon: ClipboardCheck, color: 'text-green-600 bg-green-50 border-green-200' },
        { label: '欠功課', value: '完成班務（欠功課）', icon: AlertCircle, color: 'text-red-600 bg-red-50 border-red-200' },
        { label: '寫手冊', value: '完成班務（寫手冊）', icon: FileText, color: 'text-blue-600 bg-blue-50 border-blue-200', adminOnly: true },
    ].filter(opt => !isGuestMode || !opt.adminOnly);

    const handleToggleItem = (item: string) => {
        setSelectedItems(prev => {
            const current = prev[selectedSubject] || [];
            const updated = current.includes(item)
                ? current.filter(i => i !== item)
                : [...current, item];

            const next = { ...prev };
            if (updated.length > 0) {
                next[selectedSubject] = updated;
            } else {
                delete next[selectedSubject];
            }
            return next;
        });
    };

    const totalSelectedCount = Object.values(selectedItems).reduce((sum, items) => sum + items.length, 0);

    const handleSubmitSpecific = () => {
        if (totalSelectedCount === 0) return;

        // Format: "功課: Math (HW1, HW2), English (Reading)"
        const parts = Object.entries(selectedItems)
            .map(([subject, items]) => `${subject} (${items.join(', ')})`);

        const reason = `功課: ${parts.join(', ')}`;
        onRecord(reason);
        setSelectedItems({});
        onClose();
    };

    const handleGeneralOptionClick = (optValue: string) => {
        if (isGuestMode && optValue === '完成班務（欠功課）') {
            // In guest mode, clicking "欠功課" doesn't close but switches to detailed view
            setActiveTab('specific');
            setHasTriggeredSpecific(true);
            // We still want to record the basic "欠功課" event? 
            // Usually we wait for specific items to be selected.
            return;
        }

        onRecord(optValue);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <BookOpen className="text-blue-600" size={24} />
                            {isGuestMode ? '早會班務' : 'Homework'}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                            Recording for {studentName}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 shadow-sm border border-slate-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs - Hidden in guest mode unless triggered by "欠功課" */}
                {(!isGuestMode || hasTriggeredSpecific) && (
                    <div className="flex border-b border-gray-100 shadow-sm">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all
                                ${activeTab === 'general' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            General Record
                        </button>
                        <button
                            onClick={() => setActiveTab('specific')}
                            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all
                                ${activeTab === 'specific' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Specific Items
                        </button>
                    </div>
                )}

                {/* Body */}
                <div className="p-6 overflow-y-auto min-h-[300px]">
                    {activeTab === 'general' ? (
                        <div className="space-y-3">
                            {generalOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleGeneralOptionClick(opt.value)}
                                    className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all hover:scale-[1.02] active:scale-95 text-left group ${opt.color}`}
                                >
                                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                                        <opt.icon size={24} />
                                    </div>
                                    <span className="font-black text-lg">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Subject Selector */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {Object.keys(DEFAULT_SUB_OPTIONS).map(subject => {
                                    const count = selectedItems[subject]?.length || 0;
                                    return (
                                        <button
                                            key={subject}
                                            onClick={() => setSelectedSubject(subject)}
                                            className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition-all border-2 flex items-center gap-2
                                                ${selectedSubject === subject
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                    : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200 hover:text-blue-600'}`}
                                        >
                                            {subject}
                                            {count > 0 && (
                                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] 
                                                    ${selectedSubject === subject ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Items Grid */}
                            <div className="grid grid-cols-3 gap-2">
                                {DEFAULT_SUB_OPTIONS[selectedSubject].map(item => {
                                    const isSelected = selectedItems[selectedSubject]?.includes(item);
                                    return (
                                        <button
                                            key={item}
                                            onClick={() => handleToggleItem(item)}
                                            className={`p-3 rounded-xl border-2 font-bold text-[10px] transition-all
                                                ${isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                                                    : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100/80 hover:border-slate-200'}`}
                                        >
                                            {item}
                                        </button>
                                    );
                                })}
                                {DEFAULT_SUB_OPTIONS[selectedSubject].length === 0 && (
                                    <div className="col-span-full py-12 text-center text-slate-300 italic text-sm font-medium">
                                        No items for {selectedSubject}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (only for Specific tab) */}
                {activeTab === 'specific' && (
                    <div className="p-6 bg-slate-50 border-t border-gray-100">
                        <button
                            onClick={handleSubmitSpecific}
                            disabled={totalSelectedCount === 0}
                            className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 disabled:opacity-30 disabled:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                        >
                            <Check size={20} />
                            Record Items ({totalSelectedCount})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
