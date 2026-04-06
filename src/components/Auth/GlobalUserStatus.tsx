import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, LogIn, LogOut, X, Shield } from 'lucide-react';
import { Login } from './Login';

export const GlobalUserStatus: React.FC = () => {
  const { user, signOut, loading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (loading) return null;

  return (
    <>
      <div className="fixed top-4 right-4 z-[9999]">
        <div className="bg-white/90 backdrop-blur shadow-xl rounded-full px-4 py-2 border border-slate-200 flex items-center gap-3 animate-in slide-in-from-top-4 duration-500">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                  {user.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
                </div>
                <div className="text-sm">
                  <p className="font-bold text-slate-900 leading-none truncate max-w-[120px]">
                    {user.display_name || user.username || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium leading-none mt-1 uppercase tracking-wider">
                    {user.role}
                  </p>
                </div>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <button
                onClick={() => signOut()}
                title="Sign Out"
                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all active:scale-90"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 rounded-full px-5 py-2 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 group font-bold text-sm"
            >
              <LogIn size={16} className="group-hover:translate-x-0.5 transition-transform" />
              <span>Admin Login / 登入</span>
            </button>
          )}
        </div>
      </div>

      {/* Shared Login Modal */}
      {showLoginModal && !user && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <Shield size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Admin Authentication</h3>
              </div>
              <button 
                onClick={() => setShowLoginModal(false)} 
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8">
              <Login onLoginSuccess={() => setShowLoginModal(false)} />
            </div>
            <div className="px-8 pb-6 text-center">
              <p className="text-xs text-slate-400">
                Unauthorized access is strictly prohibited and monitored.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
