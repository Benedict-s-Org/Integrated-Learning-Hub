import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NotificationTemplate, NotificationType } from '@/types/notifications';
import { useAuth } from '@/context/AuthContext';

interface SendNotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentIds: string[];
    onSuccess: () => void;
    initialTemplate?: NotificationTemplate | null;
}

export const SendNotificationModal: React.FC<SendNotificationModalProps> = ({ isOpen, onClose, studentIds, onSuccess, initialTemplate }) => {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [activeTab, setActiveTab] = useState<'templates' | 'custom'>('templates');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<NotificationType>('neutral');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
            if (initialTemplate) {
                setMessage(initialTemplate.message);
                setType(initialTemplate.type);
                setActiveTab('custom');
            } else {
                setMessage('');
                setType('neutral');
                setActiveTab('templates');
            }
        }
    }, [isOpen, initialTemplate]);

    const fetchTemplates = async () => {
        const { data, error } = await supabase
            .from('notification_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setTemplates(data as NotificationTemplate[]);
    };

    const handleSend = async () => {
        if (!message || studentIds.length === 0) return;
        setIsSending(true);

        const records = studentIds.map(studentId => ({
            student_id: studentId,
            message: message,
            type: type,
            created_by: user?.id,
            is_read: false
        }));

        const { error } = await supabase
            .from('student_records')
            .insert(records);

        setIsSending(false);

        if (error) {
            console.error('Error sending notifications:', error);
            alert('Failed to send notifications. See console for details.');
        } else {
            onSuccess();
            onClose();
        }
    };

    const selectTemplate = (template: NotificationTemplate) => {
        setMessage(template.message);
        setType(template.type);
        // Optionally switch to custom to allow editing, or just keep it selected
        setActiveTab('custom');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[hsl(var(--card))] w-full max-w-lg rounded-xl border border-[hsl(var(--border))] shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Send className="w-5 h-5 text-[hsl(var(--primary))]" />
                        Send Message
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-[hsl(var(--muted))] rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="text-sm text-[hsl(var(--muted-foreground))] mb-2">
                        Sending to <span className="font-bold text-[hsl(var(--foreground))]">{studentIds.length}</span> student{studentIds.length !== 1 ? 's' : ''}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-[hsl(var(--border))] mb-4">
                        <button
                            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'templates' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                            onClick={() => setActiveTab('templates')}
                        >
                            Quick Templates
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'custom' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                            onClick={() => setActiveTab('custom')}
                        >
                            Custom Message
                        </button>
                    </div>

                    {activeTab === 'templates' ? (
                        <div className="space-y-2">
                            {templates.length === 0 ? (
                                <div className="text-center py-8 text-[hsl(var(--muted-foreground))] border-2 border-dashed border-[hsl(var(--border))] rounded-lg">
                                    No templates found. Switch to Custom Message or create new templates.
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    {templates.map(template => (
                                        <button
                                            key={template.id}
                                            onClick={() => selectTemplate(template)}
                                            className="text-left w-full p-3 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-all flex items-start gap-3 group"
                                        >
                                            <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${template.type === 'positive' ? 'bg-green-500' :
                                                template.type === 'negative' ? 'bg-red-500' : 'bg-blue-500'
                                                }`} />
                                            <div>
                                                <div className="font-medium">{template.title}</div>
                                                <div className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2 group-hover:text-[hsl(var(--accent-foreground)/0.8)]">
                                                    {template.message}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2 justify-center">
                                <button
                                    onClick={() => setType('positive')}
                                    className={`flex-1 py-2 rounded-md border flex items-center justify-center gap-2 transition-all ${type === 'positive' ? 'bg-green-500/20 border-green-500 text-green-700 font-bold' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`}
                                >
                                    <CheckCircle className="w-4 h-4" /> Positive
                                </button>
                                <button
                                    onClick={() => setType('neutral')}
                                    className={`flex-1 py-2 rounded-md border flex items-center justify-center gap-2 transition-all ${type === 'neutral' ? 'bg-blue-500/20 border-blue-500 text-blue-700 font-bold' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`}
                                >
                                    <HelpCircle className="w-4 h-4" /> Neutral
                                </button>
                                <button
                                    onClick={() => setType('negative')}
                                    className={`flex-1 py-2 rounded-md border flex items-center justify-center gap-2 transition-all ${type === 'negative' ? 'bg-red-500/20 border-red-500 text-red-700 font-bold' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`}
                                >
                                    <AlertCircle className="w-4 h-4" /> Negative
                                </button>
                            </div>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Type your message here..."
                                className="w-full h-32 p-3 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] focus:ring-2 focus:ring-[hsl(var(--ring))]"
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[hsl(var(--border))] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!message || isSending}
                        className="px-4 py-2 text-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 font-medium"
                    >
                        {isSending ? 'Sending...' : (
                            <>
                                <Send className="w-4 h-4" /> Send Message
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
