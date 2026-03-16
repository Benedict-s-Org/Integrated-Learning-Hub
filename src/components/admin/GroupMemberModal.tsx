import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { X, Search, Check, Users, Loader2 } from 'lucide-react';

interface User {
    id: string;
    display_name: string | null;
    username: string;
    class: string | null;
    ecas: string[] | null;
}

interface GroupMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    activityName: string;
    onUpdate: () => void;
}

export function GroupMemberModal({ isOpen, onClose, activityName, onUpdate }: GroupMemberModalProps) {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Tracks current selections in the modal
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen, activityName]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, display_name, username, class, ecas')
                .eq('role', 'user')
                .order('class', { ascending: true })
                .order('display_name', { ascending: true });

            if (error) throw error;

            const fetchedUsers = data as User[];
            setUsers(fetchedUsers);

            // Initialize selections based on existing ecas
            const initialSelected = new Set<string>();
            fetchedUsers.forEach(u => {
                if (u.ecas?.includes(activityName)) {
                    initialSelected.add(u.id);
                }
            });
            setSelectedUserIds(initialSelected);
        } catch (err) {
            console.error('Error fetching users for member management:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleUser = (userId: string) => {
        const newSelected = new Set(selectedUserIds);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUserIds(newSelected);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = users.map(user => {
                const isSelected = selectedUserIds.has(user.id);
                const currentlyInEca = user.ecas?.includes(activityName) || false;

                if (isSelected === currentlyInEca) return null; // No change for this user

                let newEcas = [...(user.ecas || [])];
                if (isSelected) {
                    if (!newEcas.includes(activityName)) newEcas.push(activityName);
                } else {
                    newEcas = newEcas.filter(e => e !== activityName);
                }

                return {
                    id: user.id,
                    ecas: newEcas
                };
            }).filter(Boolean);

            if (updates.length === 0) {
                onClose();
                return;
            }

            console.log('[GroupMemberModal] Sending updates:', JSON.stringify(updates, null, 2));

            const { data, error } = await supabase.functions.invoke('user-management/bulk-update-users', {
                body: {
                    adminUserId: currentUser?.id,
                    updates: updates
                }
            });

            console.log('[GroupMemberModal] Response:', JSON.stringify({ data, error }, null, 2));

            if (error) throw error;
            if (data && data.errors && data.errors.length > 0) {
                console.error("Bulk update errors:", data.errors);
                throw new Error(data.errors[0].error || "Failed to update some members");
            }

            onUpdate();
            onClose();
        } catch (err: any) {
            alert(`Failed to update members: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const filteredUsers = users.filter(u =>
    (u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.class?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Users className="text-blue-500" />
                            Manage members: {activityName}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">Select students to add to this activity</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Sub-header with search and stats */}
                <div className="p-4 bg-white border-b flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search students..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium">
                        <span className="text-slate-500">Selected:</span>
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{selectedUserIds.size} students</span>
                    </div>
                </div>

                {/* Main List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                            <Loader2 className="animate-spin text-blue-500" size={40} />
                            <p className="font-medium">Loading students...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 italic">
                            No students found matching your search.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filteredUsers.map(u => {
                                const isSelected = selectedUserIds.has(u.id);
                                return (
                                    <button
                                        key={u.id}
                                        onClick={() => toggleUser(u.id)}
                                        className={`group flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left
                                            ${isSelected
                                                ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100'
                                                : 'bg-white border-white hover:border-slate-100 hover:bg-slate-50 shadow-sm'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                                            ${isSelected
                                                ? 'bg-blue-600 border-blue-600'
                                                : 'bg-white border-slate-200 group-hover:border-blue-400'}`}>
                                            {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 truncate">{u.display_name || u.username}</div>
                                            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">{u.class || 'No Class'}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-white flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin" size={18} />
                                Saving...
                            </>
                        ) : (
                            'Save Changes'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
