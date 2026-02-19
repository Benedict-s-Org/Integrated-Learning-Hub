import React, { useEffect } from 'react';
import {
    Home, FileEdit, Mic, Zap, BookOpen, Building2, Tablet, Users,
    TrendingUp, LayoutGrid, ClipboardList, BookMarked,
    Shield, PenTool, Upload, Settings, Map, Sparkles, FolderUp,
    Layout, Palette, Bell, Database, FolderKanban,
    ShoppingBag, Globe, Sofa, MapPin, History,
    LogOut, LogIn, User, X,
    LucideIcon,
} from 'lucide-react';
import { PageType } from './UnifiedNavigation';

interface MoreSheetItem {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    isActive?: boolean;
    badge?: number;
}

interface MoreSheetSection {
    title: string;
    items: MoreSheetItem[];
}

interface MobileMoreSheetProps {
    isOpen: boolean;
    onClose: () => void;
    currentPage: PageType;
    onPageChange: (page: PageType) => void;
    isAdmin: boolean;
    onLogin?: () => void;
    onSignOut?: () => void;
    userName?: string;
    userRole?: string;
    pendingCount?: number;
    onOpenNotifications?: () => void;
    // Community
    onShop?: () => void;
    onCity?: () => void;
    onRegion?: () => void;
    onOpenStudio?: () => void;
    onOpenUploader?: () => void;
    onOpenEditor?: () => void;
    onOpenSpaceDesign?: () => void;
    onOpenThemeDesigner?: () => void;
    onOpenMapEditor?: () => void;
    onOpenAssetUpload?: () => void;
    onOpenFurniture?: () => void;
    onOpenHistory?: () => void;
    onOpenMemory?: () => void;
    isUserView?: boolean;
    onToggleViewMode?: () => void;
}

