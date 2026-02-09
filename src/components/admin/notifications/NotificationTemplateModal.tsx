import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Save, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NotificationTemplate, NotificationType } from '@/types/notifications';
import { useAuth } from '@/context/AuthContext';

interface NotificationTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationTemplateModal: React.FC<NotificationTemplateModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [newTemplate, setNewTemplate] = useState<Partial<NotificationTemplate>>({ type: 'neutral' });

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
        }
    }, [isOpen]);

    const fetchTemplates = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('notification_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching templates:', error);
        } else {
            setTemplates(data as NotificationTemplate[]);
            // If data is empty, suggest defaults? (Optional)
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!newTemplate.title || !newTemplate.message || !newTemplate.type) return;

        const { error } = await supabase
            .from('notification_templates')
            .insert([{
                title: newTemplate.title,
                message: newTemplate.message,
                type: newTemplate.type,
                category: newTemplate.category,
                created_by: user?.id
            }]);

        if (error) {
            console.error('Error saving template:', error);
        } else {
            setNewTemplate({ type: 'neutral', title: '', message: '' });
            fetchTemplates();
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase
            .from('notification_templates')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting template:', error);
        } else {
            fetchTemplates();
        }
    };

    // Simple update logic (if needed, or just delete/re-create for simplicity in this version)
    // For now, let's keep it simple: Add and Delete. Edit can come later if requested.

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[hsl(var(--card))] w-full max-w-2xl rounded-xl border border-[hsl(var(--border))] shadow-2xl flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-[hsl(var(--primary))]" />
                        Manage Notification Templates
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-[hsl(var(--muted))] rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Add New Section */}
                    <div className="bg-[hsl(var(--muted)/0.3)] p-4 rounded-lg border border-[hsl(var(--border))] space-y-3">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Create New Template</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                type="text"
                                placeholder="Title (e.g., Great Job)"
                                value={newTemplate.title || ''}
                                onChange={e => setNewTemplate({ ...newTemplate, title: e.target.value })}
                                className="px-3 py-2 rounded-md bg-[hsl(var(--background))] border border-[hsl(var(--input))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
                            />
                            <select
                                value={newTemplate.type}
                                onChange={e => setNewTemplate({ ...newTemplate, type: e.target.value as NotificationType })}
                                className="px-3 py-2 rounded-md bg-[hsl(var(--background))] border border-[hsl(var(--input))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
                            >
                                <option value="positive">Positive (Green)</option>
                                <option value="neutral">Neutral (Blue)</option>
                                <option value="negative">Negative (Red/Orange)</option>
                            </select>
                        </div>
                        <textarea
                            placeholder="Message content..."
                            value={newTemplate.message || ''}
                            onChange={e => setNewTemplate({ ...newTemplate, message: e.target.value })}
                            className="w-full px-3 py-2 rounded-md bg-[hsl(var(--background))] border border-[hsl(var(--input))] focus:ring-2 focus:ring-[hsl(var(--ring))] min-h-[80px]"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={!newTemplate.title || !newTemplate.message || !newTemplate.type}
                                className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:opacity-90 disabled:opacity-50 transition-all font-medium"
                            >
                                <Plus className="w-4 h-4" />
                                Save Template
                            </button>
                        </div>
                    </div>

                    {/* List Section */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Existing Templates</h3>
                        {isLoading ? (
                            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">Loading...</div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-8 text-[hsl(var(--muted-foreground))] border-2 border-dashed border-[hsl(var(--border))] rounded-lg">
                                No templates created yet.
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {templates.map(template => (
                                    <div key={template.id} className="flex items-start justify-between p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg hover:shadow-md transition-all group">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`w-2 h-2 rounded-full ${template.type === 'positive' ? 'bg-green-500' :
                                                        template.type === 'negative' ? 'bg-red-500' : 'bg-blue-500'
                                                    }`} />
                                                <h4 className="font-semibold text-[hsl(var(--foreground))]">{template.title}</h4>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] uppercase">
                                                    {template.type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{template.message}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(template.id)}
                                            className="p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] rounded opacity-0 group-hover:opacity-100 transition-all"
                                            title="Delete Template"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
