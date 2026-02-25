import React, { useState, useEffect } from "react";
import { X, Loader2, Users, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UserWithProfile {
    id: string;
    email: string;
    display_name: string | null;
    class_name?: string | null;
    class_number?: number | null;
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
    const [userUpdates, setUserUpdates] = useState<Record<string, { display_name: string; class: string; classNumber: string }>>({});
    const [globalClass, setGlobalClass] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const initialUpdates: Record<string, { display_name: string; class: string; classNumber: string }> = {};
            selectedUsers.forEach((user) => {
                initialUpdates[user.id] = {
                    display_name: user.display_name || "",
                    class: user.class_name || "",
                    classNumber: user.class_number ? user.class_number.toString() : "",
                };
            });
            setUserUpdates(initialUpdates);
            setGlobalClass("");
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, selectedUsers]);

    const handleUpdateUser = (userId: string, field: "display_name" | "class" | "classNumber", value: string) => {
        setUserUpdates((prev) => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                [field]: value,
            },
        }));
    };

    const applyGlobalClass = () => {
        if (!globalClass) return;
        const newUpdates = { ...userUpdates };
        selectedUsers.forEach((user) => {
            newUpdates[user.id] = {
                ...newUpdates[user.id],
                class: globalClass,
            };
        });
        setUserUpdates(newUpdates);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);

        try {
            const updates = selectedUsers.map((user) => ({
                id: user.id,
                display_name: userUpdates[user.id].display_name,
                class: userUpdates[user.id].class,
                classNumber: userUpdates[user.id].classNumber,
            }));

            const { data, error: fnError } = await supabase.functions.invoke("auth/bulk-update-users", {
                body: {
                    adminUserId,
                    updates,
                },
            });

            if (fnError) throw fnError;
            if (data?.error) throw new Error(data.error);

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
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[hsl(var(--border))] bg-indigo-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
                            <Users className="w-6 h-6 text-indigo-600" />
                            批量編輯用戶 ({selectedUsers.length})
                        </h2>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                            您正在同時修改 {selectedUsers.length} 位學生的資料
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
                <div className="p-4 bg-slate-50 border-b border-[hsl(var(--border))] flex items-end gap-4">
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
                                className="flex-1 px-3 py-2 rounded-lg border border-[hsl(var(--input))] bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button
                                onClick={applyGlobalClass}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                            >
                                套用
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-1/4">帳號 (User Name)</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-1/4">顯示名稱 (Display Name)</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-1/4">班別 (Class)</th>
                                        <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-[11px] w-1/4">學號 (Class Number)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[hsl(var(--border))]">
                                    {selectedUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-2">
                                                <div className="font-medium text-slate-600 truncate max-w-[200px]" title={user.email}>
                                                    {user.email}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={userUpdates[user.id]?.display_name || ""}
                                                    onChange={(e) => handleUpdateUser(user.id, "display_name", e.target.value)}
                                                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                                    placeholder="顯示名稱"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={userUpdates[user.id]?.class || ""}
                                                    onChange={(e) => handleUpdateUser(user.id, "class", e.target.value)}
                                                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                                    placeholder="e.g. 1A"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="99"
                                                    value={userUpdates[user.id]?.classNumber || ""}
                                                    onChange={(e) => handleUpdateUser(user.id, "classNumber", e.target.value)}
                                                    className="w-full px-3 py-1.5 rounded-md border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                                    placeholder="1-99"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[hsl(var(--border))] bg-slate-50 flex items-center justify-end gap-3">
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
