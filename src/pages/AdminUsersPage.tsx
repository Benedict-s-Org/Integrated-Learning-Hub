import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Users,
  Pencil,
  Settings,
  QrCode,
  ScanLine,
  RotateCcw,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { UserEditModal } from '@/components/admin/UserEditModal';
import { DefaultUserSettingsModal } from '@/components/admin/DefaultUserSettingsModal';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ClassDistributor } from '@/components/admin/ClassDistributor';
import { CoinAwardModal } from '@/components/admin/CoinAwardModal';
import { StudentQRCodeModal } from '@/components/admin/StudentQRCodeModal';
import { BulkQRCodeExport } from '@/components/admin/BulkQRCodeExport';
import { BulkUserCreationModal } from '@/components/admin/BulkUserCreationModal';
import { BulkUserEditModal } from '@/components/admin/BulkUserEditModal';
import { HomeworkModal } from '@/components/admin/HomeworkModal';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';

interface UserWithProfile {
  id: string;
  email: string;
  auth_email?: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
  coins: number;
  virtual_coins?: number;
  daily_real_earned?: number;
  class_number: number | null;
  class_name?: string | null;
  qr_token?: string;
  managed_by_id?: string | null;
  spelling_level?: number;
}

interface AdminUsersPageProps {
  isEmbedded?: boolean;
  forcedAdminId?: string;
}

