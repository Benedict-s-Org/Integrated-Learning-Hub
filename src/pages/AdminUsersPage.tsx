import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  UserPlus,
  Users,
  AlertCircle,
  CheckCircle,
  Mail,
  Lock,
  User,
  Shield,
  Pencil,
  Settings,
  QrCode,
  ScanLine,
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
import { LayoutGrid, List } from 'lucide-react';

const createUserSchema = z.object({
  email: z.string().trim().email({ message: '請輸入有效的電郵地址' }),
  password: z.string().min(6, { message: '密碼至少需要6個字符' }).max(72, { message: '密碼不能超過72個字符' }),
  displayName: z.string().trim().min(1, { message: '請輸入顯示名稱' }).max(50, { message: '顯示名稱不能超過50個字符' }),
  gender: z.enum(['male', 'female', 'unspecified']),
});

interface UserWithProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
  coins: number;
  seat_number: number | null; // Now referred to as "Class Number" in UI
  class_name?: string | null; // Mapped from 'class' column in users table
  qr_token?: string;
}

export function AdminUsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Modal states
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null);
  const [showDefaultSettings, setShowDefaultSettings] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [selectedForAward, setSelectedForAward] = useState<string[]>([]);
  const [qrUser, setQrUser] = useState<{ id: string; name: string; qrToken: string } | null>(null);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Fetch user profiles
      // Using any cast because some columns were recently added via migration
      const { data: profiles, error } = await (supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, created_at, seat_number')
        .order('seat_number', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;

      // Fetch QR tokens and Class from users table
      const { data: usersData } = await (supabase
        .from('users')
        .select('id, qr_token, class') as any);

      const userExtraMap = new Map((usersData || []).map((u: any) => [u.id, { qrToken: u.qr_token, className: u.class }]));

      // Fetch room data for coins
      const { data: roomData, error: roomError } = await supabase
        .from('user_room_data')
        .select('user_id, coins');

      if (roomError) {
        console.warn('Error fetching room data:', roomError);
      }

      const roomDataMap = new Map((roomData || []).map(r => [r.user_id, r.coins]));

      // Check admin status for each user
      const usersWithRoles = await Promise.all(
        ((profiles as any[]) || []).map(async (profile) => {
          const { data: isAdminData } = await supabase
            .rpc('has_role', { _user_id: profile.id, _role: 'admin' });

          const extraData = userExtraMap.get(profile.id) || { qrToken: undefined, className: undefined };
          return {
            id: profile.id,
            email: '', // We don't have access to emails from profiles
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            created_at: profile.created_at ?? '',
            is_admin: isAdminData === true,
            coins: roomDataMap.get(profile.id) || 0,
            seat_number: profile.seat_number,
            qr_token: extraData.qrToken,
            class_name: extraData.className,
          };
        })
      );

      // Client-side sorting: Class (asc) -> Class Number (asc)
      const sortedUsers = usersWithRoles.sort((a, b) => {
        // 1. Sort by Class
        const classA = a.class_name || '';
        const classB = b.class_name || '';

        // If one has class and other doesn't, put one with class first? Or empty last?
        // Usually we want empty classes at the bottom or top. Let's put empty at bottom.
        if (classA && !classB) return -1;
        if (!classA && classB) return 1;

        const classCompare = classA.localeCompare(classB, 'zh-HK', { numeric: true });
        if (classCompare !== 0) return classCompare;

        // 2. Sort by Class Number (seat_number)
        const seatA = a.seat_number || Number.MAX_SAFE_INTEGER;
        const seatB = b.seat_number || Number.MAX_SAFE_INTEGER;
        return seatA - seatB;
      });

      setUsers(sortedUsers);
    } catch (err) {
      console.error('Error in fetchUsers:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    // Validate input
    const result = createUserSchema.safeParse({ email, password, displayName, gender });
    if (!result.success) {
      setCreateError(result.error.issues[0].message);
      return;
    }

    setIsCreating(true);

    try {
      const { error } = await supabase.functions.invoke('auth/create-user', {
        body: {
          email: result.data.email,
          username: result.data.email.split('@')[0],
          password: result.data.password,
          role: 'user',
          adminUserId: currentUser?.id,
          display_name: result.data.displayName,
          gender: result.data.gender,
        },
      });

      if (error) {
        setCreateError(error.message || '建立用戶失敗');
        return;
      }


      setCreateSuccess(`用戶 ${result.data.email} 已成功建立`);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setGender('unspecified');
      fetchUsers();
    } catch (err) {
      setCreateError('建立用戶失敗，請稍後再試');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAwardCoins = async (userIds: string[], amount: number, reason: string) => {
    try {
      console.log(`Awarding ${amount} coins to ${userIds.length} users for ${reason}`);

      // Use RPC if available
      for (const userId of userIds) {
        const { error } = await (supabase.rpc as any)('increment_room_coins', {
          _user_id: userId,
          _amount: amount
        });

        if (error) {
          console.error(`Failed to award coins to ${userId}:`, error);
        }
      }

      // Refresh users to show new balance
      await fetchUsers();
      setShowAwardModal(false);
      setSelectedForAward([]);
    } catch (err) {
      console.error('Error in handleAwardCoins:', err);
      alert('Failed to award coins');
    }
  };

  // ClassDistributor calls this when "Give Feedback" button -> Modal -> then actual award.
  // Wait, ClassDistributor expects `onAwardCoins` which takes (ids, amount, reason). 
  // But ClassDistributor doesn't have the modal inside it? 
  // My ClassDistributor implementation has "Give Feedback" button which should OPEN the modal.
  // Let's adjust ClassDistributor usage below.

  return (
    <AdminLayout title="用戶管理" icon={<Users className="w-5 h-5" />}>
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header Actions */}
          <div className="flex justify-between mb-6">
            {/* Scan QR Button */}
            <button
              onClick={() => navigate('/admin/scanner')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <ScanLine size={20} />
              Scan QR
            </button>
            <BulkQRCodeExport students={users} />
            {/* View Toggle */}
            <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                title="List View"
              >
                <List size={20} />
              </button>
              <button
                onClick={() => setViewMode('classroom')}
                className={`p-2 rounded-md transition-all ${viewMode === 'classroom' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                title="Classroom View"
              >
                <LayoutGrid size={20} />
              </button>
            </div>
          </div>

          {viewMode === 'classroom' ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm min-h-[600px]">
              <ClassDistributor
                users={users}
                isLoading={isLoadingUsers}
                onAwardCoins={async (ids) => {
                  setSelectedForAward(ids);
                  setShowAwardModal(true);
                }}
                onStudentClick={(student) => setEditingUser(student)}
                onReorder={async (newOrder) => {
                  try {
                    // Update seat_number for each user in the new order
                    for (let i = 0; i < newOrder.length; i++) {
                      const { error } = await supabase
                        .from('user_profiles')
                        .update({ seat_number: i + 1 } as any)
                        .eq('id', newOrder[i].id);

                      if (error) throw error;
                    }
                    // Refresh data to ensure everything is in sync
                    await fetchUsers();
                  } catch (err) {
                    console.error('Failed to update seat numbers:', err);
                    throw err;
                  }
                }}
              />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Create User Form */}
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="w-5 h-5 text-[hsl(var(--primary))]" />
                  <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                    建立新用戶
                  </h2>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-4">
                  {createError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  {createSuccess && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{createSuccess}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
                      顯示名稱
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="用戶名稱"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
                      電郵地址
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
                      初始密碼
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="至少6個字符"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  {/* Gender Selection */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
                      性別
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="male"
                          checked={gender === 'male'}
                          onChange={() => setGender('male')}
                          disabled={isCreating}
                          className="text-[hsl(var(--primary))]"
                        />
                        <span className="text-sm text-[hsl(var(--foreground))]">男</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="female"
                          checked={gender === 'female'}
                          onChange={() => setGender('female')}
                          disabled={isCreating}
                          className="text-[hsl(var(--primary))]"
                        />
                        <span className="text-sm text-[hsl(var(--foreground))]">女</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value="unspecified"
                          checked={gender === 'unspecified'}
                          onChange={() => setGender('unspecified')}
                          disabled={isCreating}
                          className="text-[hsl(var(--primary))]"
                        />
                        <span className="text-sm text-[hsl(var(--foreground))]">不指定</span>
                      </label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDefaultSettings(true)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      預設設定
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          建立中...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          建立用戶
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Users List */}
              <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-[hsl(var(--primary))]" />
                  <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                    用戶列表
                  </h2>
                </div>

                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                    暫無用戶
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted)/0.5)] border border-transparent hover:border-[hsl(var(--border))] transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center overflow-hidden shrink-0">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-5 h-5 text-[hsl(var(--primary))]" />
                              )}
                            </div>
                            {user.seat_number && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-800 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-white">
                                {user.seat_number}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-[hsl(var(--foreground))] truncate">
                              {user.display_name || '未設定名稱'}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                              {user.class_name && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                  {user.class_name}
                                </span>
                              )}
                              {user.seat_number && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  #{user.seat_number}
                                </span>
                              )}
                              <span>
                                {new Date(user.created_at).toLocaleDateString('zh-HK')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {user.is_admin && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-[10px] font-bold uppercase tracking-wider">
                              <Shield className="w-3 h-3" />
                              管理員
                            </div>
                          )}
                          <button
                            onClick={() => user.qr_token && setQrUser({
                              id: user.id,
                              name: user.display_name || '未命名',
                              qrToken: user.qr_token
                            })}
                            className="p-1.5 rounded-lg hover:bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            title="顯示 QR Code"
                            disabled={!user.qr_token}
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-1.5 rounded-lg hover:bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            title="編輯用戶"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <CoinAwardModal
        isOpen={showAwardModal}
        onClose={() => setShowAwardModal(false)}
        selectedCount={selectedForAward.length}
        onAward={(amount, reason) => handleAwardCoins(selectedForAward, amount, reason)}
      />

      {/* Edit Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={fetchUsers}
          adminUserId={currentUser?.id || ""}
        />
      )}

      {/* Default Settings Modal */}
      <DefaultUserSettingsModal
        isOpen={showDefaultSettings}
        onClose={() => setShowDefaultSettings(false)}
      />

      {/* QR Code Modal */}
      <StudentQRCodeModal
        isOpen={!!qrUser}
        onClose={() => setQrUser(null)}
        student={qrUser}
      />
    </AdminLayout>
  );
}
