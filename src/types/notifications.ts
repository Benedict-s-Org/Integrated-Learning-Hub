export type NotificationType = 'positive' | 'neutral' | 'negative';

export interface NotificationTemplate {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    category?: string;
    icon?: string;
    color?: string;
    created_at: string;
    created_by: string;
}

export interface StudentRecord {
    id: string;
    student_id: string | null;
    type: NotificationType;
    message: string;
    created_at: string;
    created_by: string;
    is_read: boolean;
    is_internal: boolean;
}

export interface TeacherFeedback {
    type: NotificationType;
    message: string;
    template_id?: string;
}
