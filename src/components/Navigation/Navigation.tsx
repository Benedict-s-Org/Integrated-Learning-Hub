import React from 'react';
import {
  Home, Shield, FileEdit, LogOut, LogIn, Mic, TrendingUp, ClipboardList,
  Database, FolderKanban, BookMarked, Lightbulb, Zap, ChevronLeft, ChevronRight, Sparkles, Pencil, LayoutGrid
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavigationProps {
  currentPage: 'new' | 'saved' | 'admin' | 'assetGenerator' | 'database' | 'proofreading' | 'spelling' | 'progress' | 'assignments' | 'assignmentManagement' | 'proofreadingAssignments' | 'learningHub' | 'spacedRepetition' | 'flowithTest' | 'wordSnake' | 'classDashboard';
  onPageChange: (page: 'new' | 'saved' | 'admin' | 'assetGenerator' | 'database' | 'proofreading' | 'spelling' | 'progress' | 'assignments' | 'assignmentManagement' | 'proofreadingAssignments' | 'learningHub' | 'spacedRepetition' | 'flowithTest' | 'wordSnake' | 'classDashboard') => void;
  userRole: string | null;
  onLogin?: () => void;
  isNavOpen: boolean;
  onToggle: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
  currentPage,
  onPageChange,
  userRole,
  onLogin,
  isNavOpen,
  onToggle
}) => {
  const { user, signOut, toggleViewMode, isUserView } = useAuth();

  const NavItem = ({
    page,
    icon: Icon,
    label,
    onClick
  }: {
    page?: string;
    icon: any;
    label: string;
    onClick?: () => void;
  }) => (
    <button
      onClick={onClick || (() => page && onPageChange(page as any))}
      className={`flex items-center ${isNavOpen ? 'space-x-3 px-4' : 'justify-center px-2'} py-3 rounded-lg font-medium transition-colors ${page && currentPage === page
        ? 'bg-blue-600 text-white'
        : 'text-gray-700 hover:bg-gray-100'
        }`}
      title={!isNavOpen ? label : undefined}
      data-component-name="NavItem"
      data-source-file="src/components/Navigation/Navigation.tsx"
    >
      <Icon size={22} />
      {isNavOpen && <span>{label}</span>}
    </button>
  );

  return (
    <nav
      className={`fixed top-0 left-0 h-full bg-white border-r-2 border-gray-200 z-50 shadow-lg transition-all duration-300 ${isNavOpen ? 'w-64' : 'w-20'}`}
      style={{ fontFamily: 'Times New Roman, serif' }}
      data-component-name="Navigation"
      data-source-file="src/components/Navigation/Navigation.tsx"
    >
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:bg-gray-50 z-50 text-gray-500"
      >
        {isNavOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className={`flex flex-col h-full py-8 ${isNavOpen ? 'px-4' : 'px-2'}`}>
        <div className={`mb-8 ${isNavOpen ? 'px-4' : 'text-center'}`}>
          {isNavOpen ? (
            <h1 className="text-2xl font-bold text-gray-800">Memorize</h1>
          ) : (
            <h1 className="text-xl font-bold text-gray-800">M</h1>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -mr-2 pr-2 mb-4 scrollbar-thin scrollbar-thumb-gray-200">
          <div className="flex flex-col space-y-2">
            <NavItem page="new" icon={Home} label="Home" />

            {user && (
              <NavItem page="saved" icon={BookMarked} label="Saved Content" />
            )}

            {(user?.can_access_proofreading || user?.role === 'admin') && (
              <NavItem page="proofreading" icon={FileEdit} label="Proofreading Exercise" />
            )}

            {user && (user.can_access_spelling || user.role === 'admin') && (
              <NavItem page="spelling" icon={Mic} label="Spelling Practice" />
            )}

            {user && (user.can_access_learning_hub || user.role === 'admin') && (
              <NavItem page="learningHub" icon={Lightbulb} label="Integrated Learning Hub" />
            )}

            {user && (user.can_access_spaced_repetition || user.role === 'admin') && (
              <NavItem page="spacedRepetition" icon={Zap} label="Spaced Repetition" />
            )}

            {user && (
              <NavItem page="wordSnake" icon={Pencil} label="Word Snake" />
            )}

            {user && (
              <NavItem
                page="progress"
                icon={TrendingUp}
                label={user.role === 'admin' ? 'User Analytics' : 'Progress'}
              />
            )}

            {user && user.role !== 'admin' && (
              <NavItem page="assignments" icon={ClipboardList} label="Assignments" />
            )}

            {userRole === 'admin' && !isUserView && (
              <>
                <NavItem page="classDashboard" icon={LayoutGrid} label="Class Dashboard" />
                <NavItem page="assignmentManagement" icon={FolderKanban} label="Assignment Management" />
                <NavItem page="admin" icon={Shield} label="Admin Panel" />
                <NavItem page="database" icon={Database} label="Database" />
                <NavItem page="flowithTest" icon={Sparkles} label="Flowith Center" />
              </>
            )}
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-gray-200 shrink-0">
          {user ? (
            <>
              {isNavOpen && (
                <div className="px-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 truncate">{user.display_name || user.username}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              )}

              {(user?.role === 'admin' || isUserView) && (
                <button
                  onClick={toggleViewMode}
                  className={`w-full flex items-center mb-2 ${isNavOpen ? 'px-4 mb-4 space-x-3' : 'justify-center'} py-2 rounded-lg font-medium transition-colors ${isUserView
                    ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
                    }`}
                  title={isUserView ? 'Switch to Admin' : 'Switch to User'}
                >
                  <div className={`transition-transform duration-300 ${isUserView ? 'rotate-12' : ''}`}>
                    {isUserView ? <Shield size={22} className="text-purple-600" /> : <TrendingUp size={22} />}
                  </div>
                  {isNavOpen && <span>{isUserView ? 'Switch to Admin' : 'Switch to User'}</span>}
                </button>
              )}

              <NavItem
                icon={LogOut}
                label="Sign Out"
                onClick={signOut}
              />
            </>
          ) : (
            <NavItem
              icon={LogIn}
              label="Sign In"
              onClick={onLogin}
            />
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;