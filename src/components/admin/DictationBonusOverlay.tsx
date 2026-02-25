import { useState, useEffect } from 'react';
import { X, Trophy, Check, Plus, Minus } from 'lucide-react';

interface Student {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    avatar_config?: any;
    class?: string | null;
    class_number?: number | null;
}

interface DictationBonusOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    students: Student[];
    onAwardBulk: (awards: { userId: string, amount: number }[]) => void;
}

export function DictationBonusOverlay({ isOpen, onClose, students, onAwardBulk }: DictationBonusOverlayProps) {
    const [amounts, setAmounts] = useState<Record<string, number>>({});

    // Initialize amounts to 0 for all students when opened
    useEffect(() => {
        if (isOpen) {
            const initial: Record<string, number> = {};
            students.forEach(s => {
                initial[s.id] = 0;
            });
            setAmounts(initial);
        }
    }, [isOpen, students]);

    if (!isOpen) return null;

    const handleAmountChange = (userId: string, val: number) => {
        setAmounts(prev => ({
            ...prev,
            [userId]: Math.max(0, val)
        }));
    };

    const handleSubmit = () => {
        const awards = Object.entries(amounts)
            .filter(([_, amount]) => amount > 0)
            .map(([userId, amount]) => ({ userId, amount: Number(amount) }));

        if (awards.length === 0) {
            alert("Please enter bonus amounts for at least one student.");
            return;
        }

        onAwardBulk(awards);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-yellow-100 rounded-xl text-yellow-600">
                                <Trophy size={28} />
                            </div>
                            Dictation Bonus Marks
                        </h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
                            Input coins for {students.length} students
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600 shadow-sm border border-slate-100 active:scale-95"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {students.map(student => (
                            <div key={student.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-yellow-200 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-50">
                                        {student.avatar_url ? (
                                            <img src={student.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-slate-300 font-bold text-xl">
                                                {student.display_name?.[0] || '?'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-black text-slate-800 truncate max-w-[120px]">
                                            {student.display_name || 'Guest Student'}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {student.class || 'No Class'} {student.class_number ? `#${student.class_number}` : ''}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                    <button
                                        onClick={() => handleAmountChange(student.id, (amounts[student.id] || 0) - 1)}
                                        className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-all active:scale-90"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        min="0"
                                        value={amounts[student.id] ?? 0}
                                        onChange={(e) => handleAmountChange(student.id, parseInt(e.target.value) || 0)}
                                        className="w-12 text-center bg-transparent font-black text-blue-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => handleAmountChange(student.id, (amounts[student.id] || 0) + 1)}
                                        className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-green-500 transition-all active:scale-90"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-white border-t border-slate-100 flex justify-end items-center gap-4">
                    <div className="mr-auto">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Awards</span>
                        <div className="text-2xl font-black text-yellow-600">
                            {Object.values(amounts).filter(a => a > 0).length} Students
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-8 py-4 text-slate-400 font-black uppercase tracking-widest text-sm hover:bg-slate-50 rounded-2xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-10 py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-black rounded-2xl shadow-xl shadow-yellow-200 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest text-sm"
                    >
                        <Check size={20} />
                        Give rewards
                    </button>
                </div>
            </div>
        </div>
    );
}
