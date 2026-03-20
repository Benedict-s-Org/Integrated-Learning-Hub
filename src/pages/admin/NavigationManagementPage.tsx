import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  ChevronLeft, 
  Search,
  CheckSquare,
  Square,
  Users,
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigationSettings } from '@/context/NavigationSettingsContext';
import { UserProfile } from '@/types';

export const NavigationManagementPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, updateUserPermissions } = useNavigationSettings();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClass, setFilterClass] = useState<string>('all');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [hideInactiveColumns, setHideInactiveColumns] = useState(true);


    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await (supabase
                    .from('users' as any)
                    .select('*')
                    .order('class', { ascending: true })
                    .order('class_number', { ascending: true }) as any);

                if (error) throw error;
                setUsers(data as UserProfile[]);
            } catch (err) {
                console.error('Error fetching users:', err);
                setMessage({ text: 'Failed to fetch users', type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const displayName = user.display_name || '';
            const username = user.username || '';
            const email = user.email || '';
            
            const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 email.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesClass = filterClass === 'all' || user.class === filterClass;
            return matchesSearch && matchesClass;
        });
    }, [users, searchQuery, filterClass]);

    // Flatten all nav items for columns
    const allNavColumns = useMemo(() => {
        return [
            ...settings.learning,
            ...settings.progress,
            ...settings.admin
        ];
    }, [settings]);

    const activeColumnIds = useMemo(() => {
        const activeIds = new Set<string>();
        filteredUsers.forEach(u => {
            if (u.navigation_permissions) {
                Object.entries(u.navigation_permissions).forEach(([id, checked]) => {
                    if (checked) activeIds.add(id);
                });
            }
        });
        return activeIds;
    }, [filteredUsers]);

    const navColumns = useMemo(() => {
        if (!hideInactiveColumns) return allNavColumns;
        return allNavColumns.filter(col => activeColumnIds.has(col.id));
    }, [allNavColumns, hideInactiveColumns, activeColumnIds]);

    const handlePermissionChange = (userId: string, itemId: string, checked: boolean) => {
        setUsers(prev => prev.map(u => {
            if (u.id === userId) {
                const newPermissions = { ...(u.navigation_permissions || {}), [itemId]: checked };
                return { ...u, navigation_permissions: newPermissions };
            }
            return u;
        }));
    };

    const handleSelectAllColumn = (itemId: string) => {
        // Check if all filtered users have this permission
        const allChecked = filteredUsers.every(u => u.navigation_permissions?.[itemId]);
        const newValue = !allChecked;

        setUsers(prev => prev.map(u => {
            if (filteredUsers.some(fu => fu.id === u.id)) {
                return {
                    ...u,
                    navigation_permissions: { ...(u.navigation_permissions || {}), [itemId]: newValue }
                };
            }
            return u;
        }));
    };

    const handleSelectAllRow = (userId: string) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;

        const allChecked = navColumns.every(item => user.navigation_permissions?.[item.id]);
        const newValue = !allChecked;

        setUsers(prev => prev.map(u => {
            if (u.id === userId) {
                const newPermissions: Record<string, boolean> = {};
                navColumns.forEach(item => {
                    newPermissions[item.id] = newValue;
                });
                return { ...u, navigation_permissions: newPermissions };
            }
            return u;
        }));
    };

    const handleGlobalSelectAll = () => {
        const allChecked = filteredUsers.every(u => 
            navColumns.every(item => u.navigation_permissions?.[item.id])
        );
        const newValue = !allChecked;

        setUsers(prev => prev.map(u => {
            if (filteredUsers.some(fu => fu.id === u.id)) {
                const newPermissions: Record<string, boolean> = {};
                navColumns.forEach(item => {
                    newPermissions[item.id] = newValue;
                });
                return { ...u, navigation_permissions: newPermissions };
            }
            return u;
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            // Bulk update via Promise.all
            // In a real production app, you might want to only update changed users
            await Promise.all(users.map(u => updateUserPermissions(u.id, u.navigation_permissions || {})));
            setMessage({ text: 'Permissions saved successfully for all users!', type: 'success' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            console.error('Error saving permissions:', err);
            setMessage({ text: 'Failed to save some permissions. Please try again.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const classes = useMemo(() => {
        const uniqueClasses = Array.from(new Set(users.map(u => u.class).filter(Boolean)));
        return uniqueClasses.sort();
    }, [users]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
                <p className="text-gray-600 font-medium">Loading navigation matrix...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 flex flex-col">
            {/* Header Sticky */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-4 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-1 cursor-pointer" onClick={() => navigate('/admin/users')}>
                            <ChevronLeft size={16} />
                            <span className="text-sm font-medium">Back to Users</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Users className="text-orange-500" size={24} />
                            Navigation Management
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 w-48 md:w-64 transition-all"
                            />
                        </div>

                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="px-3 py-2 bg-gray-100 border-none rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-orange-500/20"
                        >
                            <option value="all">All Classes</option>
                            {classes.map(c => (
                                <option key={c} value={c!}>{c}</option>
                            ))}
                        </select>

                        <label className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl cursor-pointer hover:bg-gray-200 transition-colors">
                            <input
                                type="checkbox"
                                checked={hideInactiveColumns}
                                onChange={(e) => setHideInactiveColumns(e.target.checked)}
                                className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500/20"
                            />
                            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Hide Unchecked</span>
                        </label>

                        <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block" />

                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            <span>{isSaving ? 'Saving...' : 'Save All Changes'}</span>
                        </button>
                    </div>
                </div>

                {message && (
                    <div className={`mt-4 max-w-[1600px] mx-auto p-3 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
                        message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                        {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <p className="text-sm font-semibold">{message.text}</p>
                    </div>
                )}
            </div>

            {/* Matrix Table */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
                <div className="max-w-[1600px] mx-auto">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
                                    <tr>
                                        {/* User Column Sticky Header */}
                                        <th className="sticky left-0 z-40 bg-gray-100 px-6 py-4 min-w-[250px] border-r border-gray-200 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-gray-700">User / Item Matrix</span>
                                                <button 
                                                    onClick={handleGlobalSelectAll}
                                                    title="Select All Everything"
                                                    className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                                                >
                                                    <CheckSquare size={16} />
                                                </button>
                                            </div>
                                        </th>
                                        
                                        {/* Nav Item Column Headers */}
                                        {navColumns.map((column) => (
                                            <th key={column.id} className="px-4 py-4 min-w-[120px] text-center border-r border-gray-100">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 truncate max-w-[100px]" title={column.label}>
                                                        {column.label}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleSelectAllColumn(column.id)}
                                                        className="text-gray-400 hover:text-orange-500 transition-colors"
                                                    >
                                                        {filteredUsers.every(u => u.navigation_permissions?.[column.id]) ? (
                                                            <CheckSquare size={18} className="text-orange-500" />
                                                        ) : (
                                                            <Square size={18} />
                                                        )}
                                                    </button>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={navColumns.length + 1} className="px-6 py-20 text-center text-gray-500 italic">
                                                No users found matching your filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr key={user.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors group">
                                                {/* User Sticky Cell */}
                                                <td className="sticky left-0 z-20 bg-white group-hover:bg-orange-50 px-6 py-3 border-r border-gray-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-gray-900 line-clamp-1">{user.display_name || 'Unnamed User'}</span>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">
                                                                    {user.class || 'N/A'}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400 font-medium">#{user.class_number || '-'}</span>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleSelectAllRow(user.id)}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-orange-500"
                                                            title="Select/Deselect All for this user"
                                                        >
                                                            <CheckSquare size={14} />
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Permission Checkboxes */}
                                                {navColumns.map((column) => (
                                                    <td key={column.id} className="px-4 py-3 text-center border-r border-gray-50">
                                                        <button
                                                            onClick={() => handlePermissionChange(user.id, column.id, !user.navigation_permissions?.[column.id])}
                                                            className={`transition-all duration-200 transform 
                                                                ${user.navigation_permissions?.[column.id] ? 'scale-110' : 'scale-100 opacity-0 group-hover:opacity-100 hover:scale-105'}
                                                                ${!user.navigation_permissions?.[column.id] && !hideInactiveColumns ? 'opacity-100' : ''}
                                                            `}
                                                        >
                                                            {user.navigation_permissions?.[column.id] ? (
                                                                <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center shadow-sm">
                                                                    <div className="w-2.5 h-1 border-b-2 border-l-2 border-white -rotate-45 mb-0.5" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-5 h-5 border-2 border-gray-200 rounded group-hover:border-gray-300 transition-colors" />
                                                            )}
                                                        </button>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Legend */}
            <div className="bg-white border-t border-gray-200 p-4">
                <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-6 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded shadow-sm" />
                        <span>Visible</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border border-gray-300 rounded" />
                        <span>Hidden / Inherited (Off)</span>
                    </div>
                    <div className="ml-auto text-gray-400 normal-case tracking-normal font-medium">
                        Showing {filteredUsers.length} of {users.length} users • {navColumns.length} navigation items
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NavigationManagementPage;
