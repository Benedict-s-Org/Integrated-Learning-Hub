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
import { useSuperAdmin } from '@/hooks/useSuperAdmin';

interface UserWithProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
  coins: number;
  virtual_coins?: number;
  daily_real_earned?: number;
  seat_number: number | null;
  class_name?: string | null;
  qr_token?: string;
  managed_by_id?: string | null;
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

  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null);
  const [showDefaultSettings, setShowDefaultSettings] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedForAward, setSelectedForAward] = useState<string[]>([]);
  const [qrUser, setQrUser] = useState<{ id: string; name: string; qrToken: string } | null>(null);
  const [filterClass, setFilterClass] = useState<string>('all');

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data: publicUsers, error: usersError } = await (supabase
        .from('users')
        .select('id, username, display_name, class, qr_token, role, created_at, managed_by_id') as any);

      if (usersError) throw usersError;

      const { data: profiles, error: profilesError } = await (supabase
        .from('user_profiles')
        .select('id, avatar_url, seat_number') as any);

      if (profilesError) console.error('Error fetching profiles:', profilesError);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

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

      const mergedUsers: UserWithProfile[] = (publicUsers || []).map((u: any) => {
        const profile = profileMap.get(u.id) as any;
        const roomData = roomDataMap.get(u.id) as any;
        return {
          id: u.id,
          email: u.username || '',
          display_name: u.display_name || 'Unnamed',
          avatar_url: profile?.avatar_url || null,
          created_at: u.created_at || new Date().toISOString(),
          is_admin: u.role === 'admin',
          coins: roomData?.coins || 0,
          virtual_coins: roomData?.virtual_coins || 0,
          daily_real_earned: roomData?.daily_real_earned || 0,
          seat_number: profile?.seat_number || null,
          class_name: u.class,
          qr_token: u.qr_token,
          managed_by_id: u.managed_by_id
        };
      });

      setUsers(mergedUsers);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser?.id, forcedAdminId]);

  const visibleUsers = useMemo(() => {
    const activeAdminId = forcedAdminId || currentUser?.id;
    if (isSuperAdmin && !forcedAdminId) return users;
    if (!activeAdminId) return [];
    return users.filter(u => u.managed_by_id === activeAdminId);
  }, [users, isSuperAdmin, currentUser?.id, forcedAdminId]);

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
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <UserPlus className="text-blue-500" />
                  建立新用戶
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
                    onStudentClick={(student) => setEditingUser(student as UserWithProfile)}
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
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
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
                                  <div className="font-bold text-slate-800">{user.display_name}</div>
                                  <div className="text-sm text-slate-500">{user.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs font-bold mr-2">{user.class_name || 'N/A'}</span>
                                  <span className="text-slate-400 font-medium">#{user.seat_number || '-'}</span>
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
                                    onClick={() => setEditingUser(user)}
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

      {editingUser && (
        <UserEditModal
          user={editingUser}
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={fetchUsers}
          adminUserId={forcedAdminId || currentUser?.id || ""}
        />
      )}

      <DefaultUserSettingsModal
        isOpen={showDefaultSettings}
        onClose={() => setShowDefaultSettings(false)}
      />

      <StudentQRCodeModal
        isOpen={!!qrUser}
        onClose={() => setQrUser(null)}
        student={qrUser}
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
