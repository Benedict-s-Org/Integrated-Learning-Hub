import { ProgressLog } from '@/components/admin/ProgressLog';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { History } from 'lucide-react';

export function ProgressLogPage() {
    return (
        <AdminLayout 
            title="Rewards & Consequences History" 
            icon={<History size={24} />}
            hideSidebar={true}
        >
            <div className="bg-white">
                <ProgressLog isFullPage={true} hideHeader={true} />
            </div>
        </AdminLayout>
    );
}
