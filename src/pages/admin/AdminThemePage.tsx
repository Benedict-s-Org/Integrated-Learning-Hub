import { AdminLayout } from "@/components/admin/AdminLayout";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeDesigner } from "@/components/admin/ThemeDesigner";
import { Palette } from "lucide-react";

export default function AdminThemePage() {
    return (
        <ThemeProvider>
            <AdminLayout
                title="主題設計"
                icon={<Palette className="w-6 h-6" />}
            >
                <ThemeDesigner />
            </AdminLayout>
        </ThemeProvider>
    );
}
