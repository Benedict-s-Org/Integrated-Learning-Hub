import React, { useState, useEffect } from 'react';
import { Send, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NotificationTemplate } from '@/types/notifications';
import { NotificationTemplateModal } from './NotificationTemplateModal';
import { SendNotificationModal } from './SendNotificationModal';

interface UniversalMessageToolbarProps {
    selectedStudentIds: string[];
    onClearSelection: () => void;
    onRefresh: () => void;
}

export const UniversalMessageToolbar: React.FC<UniversalMessageToolbarProps> = ({ selectedStudentIds, onClearSelection, onRefresh }) => {
    const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
    const [isExpanded, setIsExpanded] = useState(true);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showSendModal, setShowSendModal] = useState(false);
    const [activeTemplate, setActiveTemplate] = useState<NotificationTemplate | null>(null);

    useEffect(() => {
        fetchTemplates();
    }, [showTemplateModal]); // Refresh when modal closes

    const fetchTemplates = async () => {
        const { data } = await supabase
            .from('notification_templates')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5); // Show top 5 most recent/pinned?

        if (data) setTemplates(data as NotificationTemplate[]);
    };

    const handleQuickSend = (template: NotificationTemplate) => {
        if (selectedStudentIds.length === 0) return;
        setActiveTemplate(template);
        // We could send immediately, but opening the modal with pre-filled info is safer/better UX
        setShowSendModal(true);
    };


    return (
        <>
            <div className="fixed top-0 left-0 right-0 z-40 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] transition-transform duration-300">

                {/* Toggle Handle */}
                <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] border-t-0 rounded-b-lg px-4 py-1 cursor-pointer flex items-center gap-2 text-xs font-medium text-[hsl(var(--muted-foreground))]"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {selectedStudentIds.length} Selected
                </div>

                <div className={`p-4 flex items-center gap-4 ${isExpanded ? 'h-auto' : 'h-16 overflow-hidden'}`}>

                    {/* Actions */}
                    <div className="flex items-center gap-2 border-r border-[hsl(var(--border))] pr-4">
                        <button
                            onClick={() => setShowSendModal(true)}
                            disabled={selectedStudentIds.length === 0}
                            className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[hsl(var(--primary)/0.2)]"
                        >
                            <Send className="w-4 h-4" />
                            Broadcast Message
                        </button>
                        <button
                            onClick={onClearSelection}
                            className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
                        >
                            Clear
                        </button>
                    </div>

                    {/* Quick Templates (Chips) */}
                    {isExpanded && (
                        <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {templates.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => handleQuickSend(template)}
                                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 hover:-translate-y-0.5 ${template.type === 'positive' ? 'bg-green-500/10 text-green-700 border-green-200' :
                                        template.type === 'negative' ? 'bg-red-500/10 text-red-700 border-red-200' :
                                            'bg-blue-500/10 text-blue-700 border-blue-200'
                                        }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${template.type === 'positive' ? 'bg-green-500' :
                                        template.type === 'negative' ? 'bg-red-500' : 'bg-blue-500'
                                        }`} />
                                    {template.title}
                                </button>
                            ))}
                            <button
                                onClick={() => setShowTemplateModal(true)}
                                className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-[hsl(var(--muted-foreground))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] transition-colors flex items-center gap-1"
                            >
                                <Settings className="w-3 h-3" />
                                Manage
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <NotificationTemplateModal
                isOpen={showTemplateModal}
                onClose={() => setShowTemplateModal(false)}
            />

            <SendNotificationModal
                isOpen={showSendModal}
                onClose={() => {
                    setShowSendModal(false);
                    setActiveTemplate(null);
                }}
                studentIds={selectedStudentIds}
                onSuccess={() => {
                    onRefresh();
                    onClearSelection();
                }}
                initialTemplate={activeTemplate}
            />
        </>
    );
};