export function AdminUsersPage({ isEmbedded = false, forcedAdminId }: AdminUsersPageProps) {
  const { user: currentUser } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'classroom'>('list');

  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Create user form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>('unspecified');
  const [isCreating, setIsCreating] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedHomeworkStudentId, setSelectedHomeworkStudentId] = useState<string | null>(null);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [showDefaultSettings, setShowDefaultSettings] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedForAward, setSelectedForAward] = useState<string[]>([]);
  const [qrUser, setQrUser] = useState<{ id: string; name: string; qrToken: string } | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  useEffect(() => {
    // Sync showAllStudents if super admin
    if (isSuperAdmin && !forcedAdminId) {
      setShowAllStudents(true);
    }
  }, [isSuperAdmin, forcedAdminId]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      console.log('Fetching users from public.users...');
      const { data: publicUsers, error: usersError } = await (supabase
        .from('users')
        .select('*') as any); // Use * to be safe against missing columns

      if (usersError) {
        console.error('Error fetching from users table:', usersError);
        throw usersError;
      }
      console.log(`Fetched ${publicUsers?.length || 0} base user records`);

      const { data: avatarConfigs, error: avatarError } = await supabase
        .from("user_avatar_config")
        .select("user_id, equipped_items");

      if (avatarError) {
        console.warn("fetchUsers: avatar_config fetch failed:", avatarError);
      }

      const avatarMap = new Map((avatarConfigs || []).map((a: any) => [a.user_id, a]));

      const { data: roomData, error: roomError } = await supabase
        .from('user_room_data')
        .select('user_id, coins, virtual_coins, daily_counts');

      if (roomError) console.warn('Error fetching room data:', roomError);

      const today = new Date().toISOString().split('T')[0];
      const roomDataMap = new Map((roomData || []).map(r => {
        const dailyCounts = r.daily_counts as any;
        return [r.user_id, {
          coins: r.coins,
          virtual_coins: r.virtual_coins,
          daily_real_earned: dailyCounts?.date === today ? (dailyCounts?.real_earned || 0) : 0
        }];
      }));

      // Fetch real auth emails using a secure RPC function (SECURITY DEFINER reads auth.users)
      let authEmailMap: Record<string, string> = {};
      try {
        const { data: authEmailRows, error: rpcError } = await (supabase as any).rpc('get_auth_emails');
        if (rpcError) {
          console.warn('Failed to fetch auth emails via RPC:', rpcError.message);
        } else if (Array.isArray(authEmailRows)) {
          for (const row of authEmailRows) {
            if (row.user_id && row.auth_email) {
              authEmailMap[row.user_id] = row.auth_email;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch auth emails:', err);
      }

      const mergedUsers: UserWithProfile[] = (publicUsers || []).map((u: any) => {
        const avatar = avatarMap.get(u.id) as any;
        const roomData = roomDataMap.get(u.id) as any;

        // Safety: ensure current user (admin) has their role reflected correctly in state
        const role = u.id === currentUser?.id && isSuperAdmin ? 'admin' : (u.role || 'user');

        return {
          id: u.id,
          email: u.username || '',
          auth_email: authEmailMap[u.id] || '',
          display_name: u.display_name || 'Unnamed',
          avatar_url: avatar ? "CUSTOM" : null,
          created_at: u.created_at || new Date().toISOString(),
          is_admin: role === 'admin',
          coins: roomData?.coins || 0,
          virtual_coins: roomData?.virtual_coins || 0,
          daily_real_earned: roomData?.daily_real_earned || 0,
          class_number: u.class_number ?? u.seat_number ?? null,
          class_name: u.class,
          qr_token: u.qr_token,
          managed_by_id: u.managed_by_id,
          spelling_level: u.spelling_level
        };
      });

      setUsers(mergedUsers);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = (ids: string[]) => {
    if (selectedUserIds.length === ids.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(ids);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser?.id, forcedAdminId]);

  const visibleUsers = useMemo(() => {
    const activeAdminId = forcedAdminId || currentUser?.id;
    const adminEmail = currentUser?.email;

    console.log('visibleUsers memo:', {
      usersCount: users.length,
      isSuperAdmin,
      activeAdminId,
      adminEmail,
      forcedAdminId
    });

    if (showAllStudents || (isSuperAdmin && !forcedAdminId)) {
      console.log('Showing all users (Super Admin or "Show All" enabled)');
      return users;
    }

    if (!activeAdminId) {
      console.log('No active admin ID, showing zero users');
      return [];
    }

    const filtered = users.filter(u => u.managed_by_id === activeAdminId || u.id === activeAdminId);
    console.log('Filtered users for admin:', {
      adminId: activeAdminId,
      totalUsers: users.length,
      visibleCount: filtered.length,
      showAllStudents
    });

    return filtered.sort((a, b) => {
      // Sort by class first
      const classA = a.class_name || 'Unassigned';
      const classB = b.class_name || 'Unassigned';
      if (classA !== classB) {
        return classA.localeCompare(classB);
      }
      // Then sort by class number
      return (a.class_number || 999) - (b.class_number || 999);
    });
  }, [users, isSuperAdmin, currentUser?.id, forcedAdminId, currentUser?.email, showAllStudents]);

  const editingUser = useMemo(() => {
    if (!editingUserId) return null;
    return users.find(u => u.id === editingUserId) || null;
  }, [editingUserId, users]);

  const selectedHomeworkStudent = useMemo(() => {
    if (!selectedHomeworkStudentId) return null;
    return users.find(u => u.id === selectedHomeworkStudentId) || null;
  }, [selectedHomeworkStudentId, users]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { error } = await supabase.functions.invoke('auth/create-user', {
        body: {
          email,
          username: email.split('@')[0],
          password,
          role: 'user',
          adminUserId: forcedAdminId || currentUser?.id,
          display_name: displayName,
          gender,
        },
      });

      if (error) throw error;

      alert(`用戶 ${displayName} 已成功建立！`);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setGender('unspecified');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || '建立用戶時發生錯誤');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;

    const passcode = prompt(`Confirm with passcode 24411222 to delete ${selectedUserIds.length} users:`);
    if (passcode !== '24411222') {
      if (passcode !== null) alert('密碼錯誤');
      return;
    }

    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('auth/bulk-delete-users', {
        body: {
          adminUserId: forcedAdminId || currentUser?.id,
          userIdsToDelete: selectedUserIds,
        },
      });

      if (error) throw error;

      alert(`成功刪除 ${data.results?.length || 0} 個用戶`);
      setSelectedUserIds([]);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message || '刪除用戶時發生錯誤');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleHomeworkRecord = async (studentId: string, reason: string) => {
    try {
      let amount = 0;
      if (reason === '完成班務（交齊功課）') amount = 20;
      else if (reason === '完成班務（寫手冊）') amount = 10;
      else if (reason === '完成班務（欠功課）') amount = -2;

      const { error } = await (supabase as any).rpc('increment_room_coins', {
        target_user_id: studentId,
        amount: amount,
        log_reason: reason,
        log_admin_id: forcedAdminId || currentUser?.id
      });

      if (error) throw error;
      fetchUsers();
    } catch (err) {
      console.error('Error recording homework:', err);
    }
  };

  const handleAwardCoins = async (ids: string[], amount: number, reason: string) => {
    try {
      const { error } = await (supabase as any).from('coin_logs').insert(
        ids.map((userId: string) => ({
          target_user_id: userId,
          amount,
          log_reason: reason,
          log_admin_id: forcedAdminId || currentUser?.id
        }))
      );
      if (error) throw error;
      alert(`Successfully awarded ${amount} coins!`);
      fetchUsers();
    } catch (err) {
      console.error('Error awarding coins:', err);
      alert('Failed to award coins');
    }
  };

  const handleResetAllCoins = async () => {
    if (!confirm('Are you sure you want to RESET ALL COINS for all students?')) return;
    try {
      const { error } = await (supabase.rpc as any)('reset_all_coins');
      if (error) throw error;
      alert('All coins have been reset to 0.');
      fetchUsers();
    } catch (err) {
      console.error('Failed to reset coins:', err);
    }
  };

  const content = (
    <>
      <div className={isEmbedded ? "" : "p-3 md:p-8"}>
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-medium shadow-sm outline-none"
              >
                <option value="all">All Classes</option>
                {Array.from(new Set(users.map(u => u.class_name).filter(Boolean))).sort().map(className => (
                  <option key={className} value={className!}>{className}</option>
                ))}
              </select>

              <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                >
                  <List size={20} />
                </button>
                <button
                  onClick={() => setViewMode('classroom')}
                  className={`p-2 rounded-md ${viewMode === 'classroom' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                >
                  <LayoutGrid size={20} />
                </button>
              </div>

              {!isSuperAdmin && !forcedAdminId && (
                <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition">
                  <input
                    type="checkbox"
                    checked={showAllStudents}
                    onChange={(e) => setShowAllStudents(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Show All Students</span>
                </label>
              )}

              {selectedUserIds.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBulkEdit(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-sm hover:bg-indigo-700 transition-colors animate-in fade-in slide-in-from-left-2"
                  >
                    <Pencil size={18} />
                    批量編輯 ({selectedUserIds.length})
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold shadow-sm hover:bg-red-700 transition-colors animate-in fade-in slide-in-from-left-2"
                  >
                    <Trash2 size={18} />
                    批量刪除 ({selectedUserIds.length})
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/admin/scanner')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold shadow-md"
            >
              <ScanLine size={20} />
              Scan QR
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <UserPlus className="text-blue-500" />
                    建立新用戶
                  </span>
                  <button
                    onClick={() => setShowBulkCreate(true)}
                    className="text-xs bg-slate-50 text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100 hover:text-blue-600 transition-colors font-bold border border-slate-200"
                    title="批量建立用戶"
                  >
                    批量建立
                  </button>
                </h2>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <input
                    type="email"
                    placeholder="電郵地址"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200"
                    required
                  />
                  <input
                    type="password"
                    placeholder="密碼"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200"
                    required
                  />
                  <input
                    type="text"
                    placeholder="顯示名稱"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200"
                    required
                  />
                  <select
                    value={gender}
                    onChange={(e: any) => setGender(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="unspecified">性別 (不詳)</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
                  >
                    {isCreating ? '處理中...' : '建立用戶'}
                  </button>
                </form>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <button
                  onClick={() => setShowDefaultSettings(true)}
                  className="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold border border-slate-200 flex items-center justify-center gap-2"
                >
                  <Settings size={20} />
                  默認權限
                </button>
                <button
                  onClick={handleResetAllCoins}
                  className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold border border-red-100 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} />
                  重置金幣
                </button>
              </div>
              <BulkQRCodeExport students={visibleUsers} />
            </div>

            <div className="lg:col-span-3">
              {viewMode === 'classroom' ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[600px]">
                  <ClassDistributor
                    users={filterClass === 'all' ? visibleUsers : visibleUsers.filter(u => u.class_name === filterClass)}
                    selectedIds={selectedForAward}
                    onSelectionChange={setSelectedForAward}
                    isLoading={isLoadingUsers}
                    onAwardCoins={async (ids) => {
                      setSelectedForAward(ids);
                      setShowAwardModal(true);
                    }}
                    onStudentClick={(student) => setEditingUserId(student.id)}
                    onHomeworkClick={(student) => setSelectedHomeworkStudentId(student.id)}
                    onReorder={async (newOrder) => {
                      try {
                        const updates = newOrder.map((user, index) => ({
                          userId: user.id,
                          classNumber: index + 1,
                          class: user.class_name
                        }));
                        await supabase.functions.invoke('auth/bulk-update-class-numbers', {
                          body: { adminUserId: forcedAdminId || currentUser?.id, updates }
                        });
                        await fetchUsers();
                      } catch (err) {
                        console.error('Failed to reorder:', err);
                      }
                    }}
                    avatarCatalog={[]}
                    showEmail={true}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 w-10">
                            <button
                              onClick={() => {
                                const filtered = visibleUsers.filter(u => filterClass === 'all' || u.class_name === filterClass);
                                selectAllUsers(filtered.map(u => u.id));
                              }}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              {selectedUserIds.length > 0 && selectedUserIds.length === visibleUsers.filter(u => filterClass === 'all' || u.class_name === filterClass).length ? (
                                <CheckSquare size={20} className="text-blue-600" />
                              ) : (
                                <Square size={20} />
                              )}
                            </button>
                          </th>
                          <th className="px-6 py-4 font-bold text-slate-600">學生</th>
                          <th className="px-6 py-4 font-bold text-slate-600">班別/學號</th>
                          <th className="px-6 py-4 font-bold text-slate-600">金幣</th>
                          <th className="px-6 py-4 font-bold text-slate-600 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {isLoadingUsers ? (
                          <tr><td colSpan={4} className="text-center py-20 text-slate-400">Loading...</td></tr>
                        ) : visibleUsers.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-20 text-slate-400">沒有學生數據</td></tr>
                        ) : (
                          visibleUsers
                            .filter(u => filterClass === 'all' || u.class_name === filterClass)
                            .map(user => (
                              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-6 py-4">
                                  <button
                                    onClick={() => toggleUserSelection(user.id)}
                                    className={`transition-colors ${selectedUserIds.includes(user.id) ? 'text-blue-600' : 'text-slate-300 hover:text-blue-400'}`}
                                  >
                                    {selectedUserIds.includes(user.id) ? (
                                      <CheckSquare size={20} />
                                    ) : (
                                      <Square size={20} />
                                    )}
                                  </button>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-slate-800">{user.display_name}</div>
                                  <div className="text-sm text-gray-500 block mt-1 font-normal">{user.auth_email || user.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs font-bold mr-2">{user.class_name || 'N/A'}</span>
                                  <span className="text-slate-400 font-medium">#{user.class_number || '-'}</span>
                                </td>
                                <td className="px-6 py-4 font-black text-blue-600">{user.coins || 0}</td>
                                <td className="px-6 py-4 text-right space-x-2">
                                  <button
                                    onClick={() => setQrUser({ id: user.id, name: user.display_name || user.email, qrToken: user.qr_token || '' })}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                  >
                                    <QrCode size={18} />
                                  </button>
                                  <button
                                    onClick={() => setEditingUserId(user.id)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                  >
                                    <Pencil size={18} />
                                  </button>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CoinAwardModal
        isOpen={showAwardModal}
        onClose={() => setShowAwardModal(false)}
        selectedCount={selectedForAward.length}
        selectedStudentIds={selectedForAward}
        onAward={(amount, reason) => handleAwardCoins(selectedForAward, amount, reason)}
      />

      {
        editingUser && (
          <UserEditModal
            user={editingUser!}
            isOpen={!!editingUserId}
            onClose={() => setEditingUserId(null)}
            onSuccess={fetchUsers}
            adminUserId={forcedAdminId || currentUser?.id || ""}
          />
        )
      }

      <DefaultUserSettingsModal
        isOpen={showDefaultSettings}
        onClose={() => setShowDefaultSettings(false)}
      />

      <StudentQRCodeModal
        isOpen={!!qrUser}
        onClose={() => setQrUser(null)}
        student={qrUser}
      />

      <BulkUserCreationModal
        isOpen={showBulkCreate}
        onClose={() => setShowBulkCreate(false)}
        onSuccess={fetchUsers}
        adminUserId={forcedAdminId || currentUser?.id || ""}
      />

      <BulkUserEditModal
        isOpen={showBulkEdit}
        onClose={() => {
          setShowBulkEdit(false);
          setSelectedUserIds([]);
        }}
        onSuccess={fetchUsers}
        selectedUsers={users.filter(u => selectedUserIds.includes(u.id))}
        adminUserId={forcedAdminId || currentUser?.id || ""}
      />

      <HomeworkModal
        isOpen={!!selectedHomeworkStudentId}
        onClose={() => setSelectedHomeworkStudentId(null)}
        studentName={selectedHomeworkStudent?.display_name || ''}
        onRecord={(reason) => selectedHomeworkStudent && handleHomeworkRecord(selectedHomeworkStudent.id, reason)}
      />
    </>
  );

  if (isEmbedded) return content;

  return (
    <AdminLayout title="用戶管理" icon={<Users className="w-6 h-6" />}>
      {content}
    </AdminLayout>
  );
}
