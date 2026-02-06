import React from "react";
import { X, Save } from "lucide-react";
import { EditorTab, SaveStatus } from "./types";

interface MapEditorShellProps {
    title: string;
    isOpen: boolean;
    onClose: () => void;

    // Header
    headerActions?: React.ReactNode;
    saveStatus?: SaveStatus;
    onSave?: () => void;

    // Sidebar
    tabs: EditorTab[];
    activeTabId: string;
    onTabChange: (id: string) => void;
    sidebarContent: React.ReactNode;

    // Main Content
    children: React.ReactNode;

    // Overlays (modals, absolute positioned elements)
    overlays?: React.ReactNode;
}

export const MapEditorShell: React.FC<MapEditorShellProps> = ({
    title,
    isOpen,
    onClose,
    headerActions,
    saveStatus = "idle",
    onSave,
    tabs,
    activeTabId,
    onTabChange,
    sidebarContent,
    children,
    overlays
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-[95vw] h-[90vh] max-w-[1600px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="border-b border-slate-700/50 bg-slate-900/80 px-4 py-3 flex items-center justify-between shrink-0">
                    <h1 className="text-xl font-bold text-white">{title}</h1>

                    <div className="flex items-center gap-4">
                        {headerActions}

                        {onSave && (
                            <button
                                onClick={onSave}
                                disabled={saveStatus === "saving"}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${saveStatus === "saved"
                                    ? "bg-green-600 text-white"
                                    : saveStatus === "error"
                                        ? "bg-red-600 text-white"
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    }`}
                            >
                                <Save className="w-4 h-4" />
                                {saveStatus === "saving" ? "儲存中..." : saveStatus === "saved" ? "已儲存" : "儲存"}
                            </button>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar */}
                    <aside className="w-72 border-r border-slate-700/50 bg-slate-900/50 overflow-y-auto shrink-0 flex flex-col">
                        {/* Panel Tabs */}
                        {tabs.length > 0 && (
                            <div className="flex border-b border-slate-700/50 overflow-x-auto scrollbar-hide shrink-0">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => onTabChange(tab.id)}
                                            className={`flex-1 min-w-[60px] px-2 py-3 text-xs font-medium transition-colors flex flex-col items-center gap-1 ${activeTabId === tab.id
                                                ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                                                : "text-slate-400 hover:text-white"
                                                }`}
                                            title={tab.label}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Panel Content */}
                        <div className="p-4 flex-1 overflow-y-auto">
                            {sidebarContent}
                        </div>
                    </aside>

                    {/* Map Preview Area */}
                    <main className="flex-1 bg-slate-950 relative overflow-hidden">
                        {children}
                    </main>
                </div>

                {/* Overlays */}
                {overlays}
            </div>
        </div>
    );
};
