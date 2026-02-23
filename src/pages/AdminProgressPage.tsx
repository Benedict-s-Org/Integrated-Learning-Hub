import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  Loader2,
  Users,
  Search,
  Home,
  Coins,
  Package,
  BookOpen,
  Brain,
  TrendingUp,
  Clock,
  Shield,
  User,
  ChevronDown,
  BarChart3,
  Eye,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { MemoryContentModal } from '@/components/MemoryContentModal';

interface UserProgress {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
  // Room data
  house_level: number;
  coins: number;
  virtual_coins: number;
  daily_real_earned: number;
  inventory_count: number;
  placement_count: number;
  updated_at: string | null;
  // Analytics from RPC
  spelling_practices: number;
  spelling_avg_accuracy: number;
  proofreading_practices: number;
  proofreading_avg_accuracy: number;
  memorization_sessions: number;
  spaced_repetition_sessions: number;
  total_practices: number;
  overall_avg_accuracy: number;
  last_activity: string | null;
  total_time_minutes: number;
  // Others
  memory_count: number;
}

const HOUSE_LEVEL_NAMES = [
  '唐樓板間房',
  '公屋單位',
  '私人樓宇',
  '豪華洋房',
];

type SortOption = 'activity' | 'cards' | 'level' | 'created';

interface AdminProgressPageProps {
  isEmbedded?: boolean;
  forcedAdminId?: string;
}

