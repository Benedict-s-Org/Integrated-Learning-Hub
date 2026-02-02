import React from "react";
import { Layout } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { UIBuilderPanel } from "@/components/ui-builder";

export default function AdminUIBuilderPage() {
  return (
    <AdminLayout
      title="介面功能板"
      icon={<Layout className="w-5 h-5 text-[hsl(var(--primary))]" />}
    >
      <div className="h-full">
        <UIBuilderPanel />
      </div>
    </AdminLayout>
  );
}
