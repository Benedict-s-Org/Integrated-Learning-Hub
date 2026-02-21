import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
    Shield, Users, Search,
    ToggleLeft, ToggleRight, UserCog, Crown
} from 'lucide-react';

interface ManagedUser {
    id: string;
    username: string; // This stores the email
    display_name: string | null;
    role: 'admin' | 'user';
    class: string | null;
    managed_by_id: string | null;
    can_access_proofreading: boolean;
    can_access_spelling: boolean;
    qr_token: string | null;
    created_at: string;
}

interface AdminSummary {
    id: string;
    display_name: string | null;
    username: string;
    studentCount: number;
}

const PERMISSION_KEYS = [
    { key: 'can_access_proofreading', label: 'Proofreading', short: 'Proof' },
    { key: 'can_access_spelling', label: 'Spelling', short: 'Spell' },
] as const;

export function SuperAdminPanel() {
    const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();

    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [admins, setAdmins] = useState<AdminSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAdminFilter, setSelectedAdminFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isSuperAdmin) fetchAllUsers();
    }, [isSuperAdmin]);

    const fetchAllUsers = async () => {
        setLoading(true);
        const { data, error } = await (supabase
            .from('users')
            .select('id,username,display_name,role,class,managed_by_id,can_access_proofreading,can_access_spelling,qr_token,created_at') as any);

        if (error) {
            console.error('Error fetching users:', error);
        } else if (data) {
            const allUsers = data as ManagedUser[];
            setUsers(allUsers);

            // Build admin summaries
            const adminUsers = allUsers.filter(u => u.role === 'admin');
            const summaries: AdminSummary[] = adminUsers.map(a => ({
                id: a.id,
                display_name: a.display_name,
                username: a.username,
                studentCount: allUsers.filter(u => u.managed_by_id === a.id && u.role !== 'admin').length,
            }));
            setAdmins(summaries);
        }
        setLoading(false);
    };

    const filteredUsers = useMemo(() => {
        let result = [...users]; // Show everyone including admins, so they can edit roles
        if (selectedAdminFilter !== 'all') {
            result = result.filter(u => u.managed_by_id === selectedAdminFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(u =>
                (u.display_name || '').toLowerCase().includes(q) ||
                (u.username || '').toLowerCase().includes(q) ||
                (u.class || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [users, selectedAdminFilter, searchQuery]);

    const toggleSelection = (id: string) => {
        setSelectedUserIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedUserIds.size === filteredUsers.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
        }
    };

    const togglePermission = async (userId: string, key: string, currentValue: boolean) => {
        const newValue = !currentValue;
        // Optimistic update
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, [key]: newValue } : u));

        const { error } = await (supabase.from('users') as any).update({ [key]: newValue }).eq('id', userId);
        if (error) {
            // Revert
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, [key]: currentValue } : u));
        }
    };

    const bulkUpdatePermission = async (key: string, value: boolean) => {
        if (selectedUserIds.size === 0) return;
        setSaving(true);

        const ids = Array.from(selectedUserIds);
        // Optimistic update
        setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, [key]: value } : u));

        const { error } = await (supabase.from('users') as any).update({ [key]: value }).in('id', ids);
        if (error) {
            fetchAllUsers(); // Refetch on error
        } else {
            setSuccessMsg(`Updated ${ids.length} user(s)`);
            setTimeout(() => setSuccessMsg(''), 2000);
        }
        setSaving(false);
    };

    const bulkUpdateRole = async (newRole: 'admin' | 'user') => {
        if (selectedUserIds.size === 0) return;
        setSaving(true);
        const ids = Array.from(selectedUserIds);
        setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, role: newRole } : u));

        const { error } = await (supabase.from('users') as any).update({ role: newRole }).in('id', ids);
        if (error) fetchAllUsers();
        else {
            setSuccessMsg(`Updated ${ids.length} user(s) to ${newRole}`);
            setTimeout(() => setSuccessMsg(''), 2000);
        }
        setSaving(false);
    };

    const bulkReassignAdmin = async (newAdminId: string) => {
        if (selectedUserIds.size === 0) return;
        setSaving(true);
        const ids = Array.from(selectedUserIds);
        setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, managed_by_id: newAdminId } : u));

        const { error } = await (supabase.from('users') as any).update({ managed_by_id: newAdminId }).in('id', ids);
        if (error) fetchAllUsers();
        else {
            setSuccessMsg(`Reassigned ${ids.length} user(s)`);
            setTimeout(() => setSuccessMsg(''), 2000);
            fetchAllUsers(); // Refresh admin counts
        }
        setSaving(false);
    };

    const getAdminName = (adminId: string | null) => {
        if (!adminId) return 'Unassigned';
        const admin = admins.find(a => a.id === adminId);
        return admin?.display_name || admin?.username || 'Unknown';
    };

    if (superAdminLoading || loading) {
        return (
            <AdminLayout title="Super Admin Panel">
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                </div>
            </AdminLayout>
        );
    }

    if (!isSuperAdmin) {
        return (
            <AdminLayout title="Super Admin Panel">
                <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                    <Shield size={48} className="mb-4 text-red-400" />
                    <p className="text-xl font-bold">Access Denied</p>
                    <p className="text-sm">This page is restricted to the Super Admin.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Super Admin Panel">
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Crown className="text-amber-500" size={28} />
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">Super Admin Control Panel</h1>
                            <p className="text-sm text-gray-500">Manage all admins, users, and permissions</p>
                        </div>
                    </div>
                </div>

                {/* Admin Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {admins.map(admin => (
                        <button
                            key={admin.id}
                            onClick={() => setSelectedAdminFilter(selectedAdminFilter === admin.id ? 'all' : admin.id)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedAdminFilter === admin.id
                                ? 'border-indigo-400 bg-indigo-50 shadow-md'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <UserCog size={18} className="text-indigo-500" />
                                <span className="font-bold text-gray-900 truncate">
                                    {admin.display_name || admin.username}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Users size={14} />
                                <span>{admin.studentCount} student{admin.studentCount !== 1 ? 's' : ''}</span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or class..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none text-sm"
                        />
                    </div>
                    <select
                        value={selectedAdminFilter}
                        onChange={e => setSelectedAdminFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:border-indigo-400 outline-none"
                    >
                        <option value="all">All Admins View</option>
                        {admins.map(a => (
                            <option key={a.id} value={a.id}>{a.display_name || a.username}</option>
                        ))}
                    </select>
                    <span className="text-sm text-gray-400">{filteredUsers.length} user(s)</span>
                </div>

                {/* Bulk Actions */}
                {selectedUserIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 animate-in slide-in-from-top duration-200">
                        <span className="text-sm font-bold text-indigo-700 mr-2">
                            {selectedUserIds.size} selected
                        </span>
                        <span className="text-gray-300">|</span>
                        {PERMISSION_KEYS.map(p => (
                            <React.Fragment key={p.key}>
                                <button
                                    onClick={() => bulkUpdatePermission(p.key, true)}
                                    disabled={saving}
                                    className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors disabled:opacity-50"
                                >
                                    ✓ {p.short}
                                </button>
                                <button
                                    onClick={() => bulkUpdatePermission(p.key, false)}
                                    disabled={saving}
                                    className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                                >
                                    ✗ {p.short}
                                </button>
                            </React.Fragment>
                        ))}
                        <span className="text-gray-300">|</span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => bulkUpdateRole('admin')}
                                disabled={saving}
                                className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
                            >
                                Make Admin
                            </button>
                            <button
                                onClick={() => bulkUpdateRole('user')}
                                disabled={saving}
                                className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                Make User
                            </button>
                        </div>
                        <span className="text-gray-300">|</span>
                        <select
                            onChange={e => { if (e.target.value) bulkReassignAdmin(e.target.value); e.target.value = ''; }}
                            className="px-2 py-1.5 text-xs border border-indigo-200 rounded-lg bg-white"
                            defaultValue=""
                        >
                            <option value="" disabled>Reassign to…</option>
                            {admins.map(a => (
                                <option key={a.id} value={a.id}>{a.display_name || a.username}</option>
                            ))}
                        </select>
                    </div>
                )}

                {successMsg && (
                    <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-4 py-2 text-sm font-medium animate-in fade-in duration-200">
                        ✓ {successMsg}
                    </div>
                )}

                {/* User Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                                        onChange={selectAll}
                                        className="rounded border-gray-300"
                                    />
                                </th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Name</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Class</th>
                                <th className="px-4 py-3 text-left font-bold text-gray-600">Managed By</th>
                                {PERMISSION_KEYS.map(p => (
                                    <th key={p.key} className="px-3 py-3 text-center font-bold text-gray-600">{p.short}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedUserIds.has(u.id) ? 'bg-indigo-50/50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.has(u.id)}
                                            onChange={() => toggleSelection(u.id)}
                                            className="rounded border-gray-300"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{u.display_name || u.username}</div>
                                        <div className="text-xs text-gray-400">{u.username}</div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{u.class || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                                            <UserCog size={12} />
                                            {getAdminName(u.managed_by_id)}
                                        </span>
                                    </td>
                                    {PERMISSION_KEYS.map(p => (
                                        <td key={p.key} className="px-3 py-3 text-center">
                                            <button
                                                onClick={() => togglePermission(u.id, p.key, (u as any)[p.key])}
                                                className="transition-colors"
                                            >
                                                {(u as any)[p.key] ? (
                                                    <ToggleRight size={24} className="text-emerald-500" />
                                                ) : (
                                                    <ToggleLeft size={24} className="text-gray-300" />
                                                )}
                                            </button>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {filteredUsers.length === 0 && (
                                <tr>
                                    <td colSpan={4 + PERMISSION_KEYS.length} className="px-4 py-12 text-center text-gray-400">
                                        No users found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}
