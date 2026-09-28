import React, { useState, useEffect, useMemo } from "react";
import { X, Loader2, Users, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface UserWithProfile {
    id: string;
    email: string;
    display_name: string | null;
    class_name?: string | null;
    class_number?: number | null;
    spelling_level?: number;
    reading_rearranging_level?: number;
    reading_proofreading_level?: number;
    memorization_level?: number;
    proofreading_level?: number;
    ecas?: string[];
}

interface BulkItemUpdates {
    display_name: string;
    class: string;
    classNumber: string;
    spelling_level: number;
    reading_rearranging_level: number;
    reading_proofreading_level: number;
    memorization_level: number;
    proofreading_level: number;
    ecas: string[];
}

interface BulkUserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    selectedUsers: UserWithProfile[];
    adminUserId: string;
}

export function BulkUserEditModal({
    isOpen,
    onClose,
    onSuccess,
    selectedUsers,
    adminUserId,
}: BulkUserEditModalProps) {
    const { session } = useAuth();
    const [userUpdates, setUserUpdates] = useState<Record<string, BulkItemUpdates>>({});
    const [globalClass, setGlobalClass] = useState("");
    const [availableActivities, setAvailableActivities] = useState<{ id: string; name: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const initialUpdates: Record<string, BulkItemUpdates> = {};
            selectedUsers.forEach((user) => {
                initialUpdates[user.id] = {
                    display_name: user.display_name || "",
                    class: user.class_name || "",
                    classNumber: user.class_number ? user.class_number.toString() : "",
                    spelling_level: user.spelling_level || 1,
                    reading_rearranging_level: user.reading_rearranging_level || 1,
                    reading_proofreading_level: user.reading_proofreading_level || 1,
                    memorization_level: user.memorization_level || 1,
                    proofreading_level: user.proofreading_level || 1,
                    ecas: Array.isArray(user.ecas) ? [...user.ecas] : [],
                };
            });
            setUserUpdates(initialUpdates);
            setGlobalClass("");
            setError(null);
            setSuccess(false);

            // Fetch activities
            (supabase as any).from('activities').select('id, name').order('name').then(({ data }: any) => {
                if (data) setAvailableActivities(data);
            });
        }
    }, [isOpen, selectedUsers]);

    const allActivitiesList = useMemo(() => {
        const actSet = new Set<string>();
        availableActivities.forEach(a => { if (a.name) actSet.add(a.name); });
        selectedUsers.forEach(u => {
            (u.ecas || []).forEach(e => { if (e) actSet.add(e); });
        });
        return Array.from(actSet).sort();
    }, [availableActivities, selectedUsers]);

    const handleUpdateUser = (userId: string, field: keyof BulkItemUpdates, value: any) => {
        setUserUpdates((prev) => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                [field]: value,
            },
        }));
    };

    const handleToggleEca = (userId: string, activityName: string) => {
        setUserUpdates((prev) => {
            const current = prev[userId]?.ecas || [];
            const next = current.includes(activityName)
                ? current.filter(a => a !== activityName)
                : [...current, activityName];
            return {
                ...prev,
                [userId]: {
                    ...prev[userId],
                    ecas: next,
                },
            };
        });
    };

    const applyGlobalClass = () => {
        if (!globalClass) return;
        const newUpdates = { ...userUpdates };
        selectedUsers.forEach((user) => {
            if (newUpdates[user.id]) {
                newUpdates[user.id] = {
                    ...newUpdates[user.id],
                    class: globalClass,
                };
            }
        });
        setUserUpdates(newUpdates);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        try {
            const updates = selectedUsers.map((user) => {
                const item = userUpdates[user.id];
                const rawNum = item.classNumber.trim();
                const parsedNum = rawNum === '' ? null : parseInt(rawNum, 10);
                return {
                    id: user.id,
                    display_name: item.display_name.trim(),
                    class: item.class.trim() === '' ? null : item.class.trim(),
                    classNumber: isNaN(parsedNum as any) ? null : parsedNum,
                    spellingLevel: item.spelling_level,
                    readingRearrangingLevel: item.reading_rearranging_level,
                    readingProofreadingLevel: item.reading_proofreading_level,
                    memorizationLevel: item.memorization_level,
                    proofreadingLevel: item.proofreading_level,
                    ecas: item.ecas,
                };
            });

            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const { data, error: fnError } = await supabase.functions.invoke("user-management/bulk-update-users", {
                headers: {
                    'Authorization': `Bearer ${session?.access_token || anonKey}`,
                    'apikey': anonKey
                },
                body: {
                    adminUserId,
                    updates,
                }
            });

            if (fnError) throw fnError;
            if (data?.error) throw new Error(data.error);

            // Direct DB update safety net
            for (const update of updates) {
                await supabase
                    .from('users')
                    .update({
                        display_name: update.display_name || null,
                        class: update.class || null,
                        class_number: update.classNumber,
                        spelling_level: update.spellingLevel,
                        reading_rearranging_level: update.readingRearrangingLevel,
                        reading_proofreading_level: update.readingProofreadingLevel,
                        memorization_level: update.memorizationLevel,
                        proofreading_level: update.proofreadingLevel,
                        ecas: update.ecas,
                    })
                    .eq('id', update.id);
            }

            setSuccess(true);
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (err: any) {
            console.error("Bulk update error:", err);
            setError(err.message || "批量更新失敗");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))] bg-indigo-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
                            <Users className="w-6 h-6 text-indigo-600" />
                            批量編輯用戶 ({selectedUsers.length})
                        </h2>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            您正在同時修改 {selectedUsers.length} 位學生的姓名、班別、學號、學習等級（每個 aspect 單選 Check Box）與課外活動
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-white transition-colors"
                    >
                        <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    </button>
                </div>

                {/* Global actions */}
                <div className="p-3.5 bg-slate-50 border-b border-[hsl(var(--border))] flex items-end gap-4">
                    <div className="flex-1 max-w-xs">
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                            快速設置班別 (套用至全部)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={globalClass}
                                onChange={(e) => setGlobalClass(e.target.value)}
                                placeholder="例如: 1A"
                                className="flex-1 px-3 py-1.5 rounded-lg border border-[hsl(var(--input))] bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button
                                onClick={applyGlobalClass}
                                disabled={!globalClass.trim()}
                                className="px-4 py-1.5 bg-indigo-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                            >
                                套用
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {error && (
                        <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-3 border border-red-100">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-4 rounded-xl bg-green-50 text-green-600 text-sm flex items-center gap-3 border border-green-100">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            更新成功！正在關閉...
                        </div>
                    )}

                    <div className="border border-[hsl(var(--border))] rounded-xl overflow-hidden bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 border-b border-[hsl(var(--border))]">
                                    <tr>
                                        <th className="px-3 py-3 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-10 text-center">#</th>
                                        <th className="px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] min-w-[130px]">帳號 (User)</th>
                                        <th className="px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] min-w-[140px]">顯示名稱</th>
                                        <th className="px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] w-24">班別</th>
                                        <th className="px-3 py-3 font-bold text-slate-600 uppercase tracking-wider text-[11px] w-16 text-center">學號</th>
                                        <th className="px-3 py-2.5 font-bold text-indigo-700 uppercase tracking-wider text-[11px] min-w-[110px] text-center bg-indigo-50/50 border-l border-indigo-100">
                                            Spelling<br/><span className="text-[10px] font-normal text-indigo-500">L1 / L2 (單選)</span>
                                        </th>
                                        <th className="px-3 py-2.5 font-bold text-purple-700 uppercase tracking-wider text-[11px] min-w-[110px] text-center bg-purple-50/50 border-l border-purple-100">
                                            Unscramble<br/><span className="text-[10px] font-normal text-purple-500">L1 / L2 (單選)</span>
                                        </th>
                                        <th className="px-3 py-2.5 font-bold text-pink-700 uppercase tracking-wider text-[11px] min-w-[140px] text-center bg-pink-50/50 border-l border-pink-100">
                                            Read-Proof<br/><span className="text-[10px] font-normal text-pink-500">L1 / L2 / L3 (單選)</span>
                                        </th>
                                        <th className="px-3 py-2.5 font-bold text-emerald-700 uppercase tracking-wider text-[11px] min-w-[140px] text-center bg-emerald-50/50 border-l border-emerald-100">
                                            Memorize<br/><span className="text-[10px] font-normal text-emerald-500">L1 / L2 / L3 (單選)</span>
                                        </th>
                                        <th className="px-3 py-2.5 font-bold text-amber-700 uppercase tracking-wider text-[11px] min-w-[110px] text-center bg-amber-50/50 border-l border-amber-100">
                                            Proofread<br/><span className="text-[10px] font-normal text-amber-500">L1 / L2 (單選)</span>
                                        </th>
                                        <th className="px-3 py-2.5 font-bold text-blue-700 uppercase tracking-wider text-[11px] min-w-[180px] bg-blue-50/50 border-l border-blue-100">
                                            課外活動 (ECAs)<br/><span className="text-[10px] font-normal text-blue-500">多選 (CHECK BOX)</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[hsl(var(--border))]">
                                    {selectedUsers.map((user, idx) => {
                                        const update = userUpdates[user.id] || {
                                            display_name: user.display_name || "",
                                            class: user.class_name || "",
                                            classNumber: user.class_number ? user.class_number.toString() : "",
                                            spelling_level: user.spelling_level || 1,
                                            reading_rearranging_level: user.reading_rearranging_level || 1,
                                            reading_proofreading_level: user.reading_proofreading_level || 1,
                                            memorization_level: user.memorization_level || 1,
                                            proofreading_level: user.proofreading_level || 1,
                                            ecas: user.ecas || []
                                        };
                                        return (
                                            <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-3 py-2 text-xs text-slate-400 font-mono text-center">{idx + 1}</td>
                                                <td className="px-3 py-2">
                                                    <div className="font-medium text-slate-600 truncate max-w-[140px]" title={user.email}>
                                                        {user.email}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={update.display_name}
                                                        onChange={(e) => handleUpdateUser(user.id, "display_name", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                                        placeholder="顯示名稱"
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="text"
                                                        value={update.class}
                                                        onChange={(e) => handleUpdateUser(user.id, "class", e.target.value)}
                                                        className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-sm font-bold text-blue-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                                        placeholder="e.g. 1A"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="99"
                                                        value={update.classNumber}
                                                        onChange={(e) => handleUpdateUser(user.id, "classNumber", e.target.value)}
                                                        className="w-14 px-1.5 py-1.5 rounded-md border border-slate-200 bg-white text-sm font-mono text-center font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow mx-auto block"
                                                        placeholder="1-99"
                                                    />
                                                </td>

                                                {/* Spelling - Single Select Checkbox */}
                                                <td className="px-2 py-2 text-center bg-indigo-50/20 border-l border-indigo-100">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {[1, 2].map(lv => (
                                                            <label
                                                                key={lv}
                                                                className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md border text-xs cursor-pointer select-none transition-all ${
                                                                    update.spelling_level === lv
                                                                        ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={update.spelling_level === lv}
                                                                    onChange={() => handleUpdateUser(user.id, "spelling_level", lv)}
                                                                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                />
                                                                <span>L{lv}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Unscramble - Single Select Checkbox */}
                                                <td className="px-2 py-2 text-center bg-purple-50/20 border-l border-purple-100">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {[1, 2].map(lv => (
                                                            <label
                                                                key={lv}
                                                                className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md border text-xs cursor-pointer select-none transition-all ${
                                                                    update.reading_rearranging_level === lv
                                                                        ? 'bg-purple-600 border-purple-600 text-white font-bold shadow-xs'
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={update.reading_rearranging_level === lv}
                                                                    onChange={() => handleUpdateUser(user.id, "reading_rearranging_level", lv)}
                                                                    className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                                />
                                                                <span>L{lv}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Read-Proof - Single Select Checkbox */}
                                                <td className="px-2 py-2 text-center bg-pink-50/20 border-l border-pink-100">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {[1, 2, 3].map(lv => (
                                                            <label
                                                                key={lv}
                                                                className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md border text-xs cursor-pointer select-none transition-all ${
                                                                    update.reading_proofreading_level === lv
                                                                        ? 'bg-pink-600 border-pink-600 text-white font-bold shadow-xs'
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-pink-300'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={update.reading_proofreading_level === lv}
                                                                    onChange={() => handleUpdateUser(user.id, "reading_proofreading_level", lv)}
                                                                    className="w-3.5 h-3.5 rounded text-pink-600 focus:ring-pink-500 cursor-pointer"
                                                                />
                                                                <span>L{lv}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Memorize - Single Select Checkbox */}
                                                <td className="px-2 py-2 text-center bg-emerald-50/20 border-l border-emerald-100">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {[1, 2, 3].map(lv => (
                                                            <label
                                                                key={lv}
                                                                className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md border text-xs cursor-pointer select-none transition-all ${
                                                                    update.memorization_level === lv
                                                                        ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs'
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={update.memorization_level === lv}
                                                                    onChange={() => handleUpdateUser(user.id, "memorization_level", lv)}
                                                                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                                />
                                                                <span>L{lv}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Proofread - Single Select Checkbox */}
                                                <td className="px-2 py-2 text-center bg-amber-50/20 border-l border-amber-100">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {[1, 2].map(lv => (
                                                            <label
                                                                key={lv}
                                                                className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-md border text-xs cursor-pointer select-none transition-all ${
                                                                    update.proofreading_level === lv
                                                                        ? 'bg-amber-600 border-amber-600 text-white font-bold shadow-xs'
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={update.proofreading_level === lv}
                                                                    onChange={() => handleUpdateUser(user.id, "proofreading_level", lv)}
                                                                    className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                                                />
                                                                <span>L{lv}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Extracurricular Activities - Checkboxes */}
                                                <td className="px-2 py-2 bg-blue-50/20 border-l border-blue-100">
                                                    <div className="flex flex-wrap gap-1 min-w-[150px] max-w-[280px]">
                                                        {allActivitiesList.length === 0 ? (
                                                            <span className="text-xs text-slate-400 italic">無活動</span>
                                                        ) : (
                                                            allActivitiesList.map(activityName => {
                                                                const isChecked = (update.ecas || []).includes(activityName);
                                                                return (
                                                                    <label
                                                                        key={activityName}
                                                                        title={activityName}
                                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs cursor-pointer select-none transition-all ${
                                                                            isChecked
                                                                                ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-xs'
                                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                                                                        }`}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={() => handleToggleEca(user.id, activityName)}
                                                                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                        />
                                                                        <span className="truncate max-w-[100px]">{activityName}</span>
                                                                    </label>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-[hsl(var(--border))] bg-slate-50 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || success}
                        className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                正在儲存...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                儲存變更
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
