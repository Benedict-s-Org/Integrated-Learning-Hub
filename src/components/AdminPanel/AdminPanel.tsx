import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Trash2, Shield, User, Key, FileEdit, Mic, Eye, EyeOff, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
  can_access_proofreading?: boolean;
  can_access_spelling?: boolean;
  display_name?: string;
}

interface PendingPermissions {
  [userId: string]: {
    proofreading?: boolean;
    spelling?: boolean;
  };
}

interface AdminPanelProps {
  onNavigateToAssets?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigateToAssets }) => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  // ... existing state ...

  // ... existing code ...

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-8" data-component-name="AdminPanel" data-source-file="src/components/AdminPanel/AdminPanel.tsx">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Admin Panel</h1>
            <p className="text-slate-600">Manage users and system settings</p>
            {isSuperAdmin && (
              <p className="text-sm text-blue-600 font-medium mt-1">Super Admin - Full Access</p>
            )}
            {!isSuperAdmin && (
              <p className="text-sm text-slate-500 font-medium mt-1">Regular Admin Access</p>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition flex items-center space-x-2 shadow-sm"
            >
              <UserPlus size={20} />
              <span>Create User</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Username</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Display Name</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Role</th>
                <th className="text-center px-6 py-4 text-sm font-semibold text-slate-700">Permissions</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Created</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                console.log('Rendering user row:', user.username, 'isSuperAdmin:', isSuperAdmin);
                return (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{user.username}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">{user.display_name || user.username}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${user.role === 'admin'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                        }`}>
                        {user.role === 'admin' ? <Shield size={14} /> : <User size={14} />}
                        <span className="capitalize">{user.role}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-3">
                        {user.role === 'admin' ? (
                          <>
                            <div className="flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700">
                              <FileEdit size={14} />
                              <span>On</span>
                            </div>
                            <div className="flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700">
                              <Mic size={14} />
                              <span>On</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center space-x-1 text-xs font-medium text-gray-600">
                                <FileEdit size={14} />
                              </div>
                              <select
                                value={getDisplayValue(user.id, 'proofreading', user.can_access_proofreading || false) ? 'on' : 'off'}
                                onChange={(e) => {
                                  const newValue = e.target.value === 'on';
                                  handlePermissionChange(user.id, 'proofreading', newValue);
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                disabled={isProcessing}
                              >
                                <option value="off">Off</option>
                                <option value="on">On</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center space-x-1 text-xs font-medium text-gray-600">
                                <Mic size={14} />
                              </div>
                              <select
                                value={getDisplayValue(user.id, 'spelling', user.can_access_spelling || false) ? 'on' : 'off'}
                                onChange={(e) => {
                                  const newValue = e.target.value === 'on';
                                  handlePermissionChange(user.id, 'spelling', newValue);
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                disabled={isProcessing}
                              >
                                <option value="off">Off</option>
                                <option value="on">On</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        {isSuperAdmin && (
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-slate-600 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-100 transition"
                            title="Edit User"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedUserId(user.id);
                            setShowResetModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition"
                          title="Reset Password"
                        >
                          <Key size={18} />
                        </button>
                        {isSuperAdmin && user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition"
                            title="Delete User"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {hasAnyPendingChanges() && (
        <div className="fixed bottom-8 right-8 bg-white rounded-2xl shadow-2xl p-6 border border-slate-200">
          <div className="mb-3 text-sm text-slate-600">
            {Object.keys(pendingPermissions).length} user(s) with pending changes
          </div>
          <div className="flex space-x-3">
            <button
              onClick={cancelAllPermissionChanges}
              disabled={isProcessing}
              className="px-6 py-2.5 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 transition disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={updateAllPermissions}
              disabled={isProcessing}
              className="px-6 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Updating...' : 'Update All'}
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Create Users</h2>
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-slate-700 mb-2 font-medium">Format (one user per line):</p>
              <p className="text-sm font-mono text-slate-600">username, password, Display Name</p>
              <p className="text-sm font-mono text-slate-600 mt-1">username, password</p>
              <p className="text-xs text-slate-500 mt-2">Display Name is optional. If not provided, username will be used.</p>
              <p className="text-xs text-slate-500">Maximum 30 users at once. Password must be at least 6 characters.</p>
            </div>
            <form onSubmit={handleCreateUsers} className="space-y-4">
              <div className="mb-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createAsAdmin}
                    onChange={(e) => {
                      setCreateAsAdmin(e.target.checked);
                      if (bulkUserText.trim()) {
                        validateBulkUserInput(bulkUserText);
                      }
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Create as admin
                  </span>
                </label>
                <p className="text-xs text-slate-500 mt-1 ml-8">
                  When checked, all users will be created with full admin access and permissions
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Users to Create
                </label>
                <textarea
                  value={bulkUserText}
                  onChange={(e) => handleBulkUserTextChange(e.target.value)}
                  rows={10}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition font-mono text-sm"
                  placeholder="student1, password123, John Doe&#10;student2, password456, Jane Smith&#10;student3, password789"
                />
              </div>

              {validationErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-semibold text-red-700 mb-1">Validation Errors:</p>
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationErrors.length === 0 && validUsers.length > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-semibold text-green-700">
                    Ready to create {validUsers.length} user{validUsers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setBulkUserText('');
                    setValidUsers([]);
                    setValidationErrors([]);
                    setCreateAsAdmin(false);
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || validationErrors.length > 0 || validUsers.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Creating...' : `Create ${validUsers.length} User${validUsers.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Edit User</h2>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Enter display name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'admin' | 'user')}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Password (optional)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Leave blank to keep current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showEditPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Password must be at least 6 characters if changing
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUserId(null);
                    setSelectedUser(null);
                    setEditUsername('');
                    setEditDisplayName('');
                    setEditPassword('');
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Reset User Password</h2>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Verification Code
                </label>
                <div className="relative">
                  <input
                    type={showVerificationCode ? "text" : "password"}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Enter system verification code"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVerificationCode(!showVerificationCode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showVerificationCode ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Required for password reset operations
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showResetPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setSelectedUserId(null);
                    setVerificationCode('');
                    setResetPassword('');
                  }}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
