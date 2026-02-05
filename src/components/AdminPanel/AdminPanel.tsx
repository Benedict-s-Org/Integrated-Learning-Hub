import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Trash2, Shield, User, Key, FileEdit, Mic, Eye, EyeOff, Edit2, TrendingUp, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
  can_access_proofreading?: boolean;
  can_access_spelling?: boolean;
  display_name?: string;
  class?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Create User States
  const [bulkUserText, setBulkUserText] = useState('');
  const [createAsAdmin, setCreateAsAdmin] = useState(false);
  const [validUsers, setValidUsers] = useState<Array<{ username: string; password: string; display_name?: string }>>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Create Class States
  const [showClassModal, setShowClassModal] = useState(false);
  const [className, setClassName] = useState('');
  const [classUserText, setClassUserText] = useState('');

  // Edit User States
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editClass, setEditClass] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Reset Password States
  const [verificationCode, setVerificationCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showVerificationCode, setShowVerificationCode] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [pendingPermissions, setPendingPermissions] = useState<PendingPermissions>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Sorting and Filtering States
  const [sortBy, setSortBy] = useState<'created_at' | 'username' | 'class'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterClass, setFilterClass] = useState<string>('all');

  useEffect(() => {
    console.log('AdminPanel: Current User:', currentUser);
    if (isAdmin) {
      fetchUsers();
      checkSuperAdminStatus();
    }
  }, [isAdmin, currentUser]);

  const checkSuperAdminStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/check-super-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ adminUserId: currentUser?.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsSuperAdmin(data.isSuperAdmin);
      }
    } catch (err) {
      console.error('Error checking super admin status:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // We must use direct fetch to the edge function URL because 
      // supabase.functions.invoke doesn't easily support subpaths 
      // and our edge function routing depends on the path.

      const baseUrl = import.meta.env.VITE_SUPABASE_URL.endsWith('/')
        ? import.meta.env.VITE_SUPABASE_URL.slice(0, -1)
        : import.meta.env.VITE_SUPABASE_URL;
      const url = `${baseUrl}/functions/v1/auth/list-users`;

      console.log('AdminPanel: Fetching users from:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ adminUserId: currentUser?.id }),
      });

      console.log('AdminPanel: Fetch users status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AdminPanel: Fetch users error text:', errorText);
        let errorMessage = 'Failed to fetch users';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `${errorMessage} (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data_users = await response.json();
      setUsers(data_users.users);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUserTextChange = (text: string) => {
    setBulkUserText(text);
    validateBulkUserInput(text);
  };

  const validateBulkUserInput = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const errors: string[] = [];
    const valid: any[] = [];

    if (lines.length > 30) {
      errors.push('Maximum 30 users can be created at once');
    }

    lines.forEach((line, index) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) {
        errors.push(`Line ${index + 1}: Missing password (format: username, password, [Display Name], [Class])`);
        return;
      }

      const [username, password, display_name, userClass] = parts;

      if (!username || username.length < 3) {
        errors.push(`Line ${index + 1}: Username must be at least 3 characters`);
      }

      if (!password || password.length < 6) {
        errors.push(`Line ${index + 1}: Password must be at least 6 characters`);
      }

      valid.push({ username, password, display_name, class: userClass });
    });

    setValidationErrors(errors);
    setValidUsers(valid);
  };

  const handleCreateUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationErrors.length > 0 || validUsers.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/bulk-create-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          adminUserId: currentUser?.id,
          users: validUsers.map(u => ({
            ...u,
            role: createAsAdmin ? 'admin' : 'user'
          }))
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setBulkUserText('');
        setValidUsers([]);
        setShowCreateModal(false);
        fetchUsers();
      } else {
        setError(data.message || 'Failed to create users');
        if (data.errors) {
          setValidationErrors(data.errors.map((e: any) => `${e.username}: ${e.error}`));
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim() || !classUserText.trim()) {
      setError('Please provide both class name and student list');
      return;
    }

    const lines = classUserText.split('\n').filter(line => line.trim() !== '');
    const studentsToCreate = lines.map(line => {
      const [username, password, display_name] = line.split(',').map(p => p.trim());
      return {
        username,
        password: password || 'password123', // Default password if missing
        display_name: display_name || username,
        role: 'user' as const,
        class: className.trim()
      };
    });

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/bulk-create-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          adminUserId: currentUser?.id,
          users: studentsToCreate
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Successfully created class "${className}" with ${studentsToCreate.length} students`);
        setClassName('');
        setClassUserText('');
        setShowClassModal(false);
        fetchUsers();
      } else {
        setError(data.message || 'Failed to create class');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedUser(user);
    setEditUsername(user.username);
    setEditDisplayName(user.display_name || '');
    setEditRole(user.role);
    setEditClass(user.class || '');
    setEditPassword('');
    setShowEditModal(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          adminUserId: currentUser?.id,
          userId: selectedUserId,
          username: editUsername,
          display_name: editDisplayName,
          role: editRole,
          class: editClass,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // If password was also provided, reset it separately or as part of update
        if (editPassword) {
          const resetRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/admin-reset-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              adminUserId: currentUser?.id,
              userId: selectedUserId,
              newPassword: editPassword
            }),
          });
          if (!resetRes.ok) throw new Error('User updated, but password reset failed');
        }

        setSuccess('User updated successfully');
        setShowEditModal(false);
        fetchUsers();
      } else {
        setError(data.error || 'Failed to update user');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}" (ID: ${userId})? This action cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          adminUserId: currentUser?.id,
          userIdToDelete: userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('User deleted successfully');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/admin-reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          adminUserId: currentUser?.id,
          userId: selectedUserId,
          newPassword: resetPassword,
          verificationCode: verificationCode // The edge function actually should check code if provided or just rely on adminUserId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Password reset successfully');
        setShowResetModal(false);
        setResetPassword('');
        setVerificationCode('');
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermissionChange = (userId: string, field: 'proofreading' | 'spelling', value: boolean) => {
    setPendingPermissions(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const getDisplayValue = (userId: string, field: 'proofreading' | 'spelling', currentValue: boolean) => {
    if (pendingPermissions[userId] && pendingPermissions[userId][field] !== undefined) {
      return pendingPermissions[userId][field];
    }
    return currentValue;
  };

  const hasAnyPendingChanges = () => {
    return Object.keys(pendingPermissions).length > 0;
  };

  const cancelAllPermissionChanges = () => {
    setPendingPermissions({});
  };

  const updateAllPermissions = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    const userIds = Object.keys(pendingPermissions);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const userId of userIds) {
        const permissions = pendingPermissions[userId];
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/update-permissions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            adminUserId: currentUser?.id,
            userId,
            can_access_proofreading: permissions.proofreading,
            can_access_spelling: permissions.spelling
          }),
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      }

      setSuccess(`Updated permissions for ${successCount} user(s)${failCount > 0 ? `, ${failCount} failed` : ''}`);
      setPendingPermissions({});
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredAndSortedUsers = users
    .filter(user => filterClass === 'all' || user.class === filterClass)
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'username') {
        comparison = a.username.localeCompare(b.username);
      } else if (sortBy === 'class') {
        comparison = (a.class || '').localeCompare(b.class || '');
      } else {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const uniqueClasses = Array.from(new Set(users.map(u => u.class).filter(Boolean))) as string[];

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
              onClick={() => fetchUsers()}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
              title="Refresh User List"
            >
              Refresh
            </button>
            {onNavigateToAssets && (
              <button
                onClick={onNavigateToAssets}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-3 px-6 rounded-lg transition"
              >
                Asset Generator
              </button>
            )}
            <button
              onClick={() => setShowClassModal(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 px-6 rounded-lg transition flex items-center space-x-2 shadow-sm"
            >
              <Users size={20} />
              <span>Create Class</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition flex items-center space-x-2 shadow-sm"
            >
              <UserPlus size={20} />
              <span>Create User</span>
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

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

        {/* Sorting and Filtering UI */}
        <div className="mb-6 flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-700">Filter Class:</span>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">All Classes</option>
              {uniqueClasses.sort().map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-700">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="created_at">Joined Date</option>
              <option value="username">Username</option>
              <option value="class">Class</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition"
              title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              {sortOrder === 'asc' ? <TrendingUp size={16} /> : <TrendingUp size={16} className="rotate-180" />}
            </button>
          </div>

          <div className="ml-auto text-sm text-slate-500">
            Showing {filteredAndSortedUsers.length} of {users.length} users
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Username</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Display Name</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Class</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Role</th>
                <th className="text-center px-6 py-4 text-sm font-semibold text-slate-700">Permissions</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Created</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.map((user) => {
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
                      <div className={`text-sm font-medium ${user.class ? 'text-blue-600' : 'text-slate-400 italic'}`}>
                        {user.class || 'No Class'}
                      </div>
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
                  Class
                </label>
                <input
                  type="text"
                  value={editClass}
                  onChange={(e) => setEditClass(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Enter class label (e.g. A, B, Grade 9)"
                />
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
        </div >
      )}

      {
        showResetModal && (
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
        )
      }

      {showClassModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Create Class</h2>
              <button
                onClick={() => setShowClassModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Class Name
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Grade 9A, Monday Evening"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Student List (format: username, password, [Display Name])
                </label>
                <textarea
                  value={classUserText}
                  onChange={(e) => setClassUserText(e.target.value)}
                  placeholder="user1, pass123, Student One&#10;user2, pass123, Student Two"
                  rows={8}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none transition font-mono text-sm"
                />
                <p className="mt-2 text-xs text-slate-500">
                  One student per line. Password and Display Name are optional.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-900 transition flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    'Processing...'
                  ) : (
                    <>
                      <Users size={20} />
                      <span>Create Class & Students</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div >
  );
};

export default AdminPanel;
