import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  BarChart3,
  MapPin,
  Palette,
  Layout,
  Map as MapIcon,
} from "lucide-react";
import { UnifiedMapEditor } from "./UnifiedMapEditor";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  icon?: React.ReactNode;
}

interface NavItem {
  path?: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

export function AdminLayout({ children, title, icon }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMapEditor, setShowMapEditor] = useState(false);

  const NAV_ITEMS: NavItem[] = [
    {
      path: "/admin/users",
      label: "用戶管理",
      icon: <Users className="w-4 h-4" />,
    },
    {
      path: "/admin/progress",
      label: "進度總覽",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      path: "/design",
      label: "空間設計中心",
      icon: <Palette className="w-4 h-4" />,
    },
    {
      label: "地圖編輯器",
      icon: <MapIcon className="w-4 h-4" />,
      onClick: () => setShowMapEditor(true),
    },
    {
      path: "/admin/ui-builder",
      label: "介面功能板",
      icon: <Layout className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex bg-[hsl(var(--background))] overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[hsl(var(--border))]">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主頁
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.path ? location.pathname === item.path : false;
            return (
              <button
                key={item.label}
                onClick={item.onClick || (() => item.path && navigate(item.path))}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                  }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[hsl(var(--border))]">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">管理員面板</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 flex items-center shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-1.5 rounded-lg bg-[hsl(var(--primary)/0.1)]">
                {icon}
              </div>
            )}
            <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {title}
            </h1>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      <UnifiedMapEditor
        isOpen={showMapEditor}
        onClose={() => setShowMapEditor(false)}
      />
    </div>
  );
}
