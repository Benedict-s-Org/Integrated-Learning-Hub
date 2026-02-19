import React from 'react';
import {
    BookOpen,
    FileEdit,
    Mic,
    Zap,
    Bell,
    Home,
    TrendingUp,
    ClipboardList,
    BookMarked,
    Shield,
    LayoutGrid,
    FolderKanban,
    Database,
    Sparkles,
    LogOut,
    LogIn,
    ChevronLeft,
    ChevronRight,
    User,
    Settings,
    Heart,
    Building2,
    ShoppingBag,
    Globe,
    Sofa,
    MapPin,
    History,
    PenTool,
    Upload,
    Map,
    Layout,
    BarChart3,
    FolderUp,
    Palette,
    Users,
    Tablet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NavSection, NavItem } from './NavSection';

export type PageType =
    | 'new' | 'saved' | 'admin' | 'assetGenerator' | 'assetUpload' | 'database'
    | 'proofreading' | 'spelling' | 'progress' | 'assignments'
    | 'assignmentManagement' | 'proofreadingAssignments' | 'learningHub'
    | 'spacedRepetition' | 'flowithTest' | 'wordSnake' | 'classDashboard' | 'quickReward' | 'scanner' | 'notionHub' | 'phonics';

interface UnifiedNavigationProps {
    currentPage: PageType;
    onPageChange: (page: PageType) => void;
    isNavOpen: boolean;
    onToggle: () => void;
    onLogin?: () => void;
    // Community controls (when in learningHub)
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
    pendingCount?: number;
    onOpenNotifications?: () => void;
}

