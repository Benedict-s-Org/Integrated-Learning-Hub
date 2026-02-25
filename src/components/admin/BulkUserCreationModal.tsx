import { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BulkUserCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    adminUserId: string;
}

interface UserInput {
    email: string;
    password: string;
    display_name?: string;
    class?: string;
    role: 'user';
}

export function BulkUserCreationModal({ isOpen, onClose, onSuccess, adminUserId }: BulkUserCreationModalProps) {
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<{
        success: boolean;
        message: string;
        errors?: any[];
    } | null>(null);

    if (!isOpen) return null;

    const parseInput = (text: string): UserInput[] => {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // Support both comma and tab separation
                const parts = line.includes('\t') ? line.split('\t') : line.split(',');
                const [email, password, display_name, className] = parts.map(p => p?.trim() || '');

                return {
                    email: email || '',
                    password: password || '123456', // Default password if missing
                    display_name: display_name || email.split('@')[0] || '',
                    class: className || null,
                    role: 'user'
                } as UserInput;
            })
            .filter(u => u.email && u.email.includes('@'));
    };

    const handleBulkCreate = async () => {
        const users = parseInput(inputText);
        if (users.length === 0) {
            alert('請輸入用戶數據');
            return;
        }
        if (users.length > 30) {
            alert('每次最多只能建立 30 個用戶');
            return;
        }

        setIsProcessing(true);
        setResults(null);

        try {
            const response = await supabase.functions.invoke('auth/bulk-create-users', {
                body: {
                    users,
                    adminUserId
                }
            });

            if (response.error) throw response.error;

            setResults({
                success: response.data.success,
                message: response.data.message,
                errors: response.data.errors
            });

            if (response.data.success) {
                onSuccess();
            }
        } catch (err: any) {
            console.error('Bulk create error:', err);
            setResults({
                success: false,
                message: err.message || '建立用戶時發生錯誤'
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Upload size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-slate-800">批量建立用戶</h3>
                            <p className="text-sm text-slate-500">粘貼用戶列表或從 CSV 複製</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!results ? (
                        <>
                            <div className="space-y-2">
                                <div className="flex justify-between items-end mb-1">
                                    <label className="text-sm font-semibold text-slate-700">
                                        輸入內容
                                    </label>
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">格式: 電郵, 密碼, 顯示名, 班別</span>
                                </div>
                                <textarea
                                    className="w-full h-64 p-4 rounded-xl border border-slate-200 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                                    placeholder="student001@school.com, 123456, John Doe, 1A&#10;student002@school.com, 123456, Jane Smith, 1A"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                            </div>

                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <ul className="list-disc list-inside space-y-1">
                                    <li>電郵地址必須唯一（用於登入）</li>
                                    <li>密碼建議至少 6 個字符（默認: 123456）</li>
                                    <li>每次最多處理 30 個用戶</li>
                                </ul>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className={`p-4 rounded-xl flex items-center gap-3 ${results.success ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                                {results.success ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                                <p className="font-bold">{results.message}</p>
                            </div>

                            {results.errors && results.errors.length > 0 && (
                                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-bold">
                                            <tr>
                                                <th className="px-4 py-2 border-b">行</th>
                                                <th className="px-4 py-2 border-b">電郵</th>
                                                <th className="px-4 py-2 border-b">錯誤原因</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.errors.map((err, i) => (
                                                <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                                                    <td className="px-4 py-2 text-slate-500">{err.line}</td>
                                                    <td className="px-4 py-2 font-medium text-slate-700">{err.email || err.username}</td>
                                                    <td className="px-4 py-2 text-red-500">{err.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <button
                                onClick={() => setResults(null)}
                                className="text-blue-600 font-bold hover:text-blue-700 text-sm flex items-center gap-1"
                            >
                                <span>← 返回修改</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition shadow-sm"
                    >
                        取消
                    </button>
                    {!results && (
                        <button
                            onClick={handleBulkCreate}
                            disabled={isProcessing || !inputText.trim()}
                            className="flex-1 py-3 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-lg shadow-blue-200"
                        >
                            {isProcessing ? '處理中...' : '確認建立'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
