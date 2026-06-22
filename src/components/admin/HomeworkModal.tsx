import { useState, useEffect } from 'react';
import { X, BookOpen, Check, ClipboardCheck, AlertCircle, FileText, Plus, Edit2, Loader2 } from 'lucide-react';
import { DEFAULT_SUB_OPTIONS } from '@/constants/rewardConfig';
import { supabase } from '../../lib/supabase';

interface HomeworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentName: string;
    onRecord: (reason: string, coins?: number, items?: Record<string, string[]>) => void;
    isHandbookDisabled?: boolean;
    dailyHomeworkItems?: Record<string, string[]>;
    onSetupDailyHomework?: (items: Record<string, string[]>) => Promise<void>;
    isFirstStudent?: boolean;
}

type TabType = 'general' | 'specific';

const SUBJECT_ORDER = ['中文', '英文', '數學', '常識', '其他'];

export function HomeworkModal({ 
    isOpen, 
    onClose, 
    studentName, 
    onRecord,
    isHandbookDisabled = false,
    dailyHomeworkItems,
    onSetupDailyHomework,
    isFirstStudent = false
}: HomeworkModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [selectedSubject, setSelectedSubject] = useState<string>(Object.keys(DEFAULT_SUB_OPTIONS)[0]);
    const [selectedItems, setSelectedItems] = useState<Record<string, string[]>>({});
    const [hasTriggeredSpecific, setHasTriggeredSpecific] = useState(false);
    const [homeworkOptions, setHomeworkOptions] = useState<Record<string, string[]>>(DEFAULT_SUB_OPTIONS);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Setup mode states
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [setupSelectedItems, setSetupSelectedItems] = useState<Record<string, string[]>>({});
    const [pendingAction, setPendingAction] = useState<'completed' | 'missing' | null>(null);

    // Fetch latest options from database
    useEffect(() => {
        if (isOpen) {
            fetchHomeworkOptions();
            if (studentName === '今日功課' || studentName === '今日功課設定' || studentName === '明日功課設定') {
                setIsSetupMode(true);
                setSetupSelectedItems(dailyHomeworkItems || {});
                setPendingAction(null);
            } else {
                setIsSetupMode(false);
                setSetupSelectedItems({});
                setPendingAction(null);
            }
        } else {
            setActiveTab('general');
            setHasTriggeredSpecific(false);
            setSelectedItems({});
            setIsEditing(false);
            setIsSetupMode(false);
            setSetupSelectedItems({});
            setPendingAction(null);
        }
    }, [isOpen, studentName, dailyHomeworkItems]);

    const fetchHomeworkOptions = async () => {
        const { data, error } = await supabase
            .from('class_rewards' as any)
            .select('sub_options')
            .eq('title', '完成班務（欠功課）')
            .single() as any;

        if (error) {
            console.error('Error fetching homework options:', error);
            return;
        }

        if (data?.sub_options) {
            setHomeworkOptions({
                ...DEFAULT_SUB_OPTIONS,
                ...data.sub_options
            });
        }
    };

    const handleToggleSetupItem = (subject: string, item: string) => {
        setSetupSelectedItems(prev => {
            const current = prev[subject] || [];
            const updated = current.includes(item)
                ? current.filter(i => i !== item)
                : [...current, item];
            const next = { ...prev };
            if (updated.length > 0) {
                next[subject] = updated;
            } else {
                delete next[subject];
            }
            return next;
        });
    };

    const handleToggleAllSubjectItems = (subject: string) => {
        const items = homeworkOptions[subject] || [];
        setSetupSelectedItems(prev => {
            const current = prev[subject] || [];
            const next = { ...prev };
            if (current.length === items.length) {
                delete next[subject];
            } else {
                next[subject] = [...items];
            }
            return next;
        });
    };

    const handleConfirmSetup = async () => {
        const totalSetupCount = Object.values(setupSelectedItems).reduce((sum, items: string[]) => sum + items.length, 0);
        if (totalSetupCount === 0) {
            alert(studentName === '明日功課設定' ? '請選擇至少一項明日功課項目！(Please select at least one homework item!)' : '請選擇至少一項今日功課項目！(Please select at least one homework item!)');
            return;
        }

        setIsSaving(true);
        try {
            if (onSetupDailyHomework) {
                await onSetupDailyHomework(setupSelectedItems);
            }
            setIsSetupMode(false);
            if (pendingAction === 'completed') {
                await onRecord('完成班務（交齊功課）');
                onClose();
            } else if (pendingAction === 'missing') {
                setActiveTab('specific');
                setHasTriggeredSpecific(true);
            } else {
                onClose();
            }
        } catch (err: any) {
            console.error('Setup daily homework failed:', err);
            alert(`Failed to save setup: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddItemForSubject = async (subject: string) => {
        const newItem = prompt(`Add new homework item for ${subject}:`);
        if (!newItem || newItem.trim() === '') return;

        const trimmedItem = newItem.trim();
        if (homeworkOptions[subject]?.includes(trimmedItem)) {
            alert('Item already exists!');
            return;
        }

        setIsSaving(true);
        try {
            const updatedOptions = {
                ...homeworkOptions,
                [subject]: [...(homeworkOptions[subject] || []), trimmedItem]
            };

            const { error } = await supabase
                .from('class_rewards' as any)
                .update({ sub_options: updatedOptions } as any)
                .eq('title', '完成班務（欠功課）');

            if (error) throw error;

            setHomeworkOptions(updatedOptions);
            
            // Automatically select it if setting up
            if (isSetupMode) {
                setSetupSelectedItems(prev => ({
                    ...prev,
                    [subject]: [...(prev[subject] || []), trimmedItem]
                }));
            }
        } catch (error) {
            console.error('Error adding homework item:', error);
            alert('Failed to add item. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const generalOptions = [
        { label: '交齊功課', value: '完成班務（交齊功課）', icon: ClipboardCheck, color: 'text-green-600 bg-green-50 border-green-200' },
        { label: '欠功課', value: '完成班務（欠功課）', icon: AlertCircle, color: 'text-red-600 bg-red-50 border-red-200' },
        { 
            label: '寫手冊', 
            value: '完成班務（寫手冊）', 
            icon: FileText, 
            color: 'text-blue-600 bg-blue-50 border-blue-200', 
            adminOnly: true,
            disabled: isHandbookDisabled 
        },
    ];

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

    const totalSelectedCount = Object.values(selectedItems).reduce((sum, items: string[]) => sum + items.length, 0);

    const handleSubmitSpecific = async () => {
        setIsSaving(true);
        try {
            if (totalSelectedCount === 0) {
                // If they are on the specific tab but haven't picked anything, 
                // clicking "Record" behaves like a general "欠功課" 
                await onRecord('完成班務（欠功課）');
            } else {
                // Format: "功課: Math (HW1, HW2), English (Reading)"
                const parts = Object.entries(selectedItems)
                    .map(([subject, items]: [string, string[]]) => `${subject} (${items.join(', ')})`);

                const reason = `功課: ${parts.join(', ')}`;
                await onRecord(reason, undefined, selectedItems);
            }

            setSelectedItems({});
            onClose();
        } catch (err: any) {
            console.error('Submit specific failed:', err);
            alert(`Failed to record items: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneralOptionClick = async (optValue: string) => {
        if (optValue === '完成班務（交齊功課）') {
            if (isFirstStudent) {
                setPendingAction('completed');
                setIsSetupMode(true);
                return;
            }
            setIsSaving(true);
            try {
                await onRecord(optValue);
                onClose();
            } catch (err: any) {
                console.error('General record failed:', err);
                alert(`Failed to record: ${err.message || 'Unknown error'}`);
            } finally {
                setIsSaving(false);
            }
        } else if (optValue === '完成班務（欠功課）') {
            if (isFirstStudent) {
                setPendingAction('missing');
                setIsSetupMode(true);
                return;
            }
            // Always switch to detailed view for "欠功課" to ensure sub-options are visible
            setActiveTab('specific');
            setHasTriggeredSpecific(true);
        } else {
            setIsSaving(true);
            try {
                await onRecord(optValue);
                onClose();
            } catch (err: any) {
                console.error('General record failed:', err);
                alert(`Failed to record: ${err.message || 'Unknown error'}`);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleAddItem = async () => {
        await handleAddItemForSubject(selectedSubject);
    };

    const handleEditItem = async (oldItem: string) => {
        const newName = prompt(`Rename "${oldItem}" to:`, oldItem);
        if (!newName || newName.trim() === '' || newName.trim() === oldItem) return;

        const trimmedName = newName.trim();
        setIsSaving(true);
        try {
            const updatedList = homeworkOptions[selectedSubject].map(item =>
                item === oldItem ? trimmedName : item
            );

            const updatedOptions = {
                ...homeworkOptions,
                [selectedSubject]: updatedList
            };

            const { error } = await supabase
                .from('class_rewards' as any)
                .update({ sub_options: updatedOptions } as any)
                .eq('title', '完成班務（欠功課）');

            if (error) throw error;

            setHomeworkOptions(updatedOptions);
        } catch (error) {
            console.error('Error renaming homework item:', error);
            alert('Failed to rename item.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <BookOpen className="text-blue-600" size={24} />
                            Homework
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                            Recording for {studentName}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 shadow-sm border border-slate-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs - Only shown after "欠功課" is clicked, and not in setup mode */}
                {hasTriggeredSpecific && !isSetupMode && (
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
                    {isSetupMode ? (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                                <h4 className="text-sm font-black text-blue-800 mb-1 flex items-center gap-1.5">
                                    <ClipboardCheck size={16} />
                                    {studentName === '明日功課設定' ? '設定明日提交功課 (Setup Tomorrow\'s Homework)' : '設定今日提交功課 (Setup Today\'s Homework)'}
                                </h4>
                                <p className="text-[10px] text-blue-600 font-bold">
                                    {studentName === '明日功課設定' 
                                        ? '請勾選明天需要提交的功課項目。' 
                                        : '你是今天第一位提交功課的同學，請勾選今天需要提交的功課項目。'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                {SUBJECT_ORDER.map(subject => {
                                    const items = homeworkOptions[subject] || [];
                                    const selectedCount = setupSelectedItems[subject]?.length || 0;

                                    return (
                                        <div key={subject} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                                                    <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
                                                    {subject}
                                                    {selectedCount > 0 && (
                                                        <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                                                            已選 {selectedCount}
                                                        </span>
                                                    )}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleAllSubjectItems(subject)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                                                >
                                                    {selectedCount === items.length && items.length > 0 ? "取消全選" : "全選"}
                                                </button>
                                            </div>

                                            {items.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {items.map(item => {
                                                        const isChecked = setupSelectedItems[subject]?.includes(item);
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={item}
                                                                onClick={() => handleToggleSetupItem(subject, item)}
                                                                className={`p-2 rounded-xl border text-[10px] font-bold transition-all text-left flex items-center justify-between gap-1
                                                                    ${isChecked 
                                                                        ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                            >
                                                                <span className="truncate">{item}</span>
                                                                {isChecked && <Check size={12} className="shrink-0 text-white" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">暫無功課項目 (No items)</p>
                                            )}

                                            <div className="mt-2 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddItemForSubject(subject)}
                                                    className="px-3 py-1 bg-white hover:bg-blue-50 border border-dashed border-blue-200 text-blue-500 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all"
                                                >
                                                    <Plus size={10} />
                                                    新增項目 (Add)
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : activeTab === 'general' ? (
                        <div className="space-y-3">
                            {generalOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleGeneralOptionClick(opt.value)}
                                    disabled={isSaving || (opt as any).disabled}
                                    className={`w-full p-5 rounded-2xl border-2 flex items-center gap-4 transition-all text-left group
                                        ${(opt as any).disabled 
                                            ? 'opacity-40 grayscale cursor-not-allowed border-slate-100 bg-slate-50' 
                                            : `hover:scale-[1.02] active:scale-95 ${opt.color}`}`}
                                >
                                    <div className={`p-3 rounded-xl shadow-sm transition-shadow ${!(opt as any).disabled ? 'bg-white group-hover:shadow-md' : 'bg-slate-100'}`}>
                                        <opt.icon size={24} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-lg">{opt.label}</span>
                                        {(opt as any).disabled && (
                                            <span className="text-[10px] font-bold opacity-70 italic">Please select 欠功課 first</span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Subject Selector */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {SUBJECT_ORDER.map(subject => {
                                        if (!homeworkOptions[subject]) return null;
                                        // If daily homework is set, only show this subject tab if it has at least one configured homework item
                                        if (dailyHomeworkItems && (!dailyHomeworkItems[subject] || dailyHomeworkItems[subject].length === 0)) {
                                            return null;
                                        }
                                        const count = selectedItems[subject]?.length || 0;
                                        return (
                                            <button
                                                key={subject}
                                                onClick={() => {
                                                    setSelectedSubject(subject);
                                                    setIsEditing(false);
                                                }}
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

                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`p-2 rounded-lg transition-all ${isEditing ? 'bg-orange-500 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:text-blue-600 hover:border-blue-200'}`}
                                    title="Toggle Edit Mode"
                                >
                                    <Edit2 size={16} />
                                </button>
                            </div>

                            {/* Items Grid */}
                            <div className="grid grid-cols-3 gap-2">
                                {(homeworkOptions[selectedSubject] || [])
                                    .filter(item => {
                                        if (!dailyHomeworkItems) return true;
                                        return dailyHomeworkItems[selectedSubject]?.includes(item);
                                    })
                                    .map(item => {
                                        const isSelected = selectedItems[selectedSubject]?.includes(item);
                                        return (
                                            <button
                                                key={item}
                                                onClick={() => isEditing ? handleEditItem(item) : handleToggleItem(item)}
                                                className={`p-3 rounded-xl border-2 font-bold text-[10px] transition-all relative group
                                                    ${isEditing
                                                        ? 'bg-orange-50 border-orange-200 text-orange-600 hover:border-orange-400'
                                                        : isSelected
                                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
                                                            : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100/80 hover:border-slate-200'}`}
                                            >
                                                {item}
                                                {isEditing && (
                                                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-sm border border-orange-200">
                                                        <Edit2 size={8} />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}

                                {/* Admin Add Button - Only show if not filtering by today's homework, or if we want to allow dynamically adding to the filtered options */}
                                {!dailyHomeworkItems && (
                                    <button
                                        onClick={handleAddItem}
                                        disabled={isSaving}
                                        className="p-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-400 font-bold text-[10px] hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                        <Plus size={12} />
                                        Add+
                                    </button>
                                )}

                                {((homeworkOptions[selectedSubject] || []).filter(item => !dailyHomeworkItems || dailyHomeworkItems[selectedSubject]?.includes(item)).length === 0) && (
                                    <div className="col-span-full py-12 text-center text-slate-300 italic text-sm font-medium">
                                        No items for {selectedSubject}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (Setup or Specific tab) */}
                {isSetupMode ? (
                    <div className="p-6 bg-slate-50 border-t border-gray-100 flex gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setIsSetupMode(false);
                                setPendingAction(null);
                            }}
                            className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 font-bold rounded-2xl shadow-sm hover:bg-slate-50 transition-all active:scale-95 text-center text-xs uppercase tracking-widest"
                        >
                            返回 (Back)
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmSetup}
                            disabled={isSaving}
                            className="flex-2 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50 disabled:scale-100 px-4"
                        >
                            {isSaving ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <Check size={20} />
                            )}
                            {isSaving ? '儲存中...' : studentName === '明日功課設定' ? '確認明日功課 (Confirm)' : '確認今日功課 (Confirm)'}
                        </button>
                    </div>
                ) : activeTab === 'specific' && (
                    <div className="p-6 bg-slate-50 border-t border-gray-100">
                        <button
                            onClick={handleSubmitSpecific}
                            disabled={isSaving}
                            className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50 disabled:scale-100"
                        >
                            {isSaving ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <Check size={20} />
                            )}
                            {isSaving ? 'Recording...' : `Record Items (${totalSelectedCount})`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