export const UnifiedNavigation: React.FC<UnifiedNavigationProps> = ({
    currentPage,
    onPageChange,
    isNavOpen,
    onToggle,
    onLogin,
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
    pendingCount = 0,
    onOpenNotifications,
}) => {
    const { user, signOut, toggleViewMode, isUserView, isAdmin } = useAuth();
    const isInCommunity = currentPage === 'learningHub';

    return (
        <nav
            className={`fixed top-0 left-0 h-full bg-gradient-to-b from-white via-orange-50/30 to-pink-50/30 border-r border-orange-100 z-50 shadow-lg transition-all duration-300 hidden md:flex flex-col ${isNavOpen ? 'w-72' : 'w-20'
                }`}
        >
            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute -right-3 top-6 bg-white border-2 border-orange-200 rounded-full p-1.5 shadow-md hover:bg-orange-50 hover:border-orange-300 z-50 transition-all duration-200"
            >
                {isNavOpen ? (
                    <ChevronLeft size={14} className="text-orange-400" />
                ) : (
                    <ChevronRight size={14} className="text-orange-400" />
                )}
            </button>

            {/* Header */}
            <div className={`p-4 border-b border-orange-100 ${isNavOpen ? 'px-5' : 'px-2'}`}>
                {isNavOpen ? (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-400 rounded-xl flex items-center justify-center shadow-md">
                            <Heart size={20} className="text-white" fill="white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                                Mr Tsang's
                            </h1>
                            <p className="text-xs text-gray-400">Learning Hub</p>
                        </div>
                    </div>
                ) : (
                    <div className="w-12 h-12 mx-auto bg-gradient-to-br from-orange-400 to-pink-400 rounded-xl flex items-center justify-center shadow-md">
                        <Heart size={22} className="text-white" fill="white" />
                    </div>
                )}
            </div>

            {/* Navigation Content */}
            <div className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin scrollbar-thumb-orange-200">
                {/* Learning Section */}
                <NavSection
                    title="Learning"
                    icon={BookOpen}
                    iconColor="text-emerald-500"
                    bgColor="bg-emerald-50"
                    isCollapsed={!isNavOpen}
                >
                    <NavItem
                        icon={Home}
                        label="Paragraph Memorization"
                        isActive={currentPage === 'new'}
                        onClick={() => onPageChange('new')}
                    />
                    {(user?.can_access_proofreading || user?.role === 'admin') && (
                        <NavItem
                            icon={FileEdit}
                            label="Proofreading Exercise"
                            isActive={currentPage === 'proofreading'}
                            onClick={() => onPageChange('proofreading')}
                        />
                    )}
                    {user && (user.can_access_spelling || user.role === 'admin') && (
                        <NavItem
                            icon={Mic}
                            label="Spelling Practice"
                            isActive={currentPage === 'spelling'}
                            onClick={() => onPageChange('spelling')}
                        />
                    )}
                    {user && (user.can_access_spaced_repetition || user.role === 'admin') && (
                        <NavItem
                            icon={Zap}
                            label="Spaced Repetition"
                            isActive={currentPage === 'spacedRepetition'}
                            onClick={() => onPageChange('spacedRepetition')}
                        />
                    )}
                    {user && (
                        <NavItem
                            icon={Tablet}
                            label="iPad Interactive Zone"
                            isActive={currentPage === 'wordSnake'}
                            onClick={() => onPageChange('wordSnake')}
                        />
                    )}
                    {user && (user.can_access_learning_hub || user.role === 'admin') && (
                        <NavItem
                            icon={Building2}
                            label="My Learning Community"
                            isActive={currentPage === 'learningHub'}
                            onClick={() => onPageChange('learningHub')}
                        />
                    )}
                    <NavItem
                        icon={BookOpen}
                        label="Notion Hub"
                        isActive={currentPage === 'notionHub'}
                        onClick={() => onPageChange('notionHub')}
                    />
                    <NavItem
                        icon={Users}
                        label="Phonics Sound Wall"
                        isActive={currentPage === 'phonics'}
                        onClick={() => onPageChange('phonics')}
                    />
                </NavSection>

                {/* My Learning Community Section - Only visible when in community */}
                {isInCommunity && user && (
                    <NavSection
                        title="My Learning Community"
                        icon={Building2}
                        iconColor="text-amber-500"
                        bgColor="bg-amber-50"
                        isCollapsed={!isNavOpen}
                    >
                        <NavItem
                            icon={ShoppingBag}
                            label="Shop"
                            onClick={onShop}
                        />
                        <NavItem
                            icon={Building2}
                            label="City Map"
                            onClick={onCity}
                        />
                        <NavItem
                            icon={Globe}
                            label="Region Map"
                            onClick={onRegion}
                        />
                        <NavItem
                            icon={Sofa}
                            label="Furniture"
                            onClick={onOpenFurniture}
                        />
                        <NavItem
                            icon={MapPin}
                            label="Memory Points"
                            onClick={onOpenMemory}
                        />
                        <NavItem
                            icon={History}
                            label="Room History"
                            onClick={onOpenHistory}
                        />
                    </NavSection>
                )}

                {/* My Progress Section */}
                {user && (
                    <NavSection
                        title="My Progress"
                        icon={TrendingUp}
                        iconColor="text-blue-500"
                        bgColor="bg-blue-50"
                        isCollapsed={!isNavOpen}
                    >
                        <NavItem
                            icon={TrendingUp}
                            label={user.role === 'admin' ? 'User Analytics' : 'Progress'}
                            isActive={currentPage === 'progress'}
                            onClick={() => onPageChange('progress')}
                        />
                        {isAdmin && (
                            <NavItem
                                icon={LayoutGrid}
                                label="Class Dashboard"
                                isActive={currentPage === 'classDashboard'}
                                onClick={() => onPageChange('classDashboard')}
                            />
                        )}
                        {user.role !== 'admin' && (
                            <NavItem
                                icon={ClipboardList}
                                label="Assignments"
                                isActive={currentPage === 'assignments'}
                                onClick={() => onPageChange('assignments')}
                            />
                        )}
                        <NavItem
                            icon={BookMarked}
                            label="Saved Content"
                            isActive={currentPage === 'saved'}
                            onClick={() => onPageChange('saved')}
                        />
                    </NavSection>
                )}

                {/* Admin Section */}
                {isAdmin && !isUserView && (
                    <NavSection
                        title="Admin"
                        icon={Shield}
                        iconColor="text-purple-500"
                        bgColor="bg-purple-50"
                        defaultOpen={false}
                        isCollapsed={!isNavOpen}
                    >
                        {/* Previously in City Admin */}
                        <NavItem
                            icon={PenTool}
                            label="Furniture Studio"
                            onClick={onOpenStudio}
                        />
                        <NavItem
                            icon={Upload}
                            label="Asset Uploader"
                            onClick={onOpenUploader}
                        />
                        <NavItem
                            icon={Settings}
                            label="Furniture Editor"
                            onClick={onOpenEditor}
                        />
                        <NavItem
                            icon={Building2}
                            label="Space Design Center"
                            onClick={onOpenSpaceDesign}
                        />
                        <NavItem
                            icon={Map}
                            label="Map Editor"
                            onClick={onOpenMapEditor}
                        />
                        <NavItem
                            icon={Sparkles}
                            label="AI Illustrator (Flowith)"
                            isActive={currentPage === 'flowithTest'}
                            onClick={() => onPageChange('flowithTest')}
                        />
                        <NavItem
                            icon={FolderUp}
                            label="Multi-format Upload"
                            onClick={onOpenAssetUpload}
                        />
                        <NavItem
                            icon={Layout}
                            label="UI Builder"
                            onClick={() => (window.location.href = '/admin/ui-builder')}
                        />
                        <NavItem
                            icon={Palette}
                            label="Theme Designer"
                            onClick={onOpenThemeDesigner}
                        />

                        <NavItem
                            icon={Users}
                            label="User Management"
                            onClick={() => (window.location.href = '/admin/users')}
                        />
                        <NavItem
                            icon={Bell}
                            label="Notifications"
                            onClick={onOpenNotifications}
                            badge={pendingCount}
                        />

                        <div className="my-2 border-t border-purple-100 mx-2" />

                        <NavItem
                            icon={Shield}
                            label="Admin Panel"
                            isActive={currentPage === 'admin'}
                            onClick={() => onPageChange('admin')}
                        />
                        <NavItem
                            icon={FolderKanban}
                            label="Assignment Management"
                            isActive={currentPage === 'assignmentManagement'}
                            onClick={() => onPageChange('assignmentManagement')}
                        />
                        <NavItem
                            icon={Database}
                            label="Database"
                            isActive={currentPage === 'database'}
                            onClick={() => onPageChange('database')}
                        />
                        <NavItem
                            icon={BarChart3}
                            label="User Progress"
                            isActive={currentPage === 'progress'}
                            onClick={() => onPageChange('progress')}
                        />
                    </NavSection>
                )}
            </div>

            {/* Footer */}
            <div className={`border-t border-orange-100 p-4 bg-white/50 backdrop-blur-sm ${!isNavOpen && 'px-2'}`}>
                {user ? (
                    <>
                        {isNavOpen && (
                            <div className="flex items-center gap-3 mb-4 px-2">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-200 to-pink-200 rounded-full flex items-center justify-center">
                                    <User size={18} className="text-orange-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-700 truncate">
                                        {user.display_name || user.username}
                                    </p>
                                    <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                                </div>
                            </div>
                        )}

                        {/* View Mode Toggle */}
                        {(user?.role === 'admin' || isUserView) && (
                            <button
                                onClick={toggleViewMode}
                                className={`w-full flex items-center gap-3 py-2.5 mb-2 rounded-xl transition-all duration-200 ${isNavOpen ? 'px-3' : 'justify-center'
                                    } ${isUserView
                                        ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                        : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                                title={isUserView ? 'Switch to Admin' : 'Switch to User'}
                            >
                                <Settings size={18} className={isUserView ? 'animate-spin-slow' : ''} />
                                {isNavOpen && (
                                    <span className="text-sm font-medium">
                                        {isUserView ? 'Switch to Admin' : 'Switch to User'}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Sign Out */}
                        <button
                            onClick={signOut}
                            className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all duration-200 ${isNavOpen ? 'px-3' : 'justify-center'
                                }`}
                        >
                            <LogOut size={18} />
                            {isNavOpen && <span className="text-sm font-medium">Sign Out</span>}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={onLogin}
                        className={`w-full flex items-center gap-3 py-3 rounded-xl bg-gradient-to-r from-orange-400 to-pink-400 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 ${isNavOpen ? 'px-4' : 'justify-center'
                            }`}
                    >
                        <LogIn size={18} />
                        {isNavOpen && <span>Sign In</span>}
                    </button>
                )}
            </div>
        </nav>
    );
};

export default UnifiedNavigation;
