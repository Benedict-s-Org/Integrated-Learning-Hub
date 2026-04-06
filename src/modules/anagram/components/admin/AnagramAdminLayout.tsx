import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  ClipboardList, 
  Database, 
  Settings, 
  Eye,
  Menu,
  Brain
} from 'lucide-react';
import { useAuth } from "../../../../context/AuthContext";
interface Props {
  activeTab: string;
  setActiveTab: (id: string) => void;
  onPreview: () => void;
  children: React.ReactNode;
}

export default function AnagramAdminLayout({ activeTab, setActiveTab, onPreview, children }: Props) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isMobileEmulator } = useAuth();

  const categories = [
    {
      label: "Overview",
      items: [
        { id: 'manifest', label: 'Project Manifest', icon: LayoutDashboard },
        { id: 'questions', label: 'Question Bank', icon: Database },
      ]
    },
    {
      label: "Content Editing",
      items: [
        { id: 'welcome', label: 'Welcome & Consent', icon: FileText },
        { id: 'demographics', label: 'Demographics', icon: ClipboardList },
        { id: 'trial', label: 'Trial Part', icon: FileText },
        { id: 'predict1', label: 'Task 1 Prediction', icon: Brain },
        { id: 'feedback1', label: 'Task 1 Feedback', icon: ClipboardList },
        { id: 'predict2', label: 'Task 2 Prediction', icon: Brain },
        { id: 'feedback2', label: 'Task 2 Feedback', icon: ClipboardList },
        { id: 'survey', label: 'Post-Experiment Survey', icon: ClipboardList },
        { id: 'debrief', label: 'Debrief & Data Viz', icon: LayoutDashboard },
      ]
    }
  ];

  const SidebarContent = () => (
    <>
      <div className="p-8 border-b border-primary/10">
        <button
          onClick={onPreview}
          className="group flex items-center gap-3 text-primary/60 hover:text-primary transition-all text-sm font-black"
        >
          <div className="p-2 rounded-full bg-white group-hover:scale-110 transition-transform shadow-sm">
            <Eye className="w-5 h-5" />
          </div>
          Preview Experiment
        </button>
      </div>

      <nav className="flex-1 p-6 space-y-8 overflow-y-auto w-full custom-scrollbar">
        {categories.map((category) => (
          <div key={category.label} className="space-y-3">
            <h3 className="px-4 text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">
              {category.label}
            </h3>
            <div className="space-y-2">
              {category.items.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-xs font-black transition-all transform active:scale-95 ${isActive
                      ? "bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]"
                      : "text-primary/60 hover:bg-white hover:text-primary hover:shadow-md"
                    }`}
                  >
                    <div className={`${isActive ? "text-white" : "text-primary/20 group-hover:text-primary"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-8 border-t border-primary/10 bg-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white text-xl">
            <Settings size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-primary uppercase tracking-widest">Anagram Admin</p>
            <p className="text-[10px] text-primary/40 font-bold">Control Center v2.2</p>
          </div>
        </div>
      </div>
    </>
  );

  const activeLabel = categories.flatMap(c => c.items).find(n => n.id === activeTab)?.label;

  return (
    <div className="min-h-screen flex bg-background relative font-bold text-left overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Desktop Sidebar */}
      <aside className={`${isMobileEmulator ? 'hidden' : 'hidden md:flex'} w-64 border-r-4 border-white bg-secondary/30 backdrop-blur-md flex-col shrink-0 sticky top-0 h-screen z-10 shadow-xl shadow-primary/5`}>
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden">
        {/* Header */}
        <header className="h-16 md:h-24 border-b-4 border-white bg-white/40 backdrop-blur-sm px-4 md:px-10 flex items-center shrink-0 justify-between md:justify-start gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 md:gap-5">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={`${isMobileEmulator ? 'flex' : 'md:hidden'} p-2 rounded-xl bg-white hover:bg-white/80 text-primary shadow-sm hover:shadow transition-all`}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden md:block p-4 rounded-3xl bg-primary shadow-lg shadow-primary/20 text-white animate-sway-gentle">
              <Brain className="w-6 h-6" />
            </div>
            
            <h1 className="text-lg md:text-3xl font-black text-primary tracking-tight truncate">
              {activeLabel}
            </h1>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-2">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
