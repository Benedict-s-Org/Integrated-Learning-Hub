import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Layers, Plus, Pencil, Trash2, Save, X, Users } from 'lucide-react';
import { GroupMemberModal } from '@/components/admin/GroupMemberModal';

interface GroupItem {
    id: string;
    name: string;
}

export function AdminGroupsPage() {
    const [classes, setClasses] = useState<GroupItem[]>([]);
    const [activities, setActivities] = useState<GroupItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Edit states for classes
    const [editingClassId, setEditingClassId] = useState<string | null>(null);
    const [editClassName, setEditClassName] = useState("");
    const [newClassName, setNewClassName] = useState("");

    // Edit states for activities
    const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
    const [editActivityName, setEditActivityName] = useState("");
    const [newActivityName, setNewActivityName] = useState("");

    // Member Management Modal
    const [selectedActivityForMembers, setSelectedActivityForMembers] = useState<string | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: classesData } = await (supabase as any).from('classes').select('*').order('order_index');
            const { data: activitiesData } = await (supabase as any).from('activities').select('*').order('order_index');

            if (classesData) setClasses(classesData as GroupItem[]);
            if (activitiesData) setActivities(activitiesData as GroupItem[]);
        } catch (err) {
            console.error('Error fetching groups:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Handlers for Classes
    const handleAddClass = async () => {
        if (!newClassName.trim()) return;
        try {
            const { error } = await (supabase as any).from('classes').insert({ name: newClassName.trim() });
            if (error) throw error;
            setNewClassName("");
            fetchData();
        } catch (err: any) {
            alert(`Error adding class: ${err.message}`);
        }
    };

    const handleUpdateClass = async (id: string) => {
        if (!editClassName.trim()) return;
        try {
            const { error } = await (supabase as any).from('classes').update({ name: editClassName.trim() }).eq('id', id);
            if (error) throw error;
            setEditingClassId(null);
            fetchData();
        } catch (err: any) {
            alert(`Error updating class: ${err.message}`);
        }
    };

    const handleDeleteClass = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete class "${name}"?`)) return;
        try {
            const { error } = await (supabase as any).from('classes').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert(`Error deleting class: ${err.message}`);
        }
    };

    // Handlers for Activities
    const handleAddActivity = async () => {
        if (!newActivityName.trim()) return;
        try {
            const { error } = await (supabase as any).from('activities').insert({ name: newActivityName.trim() });
            if (error) throw error;
            setNewActivityName("");
            fetchData();
        } catch (err: any) {
            alert(`Error adding activity: ${err.message}`);
        }
    };

    const handleUpdateActivity = async (id: string) => {
        if (!editActivityName.trim()) return;
        try {
            const { error } = await (supabase as any).from('activities').update({ name: editActivityName.trim() }).eq('id', id);
            if (error) throw error;
            setEditingActivityId(null);
            fetchData();
        } catch (err: any) {
            alert(`Error updating activity: ${err.message}`);
        }
    };

    const handleDeleteActivity = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to delete activity "${name}"?`)) return;
        try {
            const { error } = await (supabase as any).from('activities').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert(`Error deleting activity: ${err.message}`);
        }
    };

    const renderTable = (
        title: string,
        items: GroupItem[],
        newItemName: string,
        setNewItemName: (val: string) => void,
        onAdd: () => void,
        editingId: string | null,
        setEditingId: (id: string | null) => void,
        editName: string,
        setEditName: (val: string) => void,
        onUpdate: (id: string) => void,
        onDelete: (id: string, name: string) => void,
        onManageMembers?: (name: string) => void
    ) => (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                <Layers className="text-blue-500" />
                {title}
            </h2>

            {/* Add New */}
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={`New ${title.slice(0, -1)} name`}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                />
                <button
                    onClick={onAdd}
                    disabled={!newItemName.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                >
                    <Plus size={18} />
                    Add
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="text-center py-8 text-slate-400">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">No {title.toLowerCase()} found.</div>
                ) : (
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                {editingId === item.id ? (
                                    <div className="flex-1 flex gap-2 mr-2">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-3 py-1.5 rounded-lg border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && onUpdate(item.id)}
                                        />
                                        <button onClick={() => onUpdate(item.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                                            <Save size={18} />
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-semibold text-slate-700">{item.name}</span>
                                        <div className="flex items-center gap-1">
                                            {onManageMembers && (
                                                <button
                                                    onClick={() => onManageMembers(item.name)}
                                                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-1 text-xs font-bold"
                                                    title="Manage Members"
                                                >
                                                    <Users size={16} />
                                                    Members
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setEditingId(item.id);
                                                    setEditName(item.name);
                                                }}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => onDelete(item.id, item.name)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <AdminLayout title="Groups & Activities" icon={<Layers className="w-6 h-6" />}>
            <div className="p-4 md:p-8 max-w-7xl mx-auto h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                    {renderTable(
                        "Classes",
                        classes,
                        newClassName,
                        setNewClassName,
                        handleAddClass,
                        editingClassId,
                        setEditingClassId,
                        editClassName,
                        setEditClassName,
                        handleUpdateClass,
                        handleDeleteClass
                    )}
                    {renderTable(
                        "Extracurricular Activities",
                        activities,
                        newActivityName,
                        setNewActivityName,
                        handleAddActivity,
                        editingActivityId,
                        setEditingActivityId,
                        editActivityName,
                        setEditActivityName,
                        handleUpdateActivity,
                        handleDeleteActivity,
                        setSelectedActivityForMembers
                    )}
                </div>
            </div>

            <GroupMemberModal
                isOpen={!!selectedActivityForMembers}
                onClose={() => setSelectedActivityForMembers(null)}
                activityName={selectedActivityForMembers || ""}
                onUpdate={fetchData}
            />
        </AdminLayout>
    );
}
