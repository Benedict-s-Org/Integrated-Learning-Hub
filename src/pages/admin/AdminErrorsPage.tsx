import { AdminLayout } from "@/components/admin/AdminLayout";
import { ErrorKnowledgeBase } from "@/components/admin/ErrorKnowledgeBase";
import { AlertTriangle } from "lucide-react";

export default function AdminErrorsPage() {
    return (
        <AdminLayout
            title="錯誤知識庫"
            icon={<AlertTriangle className="w-6 h-6" />}
        >
            <ErrorKnowledgeBase />
        </AdminLayout>
    );
}
