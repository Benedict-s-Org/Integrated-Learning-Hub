import React, { useState } from 'react';
import { BookOpen, TrendingUp, Shield, Menu, LucideIcon } from 'lucide-react';
import { MobileMoreSheet } from './MobileMoreSheet';
import { PageType } from './UnifiedNavigation';

/* ─── Customizable Tab Configuration ─────────────────────────────────
 *  To add/remove/reorder tabs, just edit the arrays below.
 *  Each tab needs: id (unique key), icon, label, page (target PageType),
 *  and optionally adminOnly (hides tab for non-admins).
 * ──────────────────────────────────────────────────────────────────── */

export interface TabConfig {
    /** Unique identifier for this tab */
    id: string;
    /** Lucide icon component */
    icon: LucideIcon;
    /** Display label shown below the icon */
    label: string;
    /** The page to navigate to when tapped */
    page: PageType;
    /** If true, only visible when isAdmin is true */
    adminOnly?: boolean;
    /** Pages that should also highlight this tab as active */
    activePages?: PageType[];
}

// ─── DEFAULT TAB CONFIGS ────────────────────────────────────────────
// Edit these arrays to customize the bottom bar.
// Student tabs are always shown; admin tabs only when isAdmin is true.

export const DEFAULT_TABS: TabConfig[] = [
    {
        id: 'learning',
        icon: BookOpen,
        label: 'Learning',
        page: 'new',
        activePages: ['new', 'saved', 'proofreading', 'spelling', 'spacedRepetition', 'wordSnake', 'learningHub', 'notionHub', 'phonics'],
    },
    {
        id: 'progress',
        icon: TrendingUp,
        label: 'My Progress',
        page: 'progress',
        activePages: ['progress', 'assignments', 'classDashboard'],
    },
    {
        id: 'admin',
        icon: Shield,
        label: 'Admin',
        page: 'admin',
        adminOnly: true,
        activePages: ['admin', 'database', 'assignmentManagement', 'assetUpload', 'assetGenerator', 'flowithTest'],
    },
];

// ─── Component ──────────────────────────────────────────────────────

interface MobileTabBarProps {
    currentPage: PageType;
    onPageChange: (page: PageType) => void;
    isAdmin: boolean;
    /** Override default tabs with a custom config */
    tabs?: TabConfig[];
    // Pass-through props for the "More" sheet
    onLogin?: () => void;
    onSignOut?: () => void;
    userName?: string;
    userRole?: string;
    pendingCount?: number;
    onOpenNotifications?: () => void;
    // Community actions (passed to More sheet)
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

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
    currentPage,
    onPageChange,
    isAdmin,
    tabs = DEFAULT_TABS,
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
    const [isMoreOpen, setIsMoreOpen] = useState(false);

    // Filter tabs based on role
    const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

    const isTabActive = (tab: TabConfig): boolean => {
        if (currentPage === tab.page) return true;
        if (tab.activePages?.includes(currentPage)) return true;
        return false;
    };

    return (
        <>
            {/* Bottom Tab Bar */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <div className="flex items-stretch justify-around">
                    {visibleTabs.map((tab) => {
                        const Icon = tab.icon;
                        const active = isTabActive(tab);

                        return (
                            <button
                                key={tab.id}
                                onClick={() => onPageChange(tab.page)}
                                className={`flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 transition-colors duration-200 relative ${active
                                    ? 'text-orange-500'
                                    : 'text-gray-400 active:text-gray-600'
                                    }`}
                            >
                                {/* Active indicator dot */}
                                {active && (
                                    <div className="absolute top-1 w-1 h-1 rounded-full bg-orange-500" />
                                )}
                                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                                <span className={`text-[10px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>
                                    {tab.label}
                                </span>
                            </button>
                        );
                    })}

                    {/* "More" Tab */}
                    <button
                        onClick={() => setIsMoreOpen(true)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 transition-colors duration-200 relative ${isMoreOpen
                            ? 'text-orange-500'
                            : 'text-gray-400 active:text-gray-600'
                            }`}
                    >
                        <div className="relative">
                            <Menu size={22} strokeWidth={1.8} />
                            {pendingCount > 0 && (
                                <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                    {pendingCount > 9 ? '9+' : pendingCount}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] leading-tight font-medium">More</span>
                    </button>
                </div>
            </nav>

            {/* More Sheet */}
            <MobileMoreSheet
                isOpen={isMoreOpen}
                onClose={() => setIsMoreOpen(false)}
                currentPage={currentPage}
                onPageChange={(page: PageType) => {
                    onPageChange(page);
                    setIsMoreOpen(false);
                }}
                isAdmin={isAdmin}
                onLogin={onLogin}
                onSignOut={onSignOut}
                userName={userName}
                userRole={userRole}
                pendingCount={pendingCount}
                onOpenNotifications={() => { onOpenNotifications?.(); setIsMoreOpen(false); }}
                onShop={() => { onShop?.(); setIsMoreOpen(false); }}
                onCity={() => { onCity?.(); setIsMoreOpen(false); }}
                onRegion={() => { onRegion?.(); setIsMoreOpen(false); }}
                onOpenStudio={() => { onOpenStudio?.(); setIsMoreOpen(false); }}
                onOpenUploader={() => { onOpenUploader?.(); setIsMoreOpen(false); }}
                onOpenEditor={() => { onOpenEditor?.(); setIsMoreOpen(false); }}
                onOpenSpaceDesign={() => { onOpenSpaceDesign?.(); setIsMoreOpen(false); }}
                onOpenThemeDesigner={() => { onOpenThemeDesigner?.(); setIsMoreOpen(false); }}
                onOpenMapEditor={() => { onOpenMapEditor?.(); setIsMoreOpen(false); }}
                onOpenAssetUpload={() => { onOpenAssetUpload?.(); setIsMoreOpen(false); }}
                onOpenFurniture={() => { onOpenFurniture?.(); setIsMoreOpen(false); }}
                onOpenHistory={() => { onOpenHistory?.(); setIsMoreOpen(false); }}
                onOpenMemory={() => { onOpenMemory?.(); setIsMoreOpen(false); }}
                isUserView={isUserView}
                onToggleViewMode={() => { onToggleViewMode?.(); setIsMoreOpen(false); }}
            />
        </>
    );
};
