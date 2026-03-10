import { useEffect, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../context/AuthContext';
import { RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AuditLog {
    id: string;
    entity_table: string;
    entity_id: string;
    action: string;
    old_data: any;
    new_data: any;
    actor_user_id: string;
    actor_role: string;
    reason: string;
    reverted_at: string | null;
    reverted_by: string | null;
    created_at: string;
}

export function AuditLogsPage() {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isReverting, setIsReverting] = useState<string | null>(null);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
            return;
        }
        fetchLogs();
    }, [isAdmin, navigate]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            alert('Failed to load audit logs.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevert = async (id: string) => {
        if (!window.confirm('Are you sure you want to revert this action?')) return;

        setIsReverting(id);
        try {
            const { error } = await (supabase as any).rpc('revert_audited_change', {
                p_audit_id: id
            });

            if (error) throw error;

            alert('Change reverted successfully.');
            await fetchLogs();
        } catch (error: any) {
            console.error('Error reverting change:', error);
            alert(`Failed to revert: ${error.message}`);
        } finally {
            setIsReverting(null);
        }
    };

    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 pt-20">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <RotateCcw className="text-blue-600" />
                            Audit Logs & Revert System
                        </h1>
                        <p className="text-slate-500 mt-1">
                            View recent actions taken by Class Staff and Administrators.
                        </p>
                    </div>
                    <button
                        onClick={fetchLogs}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                        Refresh Logs
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Action</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Entity</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Actor</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Created</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500 animate-pulse">
                                            Loading logs...
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                            No audit logs found.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {log.reverted_at ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                                                        <AlertCircle size={14} /> Reverted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                                                        <CheckCircle size={14} /> Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-slate-900 capitalize">
                                                    {log.action}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                                                    {log.reason || 'No specific reason'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-slate-600">
                                                {log.entity_table}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm">
                                                    {log.actor_role}
                                                    {/* We can fetch their actual name separately if needed, but ID and role suffice for now */}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    disabled={!!log.reverted_at || isReverting === log.id}
                                                    onClick={() => handleRevert(log.id)}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ml-auto transition-colors ${log.reverted_at || isReverting === log.id
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                                        }`}
                                                >
                                                    <RotateCcw size={14} />
                                                    {isReverting === log.id ? 'Reverting...' : 'Revert'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
