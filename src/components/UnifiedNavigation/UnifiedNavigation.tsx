import React from 'react';
import { useNavigate } from 'react-router-dom';
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
    Smartphone,
    Activity,
    Camera,
    QrCode,
    FileText,
    Crown,
    Image as ImageIcon,
    Volume2,
} from 'lucide-react';
import { PageType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useNavigationSettings } from '@/context/NavigationSettingsContext';
import { NavSection, NavItem, NavSubHeader } from './NavSection';

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
    const { user, signOut, toggleViewMode, isUserView, isAdmin, isStaff, isMobileEmulator, setIsMobileEmulator, realIsSuperAdmin } = useAuth();
    const { isItemVisible } = useNavigationSettings();
    const navigate = useNavigate();
    const isInCommunity = currentPage === 'learningHub';

    return (
        <>
            {/* Mobile Overlay */}
            {isNavOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden glass-effect"
                    onClick={onToggle}
                />
            )}

            <nav
                className={`fixed top-0 left-0 h-full bg-gradient-to-b from-white via-orange-50/30 to-pink-50/30 border-r border-orange-100 z-50 shadow-lg transition-all duration-300 flex flex-col 
                ${isMobileEmulator ? 'hidden' : ''}
                ${isNavOpen ? 'w-64 translate-x-0' : 'w-0 md:w-20 -translate-x-full md:translate-x-0'}
                `}
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

                {/* Header - Only visible on main pages */}
                {['classDashboard', 'new'].includes(currentPage) && (
                    <div 
                        className={`p-4 border-b border-orange-100 cursor-pointer hover:bg-orange-50/50 transition-colors ${isNavOpen ? 'px-5' : 'px-2'}`}
                        onClick={() => onPageChange(isStaff ? 'classDashboard' : 'new')}
                    >
                        {isNavOpen ? (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-400 rounded-xl flex items-center justify-center shadow-md">
                                    <Heart size={20} className="text-white" fill="white" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                                        Learning Hub
                                    </h1>
                                </div>
                            </div>
                        ) : (
                            <div className="w-12 h-12 mx-auto bg-gradient-to-br from-orange-400 to-pink-400 rounded-xl flex items-center justify-center shadow-md">
                                <Heart size={22} className="text-white" fill="white" />
                            </div>
                        )}
                    </div>
                )}

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
                        {isStaff && isItemVisible('classDashboard') && (
                            <NavItem
                                icon={LayoutGrid}
                                label="Class Dashboard"
                                isActive={currentPage === 'classDashboard'}
                                onClick={() => onPageChange('classDashboard')}
                            />
                        )}
                        {isItemVisible('new') && (
                            <NavItem
                                icon={Home}
                                label="Paragraph Memorization"
                                isActive={currentPage === 'new'}
                                onClick={() => onPageChange('new')}
                            />
                        )}
                        {isItemVisible('proofreading') && (
                            <NavItem
                                icon={FileEdit}
                                label="Proofreading Exercise"
                                isActive={currentPage === 'proofreading'}
                                onClick={() => onPageChange('proofreading')}
                            />
                        )}

                        {isItemVisible('spelling') && (
                            <NavItem
                                icon={Mic}
                                label="Spelling Practice"
                                isActive={currentPage === 'spelling'}
                                onClick={() => onPageChange('spelling')}
                            />
                        )}

                        {isItemVisible('spacedRepetition') && (
                            <NavItem
                                icon={Zap}
                                label="Spaced Repetition"
                                isActive={currentPage === 'spacedRepetition'}
                                onClick={() => onPageChange('spacedRepetition')}
                            />
                        )}

                        {isItemVisible('readingComprehension') && (
                            <NavItem
                                icon={BookOpen}
                                label="Reading Practice"
                                isActive={currentPage === 'readingComprehension'}
                                onClick={() => onPageChange('readingComprehension')}
                            />
                        )}
                        {user && isItemVisible('wordSnake') && (
                            <NavItem
                                icon={Tablet}
                                label="iPad Interactive Zone"
                                isActive={currentPage === 'wordSnake'}
                                onClick={() => onPageChange('wordSnake')}
                            />
                        )}
                        {user && (user.can_access_learning_hub || user.role === 'admin') && isItemVisible('learningHub') && (
                            <NavItem
                                icon={Building2}
                                label="My Learning Community"
                                isActive={currentPage === 'learningHub'}
                                onClick={() => onPageChange('learningHub')}
                            />
                        )}
                        {isItemVisible('notionHub') && (
                            <NavItem
                                icon={BookOpen}
                                label="Notion Hub"
                                isActive={currentPage === 'notionHub'}
                                onClick={() => onPageChange('notionHub')}
                            />
                        )}
                        {isItemVisible('phonics') && (
                            <NavItem
                                icon={Users}
                                label="Phonics Sound Wall"
                                isActive={currentPage === 'phonics'}
                                onClick={() => onPageChange('phonics')}
                            />
                        )}
                        {isItemVisible('interactiveScanner') && (
                            <NavItem
                                icon={Camera}
                                label="QR Up!"
                                isActive={currentPage === 'interactiveScanner'}
                                onClick={() => {
                                    onPageChange('interactiveScanner');
                                    navigate('/qr-up/dashboard');
                                }}
                            />
                        )}
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
                            {isItemVisible('progress') && (
                                <NavItem
                                    icon={TrendingUp}
                                    label={user.role === 'admin' ? 'User Analytics' : 'Progress'}
                                    isActive={currentPage === 'progress'}
                                    onClick={() => onPageChange('progress')}
                                />
                            )}

                            {user.role !== 'admin' && isItemVisible('assignments') && (
                                <NavItem
                                    icon={ClipboardList}
                                    label="Assignments"
                                    isActive={currentPage === 'assignments'}
                                    onClick={() => onPageChange('assignments')}
                                />
                            )}
                            {isItemVisible('saved') && (
                                <NavItem
                                    icon={BookMarked}
                                    label="Saved Content"
                                    isActive={currentPage === 'saved'}
                                    onClick={() => onPageChange('saved')}
                                />
                            )}
                        </NavSection>
                    )}
                    
                    {/* Teacher Administration Section */}
                    {(isAdmin || isStaff) && !isUserView && (
                        <NavSection
                            title="Teacher Administration Tool"
                            icon={PenTool}
                            iconColor="text-orange-500"
                            bgColor="bg-orange-50"
                            isCollapsed={!isNavOpen}
                        >
                            {isItemVisible('teacherPlaceholder') && (
                                <NavItem
                                    icon={FileText}
                                    label="Exam Paper Formatter"
                                    isActive={currentPage === 'examFormatter'}
                                    onClick={() => onPageChange('examFormatter')}
                                />
                            )}
                            <NavItem
                                icon={ImageIcon}
                                label="Vocab Image Picker"
                                isActive={currentPage === 'vocabImagePicker'}
                                onClick={() => onPageChange('vocabImagePicker')}
                            />
                            <NavItem
                                icon={Volume2}
                                label="Phonics Dashboard"
                                isActive={currentPage === 'phonicsDashboard'}
                                onClick={() => onPageChange('phonicsDashboard')}
                            />
                            <NavItem
                                icon={Mic}
                                label="Audio Repository"
                                isActive={window.location.pathname === '/admin/audio-repo' || currentPage === 'audioManagement'}
                                onClick={() => {
                                    onPageChange('audioManagement');
                                    navigate('/admin/audio-repo');
                                }}
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
                            defaultOpen={true}
                            isCollapsed={!isNavOpen}
                        >
                            <NavSubHeader label="User & System" />
                            {isItemVisible('adminUsers') && (
                                <NavItem
                                    icon={Shield}
                                    label="Admin Panel"
                                    isActive={window.location.pathname === '/admin/users'}
                                    onClick={() => navigate('/admin/users')}
                                />
                            )}
                            <NavItem
                                icon={Layout}
                                label="Navigation Management"
                                isActive={window.location.pathname === '/admin/navigation'}
                                onClick={() => navigate('/admin/navigation')}
                            />
                            {isItemVisible('adminAnalytics') && (
                                <NavItem
                                    icon={TrendingUp}
                                    label="Analytics Dashboard"
                                    isActive={currentPage === 'adminAnalytics'}
                                    onClick={() => onPageChange('adminAnalytics')}
                                />
                            )}
                            {isItemVisible('userProgress') && (
                                <NavItem
                                    icon={BarChart3}
                                    label="User Stats"
                                    isActive={currentPage === 'progress'}
                                    onClick={() => onPageChange('progress')}
                                />
                            )}
                            {isItemVisible('database') && (
                                <NavItem
                                    icon={Database}
                                    label="Database"
                                    isActive={currentPage === 'database'}
                                    onClick={() => onPageChange('database')}
                                />
                            )}
                            {realIsSuperAdmin && isItemVisible('superAdmin') && (
                                <NavItem
                                    icon={Crown}
                                    label="Super Admin Panel"
                                    isActive={window.location.pathname === '/admin/super-admin-panel'}
                                    onClick={() => navigate('/admin/super-admin-panel')}
                                />
                            )}

                            <NavSubHeader label="Teaching & Records" />
                            {isItemVisible('homeworkRecord') && (
                                <NavItem
                                    icon={ClipboardList}
                                    label="Homework Record"
                                    isActive={window.location.pathname === '/admin/homework-record' || currentPage === 'adminHomeworkRecord'}
                                    onClick={() => navigate('/admin/homework-record')}
                                />
                            )}
                            <NavItem
                                icon={LayoutGrid}
                                label="Habit Tracker"
                                isActive={window.location.pathname === '/admin/homework-habit' || currentPage === 'adminHomeworkHabit' as any}
                                onClick={() => navigate('/admin/homework-habit')}
                            />
                            {isItemVisible('timetable') && (
                                <NavItem
                                    icon={Layout}
                                    label="Timetable"
                                    isActive={window.location.pathname === '/admin/timetable' || currentPage === 'adminTimetable' as any}
                                    onClick={() => navigate('/admin/timetable')}
                                />
                            )}
                            {isItemVisible('broadcast') && (
                                <NavItem
                                    icon={Layout}
                                    label="Broadcasts"
                                    isActive={window.location.pathname === '/admin/broadcast' || currentPage === 'broadcastManagement'}
                                    onClick={() => navigate('/admin/broadcast')}
                                />
                            )}
                            {isItemVisible('progressLog') && (
                                <NavItem
                                    icon={History}
                                    label="Progress Log"
                                    isActive={window.location.pathname === '/admin/progress-log' || currentPage === 'progressLog'}
                                    onClick={() => onPageChange('progressLog')}
                                />
                            )}
                            {isItemVisible('assignmentManagement') && (
                                <NavItem
                                    icon={FolderKanban}
                                    label="Assignments"
                                    isActive={currentPage === 'assignmentManagement'}
                                    onClick={() => onPageChange('assignmentManagement')}
                                />
                            )}
                            {isItemVisible('readingManagement') && (
                                <NavItem
                                    icon={BookOpen}
                                    label="Reading Practice"
                                    isActive={currentPage === 'readingComprehension'}
                                    onClick={() => onPageChange('readingComprehension')}
                                />
                            )}
                            {isItemVisible('legacyDashboard') && (
                                <NavItem
                                    icon={Activity}
                                    label="Legacy Dashboard"
                                    isActive={currentPage === 'admin'}
                                    onClick={() => onPageChange('admin')}
                                />
                            )}

                            <NavSubHeader label="Creative Studio" />
                            {isItemVisible('furnitureStudio') && (
                                <NavItem
                                    icon={PenTool}
                                    label="Furniture Studio"
                                    onClick={onOpenStudio}
                                />
                            )}
                            {isItemVisible('furnitureEditor') && (
                                <NavItem
                                    icon={Settings}
                                    label="Furniture Editor"
                                    onClick={onOpenEditor}
                                />
                            )}
                            {isItemVisible('assetUploader') && (
                                <NavItem
                                    icon={Upload}
                                    label="Asset Uploader"
                                    onClick={onOpenUploader}
                                />
                            )}
                            {isItemVisible('multiFormatUpload') && (
                                <NavItem
                                    icon={FolderUp}
                                    label="Multi-format Upload"
                                    onClick={onOpenAssetUpload}
                                />
                            )}
                            {isItemVisible('spaceDesign') && (
                                <NavItem
                                    icon={Building2}
                                    label="Space Design"
                                    onClick={onOpenSpaceDesign}
                                />
                            )}
                            {isItemVisible('mapEditor') && (
                                <NavItem
                                    icon={Map}
                                    label="Map Editor"
                                    onClick={onOpenMapEditor}
                                />
                            )}
                            {isItemVisible('aiIllustrator') && (
                                <NavItem
                                    icon={Sparkles}
                                    label="AI Illustrator"
                                    isActive={currentPage === 'flowithTest'}
                                    onClick={() => onPageChange('flowithTest')}
                                />
                            )}
                            {isItemVisible('uiBuilder') && (
                                <NavItem
                                    icon={Layout}
                                    label="UI Builder"
                                    onClick={() => navigate('/admin/ui-builder')}
                                />
                            )}
                            {isItemVisible('themeDesigner') && (
                                <NavItem
                                    icon={Palette}
                                    label="Theme Designer"
                                    onClick={onOpenThemeDesigner}
                                />
                            )}
                            {isItemVisible('avatarBuilderStudio') && (
                                <NavItem
                                    icon={User}
                                    label="Avatar Builder"
                                    isActive={currentPage === 'avatarBuilder'}
                                    onClick={() => onPageChange('avatarBuilder')}
                                />
                            )}
                            {isItemVisible('avatarAssetManager') && (
                                <NavItem
                                    icon={Sparkles}
                                    label="Avatar Assets"
                                    isActive={currentPage === 'adminAvatarUploader'}
                                    onClick={() => onPageChange('adminAvatarUploader')}
                                />
                            )}

                            <NavSubHeader label="Tools & Utilities" />
                            {isItemVisible('interactiveScannerAdmin') && (
                                <NavItem
                                    icon={Camera}
                                    label="Interactive Scanner"
                                    isActive={window.location.pathname === '/admin/interactive-scanner'}
                                    onClick={() => navigate('/admin/interactive-scanner')}
                                />
                            )}
                            {isItemVisible('markerGenerator') && (
                                <NavItem
                                    icon={QrCode}
                                    label="Marker Generator"
                                    isActive={window.location.pathname === '/admin/marker-generator'}
                                    onClick={() => navigate('/admin/marker-generator')}
                                />
                            )}
                            {isItemVisible('legacyScanner') && (
                                <NavItem
                                    icon={QrCode}
                                    label="Legacy Scanner"
                                    isActive={window.location.pathname === '/admin/scanner'}
                                    onClick={() => navigate('/admin/scanner')}
                                />
                            )}
                            {isItemVisible('groupCompetition') && (
                                <NavItem
                                    icon={Zap}
                                    label="Group Competition"
                                    isActive={currentPage === 'groupCompetition'}
                                    onClick={() => onPageChange('groupCompetition')}
                                />
                            )}
                            {isItemVisible('mobileTest') && (
                                <NavItem
                                    icon={Smartphone}
                                    label={isMobileEmulator ? "Disable Mobile" : "Mobile Test"}
                                    onClick={() => setIsMobileEmulator(!isMobileEmulator)}
                                    isActive={isMobileEmulator}
                                />
                            )}
                            <NavItem
                                icon={FileText}
                                label="Codebase Manifest"
                                isActive={window.location.pathname === '/admin/manifest'}
                                onClick={() => navigate('/admin/manifest')}
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

                            {/* Notifications */}
                            {isAdmin && !isUserView && (
                                <button
                                    onClick={onOpenNotifications}
                                    className={`w-full flex items-center gap-3 py-2.5 mb-2 rounded-xl transition-all duration-200 relative ${isNavOpen ? 'px-3' : 'justify-center'
                                        } text-gray-500 hover:bg-gray-100 hover:text-orange-600`}
                                    title="Notifications"
                                >
                                    <div className="relative">
                                        <Bell size={18} />
                                        {pendingCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse border-2 border-white">
                                                {pendingCount > 9 ? '9+' : pendingCount}
                                            </span>
                                        )}
                                    </div>
                                    {isNavOpen && <span className="text-sm font-medium">Notifications</span>}
                                </button>
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
        </>
    );
};

export default UnifiedNavigation;
