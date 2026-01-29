import React from 'react';
import { LogOut, User } from 'lucide-react';
import { useSupabase } from '../../context/SupabaseContext';

const AuthStatus: React.FC = () => {
  const { user, signOut } = useSupabase();

  const handleSignOut = async () => {
    await signOut();
  };

  if (!user) return null;

  return (
    <div 
      className="fixed top-4 left-4 z-50 flex items-center space-x-3 bg-white px-4 py-2 rounded-lg shadow-lg border"
      style={{ fontFamily: 'Times New Roman, serif' }}
      data-source-tsx="AuthStatus|src/components/Auth/AuthStatus.tsx"
    >
      <div className="flex items-center space-x-2">
        <User size={16} className="text-gray-600" />
        <span 
          className="text-sm text-gray-700 max-w-32 truncate"
          data-source-tsx="AuthStatus User Email|src/components/Auth/AuthStatus.tsx"
        >
          {user.email}
        </span>
      </div>
      
      <button
        onClick={handleSignOut}
        className="flex items-center space-x-1 text-sm text-red-600 hover:text-red-700 transition-colors"
        data-source-tsx="AuthStatus Sign Out Button|src/components/Auth/AuthStatus.tsx"
      >
        <LogOut size={14} />
        <span>Sign out</span>
      </button>
    </div>
  );
};

export default AuthStatus;