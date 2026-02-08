import { AdminLayout } from "@/components/admin/AdminLayout";
import { ThemeDesigner } from "@/components/admin/ThemeDesigner";
import { Palette } from "lucide-react";

export default function AdminThemePage() {
    return (
        <AdminLayout
            title="主題設計"
            icon={<Palette className="w-6 h-6" />}
        >
            <ThemeDesigner />
        </AdminLayout>
    );
}
