import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  BarChart3,
  Palette,
  Layout,
  Map as MapIcon,
  AlertTriangle,
  Paintbrush,
  Menu,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NAV_ITEMS: NavItem[] = [
    {
      path: "/admin/users",
      label: "User Management",
      icon: <Users className="w-4 h-4" />,
    },
    {
      path: "/admin/progress",
      label: "Progress Overview",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      path: "/design",
      label: "Space Design",
      icon: <Palette className="w-4 h-4" />,
    },
    {
      label: "Map Editor",
      icon: <MapIcon className="w-4 h-4" />,
      onClick: () => setShowMapEditor(true),
    },
    {
      path: "/admin/ui-builder",
      label: "UI Builder",
      icon: <Layout className="w-4 h-4" />,
    },
    {
      path: "/admin/errors",
      label: "Diagnostic Errors",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      path: "/admin/theme",
      label: "Theme Design",
      icon: <Paintbrush className="w-4 h-4" />,
    },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-8 border-b border-primary/10">
        <button
          onClick={() => navigate("/")}
          className="group flex items-center gap-3 text-primary/60 hover:text-primary transition-all text-sm font-black"
        >
          <div className="p-2 rounded-full bg-white group-hover:scale-110 transition-transform shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </div>
          Back to Home
        </button>
      </div>

      <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.path ? location.pathname === item.path : false;
          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.onClick) item.onClick();
                else if (item.path) navigate(item.path);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-base font-black transition-all transform active:scale-95 ${isActive
                ? "bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]"
                : "text-primary/60 hover:bg-white hover:text-primary hover:shadow-md"
                }`}
            >
              <div className={`${isActive ? "text-white" : "text-primary/40 group-hover:text-primary"}`}>
                {item.icon}
              </div>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-8 border-t border-primary/10 bg-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white text-xl">
            ⚙️
          </div>
          <div>
            <p className="text-xs font-black text-primary uppercase tracking-widest">System Admin</p>
            <p className="text-[10px] text-primary/40 font-bold">Admin Console v2.0</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background overflow-hidden relative font-bold">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 border-r-4 border-white bg-secondary/30 backdrop-blur-md flex-col shrink-0 relative z-10 shadow-xl shadow-primary/5">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <header className="h-24 border-b-4 border-white bg-white/40 backdrop-blur-sm px-6 md:px-10 flex items-center shrink-0 justify-between md:justify-start gap-4">
          <div className="flex items-center gap-5">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-3 rounded-2xl bg-white hover:bg-white/80 text-primary shadow-sm hover:shadow transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>

            {icon && (
              <div className="hidden md:block p-4 rounded-3xl bg-primary shadow-lg shadow-primary/20 text-white animate-sway-gentle">
                {icon}
              </div>
            )}
            <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight truncate">
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