export const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({
    isOpen,
    onClose,
    currentPage,
    onPageChange,
    isAdmin,
    onLogin,
    onSignOut,
    userName,
    userRole,
    pendingCount = 0,
    onOpenNotifications,
    onShop,
    onCity,
    onRegion,
    onOpenStudio,
    onOpenUploader,
    onOpenEditor,
    onOpenSpaceDesign,
    onOpenThemeDesigner,
    onOpenMapEditor,
    onOpenAssetUpload,
    onOpenFurniture,
    onOpenHistory,
    onOpenMemory,
    isUserView,
    onToggleViewMode,
}) => {
    // Lock body scroll when sheet is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Build sections
    const sections: MoreSheetSection[] = [];

    // ─── Learning Section ───────────────────────────────────────
    sections.push({
        title: 'Learning',
        items: [
            { icon: Home, label: 'Paragraph Memorization', onClick: () => onPageChange('new'), isActive: currentPage === 'new' },
            { icon: FileEdit, label: 'Proofreading Exercise', onClick: () => onPageChange('proofreading'), isActive: currentPage === 'proofreading' },
            { icon: Mic, label: 'Spelling Practice', onClick: () => onPageChange('spelling'), isActive: currentPage === 'spelling' },
            { icon: Zap, label: 'Spaced Repetition', onClick: () => onPageChange('spacedRepetition'), isActive: currentPage === 'spacedRepetition' },
            { icon: Tablet, label: 'iPad Interactive Zone', onClick: () => onPageChange('wordSnake'), isActive: currentPage === 'wordSnake' },
            { icon: Building2, label: 'My Learning Community', onClick: () => onPageChange('learningHub'), isActive: currentPage === 'learningHub' },
            { icon: BookOpen, label: 'Notion Hub', onClick: () => onPageChange('notionHub'), isActive: currentPage === 'notionHub' },
            { icon: Users, label: 'Phonics Sound Wall', onClick: () => onPageChange('phonics'), isActive: currentPage === 'phonics' },
        ],
    });

    // ─── Community Section (when in learningHub) ────────────────
    if (currentPage === 'learningHub') {
        sections.push({
            title: 'Community',
            items: [
                { icon: ShoppingBag, label: 'Shop', onClick: () => onShop?.() },
                { icon: Building2, label: 'City Map', onClick: () => onCity?.() },
                { icon: Globe, label: 'Region Map', onClick: () => onRegion?.() },
                { icon: Sofa, label: 'Furniture', onClick: () => onOpenFurniture?.() },
                { icon: MapPin, label: 'Memory Points', onClick: () => onOpenMemory?.() },
                { icon: History, label: 'Room History', onClick: () => onOpenHistory?.() },
            ],
        });
    }

    // ─── Progress Section ───────────────────────────────────────
    const progressItems: MoreSheetItem[] = [
        { icon: TrendingUp, label: isAdmin ? 'User Analytics' : 'Progress', onClick: () => onPageChange('progress'), isActive: currentPage === 'progress' },
        { icon: BookMarked, label: 'Saved Content', onClick: () => onPageChange('saved'), isActive: currentPage === 'saved' },
    ];
    if (isAdmin) {
        progressItems.push({ icon: LayoutGrid, label: 'Class Dashboard', onClick: () => onPageChange('classDashboard'), isActive: currentPage === 'classDashboard' });
    }
    if (!isAdmin) {
        progressItems.push({ icon: ClipboardList, label: 'Assignments', onClick: () => onPageChange('assignments'), isActive: currentPage === 'assignments' });
    }
    sections.push({ title: 'My Progress', items: progressItems });

    // ─── Admin Section ──────────────────────────────────────────
    if (isAdmin) {
        sections.push({
            title: 'Admin Tools',
            items: [
                { icon: Shield, label: 'Admin Panel', onClick: () => onPageChange('admin'), isActive: currentPage === 'admin' },
                { icon: FolderKanban, label: 'Assignment Management', onClick: () => onPageChange('assignmentManagement'), isActive: currentPage === 'assignmentManagement' },
                { icon: Database, label: 'Database', onClick: () => onPageChange('database'), isActive: currentPage === 'database' },
                { icon: Sparkles, label: 'AI Illustrator', onClick: () => onPageChange('flowithTest'), isActive: currentPage === 'flowithTest' },
                { icon: PenTool, label: 'Furniture Studio', onClick: () => onOpenStudio?.() },
                { icon: Upload, label: 'Asset Uploader', onClick: () => onOpenUploader?.() },
                { icon: Settings, label: 'Furniture Editor', onClick: () => onOpenEditor?.() },
                { icon: Building2, label: 'Space Design Center', onClick: () => onOpenSpaceDesign?.() },
                { icon: Map, label: 'Map Editor', onClick: () => onOpenMapEditor?.() },
                { icon: FolderUp, label: 'Multi-format Upload', onClick: () => onOpenAssetUpload?.() },
                { icon: Layout, label: 'UI Builder', onClick: () => (window.location.href = '/admin/ui-builder') },
                { icon: Palette, label: 'Theme Designer', onClick: () => onOpenThemeDesigner?.() },
                { icon: Users, label: 'User Management', onClick: () => (window.location.href = '/admin/users') },
                { icon: Bell, label: 'Notifications', onClick: () => onOpenNotifications?.(), badge: pendingCount },
            ],
        });
    }

    if (!isOpen) return null;

    return (
        <div className="md:hidden fixed inset-0 z-[60]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col"
                style={{
                    maxHeight: '85vh',
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                {/* Handle */}
                <div className="flex items-center justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-pink-400 rounded-xl flex items-center justify-center">
                            <User size={18} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">{userName || 'Guest'}</p>
                            <p className="text-xs text-gray-400 capitalize">{userRole || 'user'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                    {sections.map((section) => (
                        <div key={section.title} className="mb-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 mb-1.5">
                                {section.title}
                            </p>
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.label}
                                            onClick={item.onClick}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${item.isActive
                                                ? 'bg-orange-50 text-orange-600'
                                                : 'text-gray-700 active:bg-gray-50'
                                                }`}
                                        >
                                            <Icon size={18} />
                                            <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                                            {item.badge !== undefined && item.badge > 0 && (
                                                <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-500 rounded-full">
                                                    {item.badge}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="shrink-0 px-4 py-3 border-t border-gray-100 space-y-2">
                    {isAdmin && (
                        <button
                            onClick={onToggleViewMode}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isUserView
                                ? 'bg-purple-50 text-purple-600'
                                : 'text-gray-600 active:bg-gray-50'
                                }`}
                        >
                            <Settings size={18} />
                            {isUserView ? 'Switch to Admin' : 'Switch to User'}
                        </button>
                    )}
                    {userName ? (
                        <button
                            onClick={onSignOut}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 active:bg-red-50 active:text-red-500"
                        >
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    ) : (
                        <button
                            onClick={onLogin}
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-orange-400 to-pink-400 text-white"
                        >
                            <LogIn size={18} />
                            Sign In
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