export function AdminProgressPage({ isEmbedded = false, forcedAdminId }: AdminProgressPageProps) {
  const { isAdmin, user: currentUser } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();

  const [users, setUsers] = useState<UserProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('activity');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);

  const fetchUserProgress = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch unified performance data via RPC
      const { data: performanceData, error: performanceError } = await (supabase as any).rpc('get_all_students_performance');

      if (performanceError) throw performanceError;

      // 2. Fetch room data for all users (not included in the performance RPC)
      const { data: roomData, error: roomError } = await supabase
        .from('user_room_data')
        .select('user_id, house_level, coins, virtual_coins, daily_counts, inventory, placements, updated_at');

      if (roomError) throw roomError;

      // 3. Fetch memories for point of interest counts
      const { data: memoriesData, error: memoriesError } = await supabase
        .from('memories')
        .select('user_id');

      if (memoriesError) throw memoriesError;

      // 4. Also fetch profile creation date for all (RPC only returns users)
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, created_at');

      if (profilesError) throw profilesError;

      // 5. Create maps for efficient lookup
      const today = new Date().toISOString().split('T')[0];
      const roomMap = new Map<string, any>();
      (roomData || []).forEach((room) => {
        const dailyCounts = room.daily_counts as any;
        const dailyRealEarned = dailyCounts?.date === today ? (dailyCounts?.real_earned || 0) : 0;
        roomMap.set(room.user_id, { ...room, daily_real_earned: dailyRealEarned });
      });

      const memoriesMap = new Map<string, number>();
      (memoriesData || []).forEach((memory) => {
        if (memory.user_id) {
          memoriesMap.set(memory.user_id, (memoriesMap.get(memory.user_id) || 0) + 1);
        }
      });

      const profileMap = new Map<string, string | null>();
      (profiles || []).forEach((p) => {
        if (p.id) profileMap.set(p.id, p.created_at);
      });

      // 6. Combine data
      const usersProgress = await Promise.all(
        (performanceData || []).map(async (student: any) => {
          // Check admin status
          const { data: isAdminData } = await supabase.rpc('has_role', {
            _user_id: student.user_id,
            _role: 'admin',
          });

          const room = roomMap.get(student.user_id);
          const memoryCount = memoriesMap.get(student.user_id) || 0;
          const inventoryArray = room?.inventory as string[] | null;
          const placementsArray = room?.placements as unknown[] | null;

          return {
            id: student.user_id,
            username: student.username,
            display_name: student.display_name,
            created_at: (student.user_id && profileMap.get(student.user_id as string)) || '',
            is_admin: isAdminData === true,
            managed_by_id: student.managed_by_id, // Ensure this is captured from RPC or user query
            // Room
            house_level: room?.house_level ?? 0,
            coins: room?.coins ?? 0,
            virtual_coins: room?.virtual_coins ?? 0,
            daily_real_earned: room?.daily_real_earned ?? 0,
            inventory_count: inventoryArray?.length ?? 0,
            placement_count: placementsArray?.length ?? 0,
            updated_at: room?.updated_at ?? null,
            // Learning (from RPC)
            spelling_practices: Number(student.spelling_practices) || 0,
            spelling_avg_accuracy: Number(student.spelling_avg_accuracy) || 0,
            proofreading_practices: Number(student.proofreading_practices) || 0,
            proofreading_avg_accuracy: Number(student.proofreading_avg_accuracy) || 0,
            memorization_sessions: Number(student.memorization_sessions) || 0,
            spaced_repetition_sessions: Number(student.spaced_repetition_sessions) || 0,
            total_practices: Number(student.total_practices) || 0,
            overall_avg_accuracy: Number(student.overall_avg_accuracy) || 0,
            last_activity: student.last_activity,
            total_time_minutes: Number(student.total_time_minutes) || 0,
            // Memory Palace
            memory_count: memoryCount,
          } as UserProgress;
        })
      );

      setUsers(usersProgress);
    } catch (err) {
      console.error('Error in fetchUserProgress:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUserProgress();
    }
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    const activeAdminId = forcedAdminId || currentUser?.id;

    let result = users.filter((u) => {
      // Apply search term filter
      const matchesSearch = u.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      // Apply Admin Isolation
      // If Super Admin and NOT impersonating, see all
      if (isSuperAdmin && !forcedAdminId) return true;

      // Otherwise, only see students managed by the activeAdminId
      // We need to ensure UserProgress has managed_by_id. 
      // Looking at fetchUserProgress, I should make sure managed_by_id is included.
      return (u as any).managed_by_id === activeAdminId;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'activity': {
          const aTime = a.last_activity || a.updated_at || a.created_at;
          const bTime = b.last_activity || b.updated_at || b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }
        case 'cards': // We'll keep the name 'cards' but use total_practices
          return b.total_practices - a.total_practices;
        case 'level':
          return b.house_level - a.house_level || b.coins - a.coins;
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [users, searchTerm, sortBy]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'activity', label: '最近活躍' },
    { value: 'cards', label: '練習次數' }, // Changed label
    { value: 'level', label: '房屋等級' },
    { value: 'created', label: '註冊時間' },
  ];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('zh-HK', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const content = (
    <main className={isEmbedded ? "" : "p-3 md:p-8 overflow-auto"}>
      <div className="max-w-5xl mx-auto">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋用戶名稱..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              <span>{sortOptions.find((o) => o.value === sortBy)?.label}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {sortDropdownOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-10 overflow-hidden">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setSortDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--muted))] transition-colors ${sortBy === option.value
                      ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--foreground))]'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 text-center">
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--muted-foreground))] text-[10px] font-bold uppercase tracking-wider mb-1">
              <Users className="w-3 h-3" />
              總用戶數
            </div>
            <div className="text-xl font-black text-[hsl(var(--foreground))]">
              {users.length}
            </div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--muted-foreground))] text-[10px] font-bold uppercase tracking-wider mb-1">
              <BarChart3 className="w-3 h-3" />
              平均準確度
            </div>
            <div className="text-xl font-black text-[hsl(var(--foreground))]">
              {users.length > 0
                ? (users.reduce((sum, u) => sum + u.overall_avg_accuracy, 0) / users.length).toFixed(1)
                : 0}%
            </div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--muted-foreground))] text-[10px] font-bold uppercase tracking-wider mb-1">
              <Brain className="w-3 h-3" />
              總記憶點
            </div>
            <div className="text-xl font-black text-[hsl(var(--foreground))]">
              {users.reduce((sum, u) => sum + u.memory_count, 0)}
            </div>
          </div>
          <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-3 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--muted-foreground))] text-[10px] font-bold uppercase tracking-wider mb-1">
              <TrendingUp className="w-3 h-3" />
              總練習次數
            </div>
            <div className="text-xl font-black text-[hsl(var(--foreground))]">
              {users.reduce((sum, u) => sum + u.total_practices, 0)}
            </div>
          </div>
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--muted-foreground))]" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
            {searchTerm ? '找不到符合的用戶' : '暫無用戶資料'}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-5 shadow-sm"
              >
                {/* User Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                      <User className="w-6 h-6 text-[hsl(var(--primary))]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[hsl(var(--foreground))]">
                          {user.display_name || '未設定名稱'}
                        </h3>
                        {user.is_admin && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] text-xs font-bold uppercase tracking-wider">
                            <Shield className="w-3 h-3" />
                            管理員
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        註冊：{formatDate(user.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-[hsl(var(--muted-foreground))]">
                    <Clock className="w-4 h-4 inline mr-1" />
                    最後活躍：{formatDateTime(user.last_activity || user.updated_at)}
                  </div>
                </div>

                {/* Progress Sections */}
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Room Progress */}
                  <div className="bg-[hsl(var(--muted)/0.5)] rounded-xl p-4 border border-[hsl(var(--border))]">
                    <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))] mb-3">
                      <Home className="w-4 h-4 text-[hsl(var(--primary))]" />
                      房間進度
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">等級</div>
                        <div className="font-semibold text-[hsl(var(--foreground))]">
                          Lv.{user.house_level}
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {HOUSE_LEVEL_NAMES[user.house_level] || '未知'}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 font-semibold text-[hsl(var(--foreground))] whitespace-nowrap">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          <span>{user.coins - (user.daily_real_earned || 0)}+{user.daily_real_earned || 0}</span>
                          <span className="text-[10px] opacity-75">({user.virtual_coins || 0})</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">傢俱庫存</div>
                        <div className="flex items-center gap-1 font-semibold text-[hsl(var(--foreground))]">
                          <Package className="w-4 h-4" />
                          {user.inventory_count}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">已放置</div>
                        <div className="font-semibold text-[hsl(var(--foreground))]">
                          {user.placement_count}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Learning Progress */}
                  <div className="bg-[hsl(var(--muted)/0.5)] rounded-xl p-4 border border-[hsl(var(--border))]">
                    <div className="flex items-center justify-between gap-2 text-sm font-medium text-[hsl(var(--foreground))] mb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[hsl(var(--primary))]" />
                        學習進度
                      </div>
                      <div className="text-[10px] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] px-1.5 py-0.5 rounded">
                        {user.overall_avg_accuracy}% 準確
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Spaced Rep.</div>
                        <div className="text-sm font-semibold">{user.spaced_repetition_sessions}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">默寫 Spelling</div>
                        <div className="text-sm font-semibold">{user.spelling_practices}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">校對 Proofing</div>
                        <div className="text-sm font-semibold">{user.proofreading_practices}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))]">總練習 Practices</div>
                        <div className="text-sm font-bold text-[hsl(var(--primary))]">{user.total_practices}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-[hsl(var(--border))]">
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
                        最後活動：{formatDateTime(user.last_activity)}
                      </div>
                    </div>
                  </div>

                  {/* Memory Points */}
                  <div className="bg-[hsl(var(--muted)/0.5)] rounded-xl p-4 border border-[hsl(var(--border))]">
                    <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))] mb-3">
                      <Brain className="w-4 h-4 text-[hsl(var(--primary))]" />
                      記憶點
                    </div>
                    <div className="flex flex-col items-center justify-center h-24">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-[hsl(var(--primary))]">
                          {user.memory_count}
                        </div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))] font-medium">
                          個記憶點
                        </div>
                      </div>
                      {user.memory_count > 0 && (
                        <button
                          onClick={() =>
                            setSelectedUser({
                              id: user.id,
                              name: user.display_name || '未設定名稱',
                            })
                          }
                          className="mt-2 flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] transition-colors font-medium border border-[hsl(var(--primary)/0.2)]"
                        >
                          <Eye className="w-3 h-3" />
                          檢視詳情
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Memory Content Modal */}
      {selectedUser && (
        <MemoryContentModal
          isOpen={true}
          onClose={() => setSelectedUser(null)}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}
    </main>
  );

  if (isEmbedded) return content;

  return (
    <AdminLayout title="用戶進度總覽" icon={<BarChart3 className="w-5 h-5" />}>
      {content}
    </AdminLayout>
  );
}
