import React, { useEffect, useState } from 'react';
import {
    X, Plus, Trash2, Edit2, Check, MessageSquare, Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { NotificationTemplate, NotificationType } from '@/types/notifications';

interface AdminMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (message: string, type: NotificationType, studentIds?: string[]) => void;
    students: { id: string; display_name: string }[];
}

const MESSAGE_ICON_MAP: Record<string, any> = {
    MessageSquare,
    Check,
    X,
    Plus,
    Users
};

const MESSAGE_COLOR_OPTIONS = [
    { name: 'Blue', class: 'text-blue-500 bg-blue-100' },
    { name: 'Green', class: 'text-green-500 bg-green-100' },
    { name: 'Red', class: 'text-red-500 bg-red-100' },
    { name: 'Orange', class: 'text-orange-500 bg-orange-100' },
    { name: 'Purple', class: 'text-purple-500 bg-purple-100' },
    { name: 'Gray', class: 'text-gray-500 bg-gray-100' },
];

export function AdminMessageModal({ isOpen, onClose, onSend, students }: AdminMessageModalProps) {
    const { isAdmin, user } = useAuth();
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Edit Mode State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<NotificationTemplate>>({});

    // Selection State
    const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
    const [applyToStudents, setApplyToStudents] = useState(false);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [customMessage, setCustomMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
            setApplyToStudents(false);
            setSelectedStudentIds([]);
            setSelectedTemplate(null);
        }
    }, [isOpen]);

    const fetchTemplates = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('notification_templates')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching templates:', error);
        } else {
            setTemplates(data || []);
        }
        setIsLoading(false);
    };

    const handleTemplateClick = (template: NotificationTemplate) => {
        if (isEditMode) return;
        setSelectedTemplate(template);
        setCustomMessage(template.message);
    };

    const handleSend = () => {
        if (!selectedTemplate && !customMessage) return;

        const messageToSend = customMessage || selectedTemplate?.message || '';
        const typeToSend = selectedTemplate?.type || 'neutral';

        if (applyToStudents && selectedStudentIds.length === 0) {
            alert('Please select at least one student.');
            return;
        }

        // If applying to students, we append their names for the log if it's a general note, 
        // OR we just send individually.
        // The requirement says: "admin has to select the students and the students name would be shown after the message."
        // This implies a single log message with names, OR individual messages.
        // Given the data structure (student_records), if we select students, we should probably create individual records for them?
        // BUT the user said "students name would be shown after the message".
        // Let's assume we create INDIVIDUAL records for each student (so they show in their history), 
        // AND maybe a general record? 
        // Actually, if we use `student_records`, valid `student_id` means it IS applied to them.
        // If `student_id` is JSON or Array? No, it's UUID.
        // So we must create multiple records if multiple students.
        // Update: The prompt says "If not clicked, ... admin doesn't need to select students". 
        // This implies a broadcast/system note.
        // Let's stick to: 
        // 1. Specific Students -> Create record for each `student_id`.
        // 2. No Students -> Create record with `student_id = NULL`.

        if (applyToStudents) {
            onSend(messageToSend, typeToSend, selectedStudentIds);
        } else {
            onSend(messageToSend, typeToSend, undefined);
        }
        onClose();
    };


    const handleSaveTemplate = async () => {
        if (!editForm.title || !editForm.message) return;

        try {
            const templateData = {
                title: editForm.title,
                message: editForm.message,
                type: editForm.type || 'neutral',
                icon: editForm.icon || 'MessageSquare',
                color: editForm.color || 'text-blue-500 bg-blue-100',
                created_by: user?.id
            };

            if (editingId && editingId !== 'new') {
                const { error } = await supabase
                    .from('notification_templates')
                    .update(templateData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('notification_templates')
                    .insert([templateData]);
                if (error) throw error;
            }

            setEditingId(null);
            setEditForm({});
            fetchTemplates();
        } catch (error) {
            console.error('Error saving template:', error);
            alert('Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            const { error } = await supabase
                .from('notification_templates')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchTemplates();
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const startEditing = (template?: NotificationTemplate) => {
        if (template) {
            setEditingId(template.id);
            setEditForm(template);
        } else {
            setEditingId('new');
            setEditForm({
                type: 'neutral',
                icon: 'MessageSquare',
                color: 'text-blue-500 bg-blue-100'
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {isEditMode ? 'Manage Message Presets' : 'Admin Shortcuts'}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {isEditMode ? 'Create reusable admin notes' : 'Select a message to log'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setIsEditMode(!isEditMode);
                                setSelectedTemplate(null);
                            }}
                            className={`p-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                                ${isEditMode ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                        >
                            <Edit2 size={16} />
                            {isEditMode ? 'Finish Editing' : 'Edit Presets'}
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel: Templates Grid */}
                    <div className={`flex-1 overflow-y-auto p-6 bg-gray-50/50 ${selectedTemplate && !isEditMode ? 'hidden md:block' : ''}`}>
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {isEditMode && editingId === 'new' && (
                                    <div className="col-span-full p-4 bg-white rounded-xl border-2 border-dashed border-blue-200 shadow-sm">
                                        <TemplateEditor
                                            form={editForm}
                                            onChange={setEditForm}
                                            onSave={handleSaveTemplate}
                                            onCancel={() => setEditingId(null)}
                                        />
                                    </div>
                                )}

                                {templates.map(item => (
                                    <div key={item.id} className="relative group">
                                        {editingId === item.id ? (
                                            <div className="col-span-full absolute inset-0 z-10 bg-white p-2 shadow-xl rounded-xl border border-blue-200">
                                                <TemplateEditor
                                                    form={editForm}
                                                    onChange={setEditForm}
                                                    onSave={handleSaveTemplate}
                                                    onCancel={() => setEditingId(null)}
                                                />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleTemplateClick(item)}
                                                disabled={isEditMode}
                                                className={`w-full flexflex-col items-start text-left gap-3 p-4 rounded-xl bg-white border transition-all duration-200 shadow-sm
                                                    ${isEditMode ? 'opacity-50 cursor-default' : 'hover:border-blue-300 hover:shadow-md cursor-pointer'}
                                                    ${selectedTemplate?.id === item.id ? 'ring-2 ring-blue-500 border-transparent' : 'border-gray-100'}
                                                `}
                                            >
                                                <div className="flex items-center gap-3 w-full">
                                                    <div className={`w-10 h-10 rounded-full ${item.color || 'bg-gray-100 text-gray-500'} flex items-center justify-center shrink-0`}>
                                                        {React.createElement(MESSAGE_ICON_MAP[item.icon || 'MessageSquare'] || MessageSquare, { size: 20 })}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-gray-800 text-sm truncate">{item.title}</div>
                                                        <div className="text-xs text-gray-500 truncate">{item.message}</div>
                                                    </div>
                                                </div>
                                            </button>
                                        )}

                                        {isEditMode && editingId !== item.id && (
                                            <div className="absolute top-2 right-2 flex gap-1 bg-white/90 backdrop-blur rounded-lg p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); startEditing(item); }}
                                                    className="p-1.5 hover:bg-blue-50 text-blue-600 rounded"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                    className="p-1.5 hover:bg-red-50 text-red-600 rounded"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {isEditMode && !editingId && (
                                    <button
                                        onClick={() => startEditing()}
                                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 hover:bg-blue-50 transition-all min-h-[80px]"
                                    >
                                        <Plus size={24} />
                                        <span className="font-bold text-sm">New Preset</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Configuration & Send (Only visible when template selected or on mobile) */}
                    {!isEditMode && (
                        <div className={`w-full md:w-80 bg-white border-l border-gray-100 flex flex-col ${!selectedTemplate ? 'hidden md:flex' : ''}`}>
                            <div className="p-6 flex-1 overflow-y-auto">
                                <h3 className="font-bold text-gray-800 mb-4">Configuration</h3>

                                <div className="space-y-4">
                                    {/* Selected Template Info */}
                                    {selectedTemplate ? (
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`w-6 h-6 rounded-full ${selectedTemplate.color} flex items-center justify-center`}>
                                                    {React.createElement(MESSAGE_ICON_MAP[selectedTemplate.icon || 'MessageSquare'] || MessageSquare, { size: 14 })}
                                                </div>
                                                <span className="font-bold text-blue-900 text-sm">{selectedTemplate.title}</span>
                                            </div>
                                            <p className="text-xs text-blue-700">{selectedTemplate.message}</p>
                                        </div>
                                    ) : (
                                        <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center text-gray-400 text-sm mb-4">
                                            Select a preset from the left
                                        </div>
                                    )}

                                    {/* Additional Message Input */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Message</label>
                                        <textarea
                                            value={customMessage}
                                            onChange={(e) => setCustomMessage(e.target.value)}
                                            placeholder="Add details..."
                                            className="w-full p-3 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                        />
                                    </div>

                                    {/* Student Toggle */}
                                    <div className="space-y-2 pt-4 border-t border-gray-100">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-bold text-gray-700">Apply to specific students?</label>
                                            <button
                                                onClick={() => setApplyToStudents(!applyToStudents)}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${applyToStudents ? 'bg-blue-600' : 'bg-gray-200'}`}
                                            >
                                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${applyToStudents ? 'translate-x-6' : ''}`} />
                                            </button>
                                        </div>

                                        {applyToStudents && (
                                            <div className="mt-2 border border-gray-200 rounded-lg max-h-60 overflow-y-auto p-1 bg-gray-50">
                                                {students.map(student => (
                                                    <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStudentIds.includes(student.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedStudentIds([...selectedStudentIds, student.id]);
                                                                } else {
                                                                    setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                                                                }
                                                            }}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm text-gray-700">{student.display_name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        {applyToStudents && (
                                            <p className="text-xs text-gray-500 text-right">
                                                {selectedStudentIds.length} students selected
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-100 bg-gray-50">
                                <button
                                    onClick={handleSend}
                                    disabled={!customMessage && !selectedTemplate}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                                >
                                    Log Message
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TemplateEditor({ form, onChange, onSave, onCancel }: any) {
    return (
        <div className="space-y-3 w-full" onClick={e => e.stopPropagation()}>
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Title</label>
                <input
                    type="text"
                    value={form.title || ''}
                    onChange={e => onChange({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Short Title"
                />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Message</label>
                <textarea
                    value={form.message || ''}
                    onChange={e => onChange({ ...form, message: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-16"
                    placeholder="Full text message..."
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                {/* Color Picker */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Color</label>
                    <div className="flex gap-1 overflow-x-auto p-1 scrollbar-none">
                        {MESSAGE_COLOR_OPTIONS.map(opt => (
                            <button
                                key={opt.name}
                                type="button"
                                onClick={() => onChange({ ...form, color: opt.class })}
                                className={`w-6 h-6 rounded-full ${opt.class} flex-shrink-0 border-2 transition-all
                                    ${form.color === opt.class ? 'border-blue-600 scale-110' : 'border-transparent'}`}
                                title={opt.name}
                            />
                        ))}
                    </div>
                </div>

                {/* Icon Picker */}
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Icon</label>
                    <div className="flex gap-1 overflow-x-auto p-1 scrollbar-none">
                        {Object.keys(MESSAGE_ICON_MAP).map(icon => (
                            <button
                                key={icon}
                                type="button"
                                onClick={() => onChange({ ...form, icon: icon })}
                                className={`p-1 rounded hover:bg-gray-100 transition-all ${form.icon === icon ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
                            >
                                {React.createElement(MESSAGE_ICON_MAP[icon] || MessageSquare, { size: 16 })}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-100">
                <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded">Cancel</button>
                <button onClick={onSave} className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
        </div>
    );
}
