import React from 'react';
import { Home, Shield, FileEdit, LogOut, LogIn, Mic, TrendingUp, ClipboardList, Database, FolderKanban, BookMarked, Lightbulb, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavigationProps {
  currentPage: 'new' | 'saved' | 'admin' | 'database' | 'proofreading' | 'spelling' | 'progress' | 'assignments' | 'assignmentManagement' | 'proofreadingAssignments' | 'learningHub' | 'spacedRepetition';
  onPageChange: (page: 'new' | 'saved' | 'admin' | 'database' | 'proofreading' | 'spelling' | 'progress' | 'assignments' | 'assignmentManagement' | 'proofreadingAssignments' | 'learningHub' | 'spacedRepetition') => void;
  userRole: string | null;
  onLogin?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage, onPageChange, userRole, onLogin }) => {
  const { user, signOut } = useAuth();
  return (
    <nav
      className="fixed top-0 left-0 h-full w-64 bg-white border-r-2 border-gray-200 z-50 shadow-lg"
      style={{ fontFamily: 'Times New Roman, serif' }}
      data-source-tsx="Navigation|src/components/Navigation/Navigation.tsx"
    >
      <div className="flex flex-col h-full py-8 px-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 px-4">Memorize</h1>
        </div>

        <div className="flex flex-col space-y-2">
          <button
            onClick={() => onPageChange('new')}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              currentPage === 'new'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            data-source-tsx="Navigation New Button|src/components/Navigation/Navigation.tsx"
          >
            <Home size={22} />
            <span>Home</span>
          </button>

          {user && (
            <button
              onClick={() => onPageChange('saved')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentPage === 'saved'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              data-source-tsx="Navigation Saved Button|src/components/Navigation/Navigation.tsx"
            >
              <BookMarked size={22} />
              <span>Saved Content</span>
            </button>
          )}

          {(user?.can_access_proofreading || user?.role === 'admin') && (
            <button
              onClick={() => onPageChange('proofreading')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentPage === 'proofreading'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              data-source-tsx="Navigation Proofreading Button|src/components/Navigation/Navigation.tsx"
            >
              <FileEdit size={22} />
              <span>Proofreading Exercise</span>
            </button>
          )}

          {user && (user.can_access_spelling || user.role === 'admin') && (
            <button
              onClick={() => onPageChange('spelling')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentPage === 'spelling'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              data-source-tsx="Navigation Spelling Button|src/components/Navigation/Navigation.tsx"
            >
              <Mic size={22} />
              <span>Spelling Practice</span>
            </button>
          )}

          {user && (user.can_access_learning_hub || user.role === 'admin') && (
            <button
              onClick={() => onPageChange('learningHub')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentPage === 'learningHub'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              data-source-tsx="Navigation Learning Hub Button|src/components/Navigation/Navigation.tsx"
            >
              <Lightbulb size={22} />
              <span>Integrated Learning Hub</span>
            </button>
          )}

          {user && (user.can_access_spaced_repetition || user.role === 'admin') && (
            <button
              onClick={() => onPageChange('spacedRepetition')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentPage === 'spacedRepetition'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Zap size={22} />
              <span>Spaced Repetition</span>
            </button>
          )}

          {user && (
            <button
              onClick={() => onPageChange('progress')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentPage === 'progress'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              data-source-tsx="Navigation Progress Button|src/components/Navigation/Navigation.tsx"
            >
              <TrendingUp size={22} />
              <span>{user.role === 'admin' ? 'User Analytics' : 'Progress'}</span>
            </button>
          )}

          {user && user.role !== 'admin' && (
            <button
              onClick={() => onPageChange('assignments')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                currentPage === 'assignments'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              data-source-tsx="Navigation Assignments Button|src/components/Navigation/Navigation.tsx"
            >
              <ClipboardList size={22} />
              <span>Assignments</span>
            </button>
          )}

          {userRole === 'admin' && (
            <>
              <button
                onClick={() => onPageChange('assignmentManagement')}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  currentPage === 'assignmentManagement'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                data-source-tsx="Navigation Assignment Management Button|src/components/Navigation/Navigation.tsx"
              >
                <FolderKanban size={22} />
                <span>Assignment Management</span>
              </button>
              <button
                onClick={() => onPageChange('admin')}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  currentPage === 'admin'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                data-source-tsx="Navigation Admin Button|src/components/Navigation/Navigation.tsx"
              >
                <Shield size={22} />
                <span>Admin Panel</span>
              </button>
              <button
                onClick={() => onPageChange('database')}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  currentPage === 'database'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                data-source-tsx="Navigation Database Button|src/components/Navigation/Navigation.tsx"
              >
                <Database size={22} />
                <span>Database</span>
              </button>
            </>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-gray-200">
          {user ? (
            <>
              <div className="px-4 mb-4">
                <p className="text-sm font-medium text-gray-700">{user.display_name || user.username}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <button
                onClick={signOut}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
              >
                <LogOut size={22} />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors w-full"
            >
              <LogIn size={22} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;