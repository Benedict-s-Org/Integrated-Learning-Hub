import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  Loader2,
  UserPlus,
  Users,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Mail,
  Lock,
  User,
  Shield,
  BarChart3,
  MapPin,
  Pencil,
  Settings,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { UserEditModal } from '@/components/admin/UserEditModal';
import { DefaultUserSettingsModal } from '@/components/admin/DefaultUserSettingsModal';

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
}

export function AdminUsersPage() {
  const navigate = useNavigate();
  const { isAdmin, user: currentUser } = useAuth();

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

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Fetch user profiles
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return;
      }

      // Check admin status for each user
      const usersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: isAdminData } = await supabase
            .rpc('has_role', { _user_id: profile.id, _role: 'admin' });

          return {
            id: profile.id,
            email: '', // We don't have access to emails from profiles
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            created_at: profile.created_at ?? '',
            is_admin: isAdminData === true,
          };
        })
      );

      setUsers(usersWithRoles);
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
      const { data, error } = await supabase.functions.invoke('auth/create-user', {
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

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex">
      {/* Left Sidebar */}
      <aside className="w-56 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[hsl(var(--border))]">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            返回主頁
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => navigate("/admin/users")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
          >
            <Users className="w-4 h-4" />
            用戶管理
          </button>
          <button
            onClick={() => navigate("/admin/progress")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          >
            <BarChart3 className="w-4 h-4" />
            進度總覽
          </button>
          <button
            onClick={() => navigate("/design")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          >
            <Shield className="w-4 h-4" />
            空間設計中心
          </button>
          <button
            onClick={() => navigate("/admin/city-editor")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          >
            <MapPin className="w-4 h-4" />
            城市編輯器
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[hsl(var(--border))]">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">管理員面板</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-[hsl(var(--primary))]">
              <Users className="w-5 h-5 text-[hsl(var(--primary-foreground))]" />
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
              用戶管理
            </h1>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Create User Form */}
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
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
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
            <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-6">
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
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted))]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-[hsl(var(--primary))]" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-[hsl(var(--foreground))]">
                            {user.display_name || '未設定名稱'}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {new Date(user.created_at).toLocaleDateString('zh-HK')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.is_admin && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-xs">
                            <Shield className="w-3 h-3" />
                            管理員
                          </div>
                        )}
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
        </div>
      </main>

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
    </div>
  );
}
