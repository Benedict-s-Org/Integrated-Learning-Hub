import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ClassDistributor } from '@/components/admin/ClassDistributor';
import { CoinAwardModal } from '@/components/admin/CoinAwardModal';
import { StudentProfileModal } from '@/components/admin/StudentProfileModal';
import { Settings2, LayoutGrid, Users, Activity } from 'lucide-react';
import { playSuccessSound } from '@/utils/audio';
import { UniversalMessageToolbar } from '@/components/admin/notifications/UniversalMessageToolbar';
import { MorningDutiesBoard } from '@/components/admin/MorningDutiesBoard';
import { StudentNameSidebar } from '@/components/admin/StudentNameSidebar';
import { AvatarImageItem, UserAvatarConfig } from '@/components/avatar/avatarParts';
import { AvatarCustomizationModal } from '@/components/avatar/AvatarCustomizationModal';
import { InteractiveQuizDashboard } from '@/components/admin/InteractiveQuizDashboard';
import { HomeworkModal } from '@/components/admin/HomeworkModal';

export interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    virtual_coins?: number;
    daily_real_earned?: number;
    class?: string | null;
    class_number: number | null;
    email: string;
    created_at: string;
    is_admin: boolean;
    morning_status?: 'todo' | 'review' | 'completed' | 'absent';
    last_morning_update?: string;
    equipped_item_ids?: string[];
    custom_offsets?: UserAvatarConfig;
}

export function ClassDashboardPage() {
    const { isAdmin, user: currentUser } = useAuth();

    // Guest Mode State
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');
    const [isGuestMode, setIsGuestMode] = useState(!!token);
    const [guestToken] = useState<string | null>(token);

    const [groupedUsers, setGroupedUsers] = useState<Record<string, UserWithCoins[]>>({});
    const [avatarCatalog, setAvatarCatalog] = useState<AvatarImageItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAwardModal, setShowAwardModal] = useState(false);
    const [selectedForAward, setSelectedForAward] = useState<string[]>([]); // For legacy CoinAwardModal

    // New Selection State
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [showMorningDuties, setShowMorningDuties] = useState(() => {
        const hour = new Date().getHours();
        return hour < 9; // Default true before 9am
    });
    const [showNameSidebar, setShowNameSidebar] = useState(false);
    const [showQuizBoard, setShowQuizBoard] = useState(false);

    // Class Tabs State
    const [activeClass, setActiveClass] = useState<string>('all');

    // Modals State
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [selectedHomeworkStudentId, setSelectedHomeworkStudentId] = useState<string | null>(null);
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [consequenceCounts, setConsequenceCounts] = useState<Record<string, number>>({});

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            let usersData: any[] = [];

            if (isGuestMode && guestToken) {
                const { data: verifyData, error: verifyError } = await supabase.functions.invoke('public-access/verify', {
                    body: { token: guestToken }
                });

                if (verifyError || !verifyData.valid) {
                    setIsGuestMode(false);
                    alert("Invalid or expired link");
                    return;
                }

                // Auto-set class if provided by token
                if (verifyData.targetClass) {
                    setActiveClass(verifyData.targetClass);
                }

                const { data: listData, error: listError } = await supabase.functions.invoke('public-access/list-users', {
                    body: { token: guestToken }
                });
                if (listError) throw listError;
                usersData = listData.users;

            } else {
                const { data: authData, error: authError } = await supabase.functions.invoke('auth/list-users', {
                    body: { adminUserId: currentUser?.id }
                });
                if (authError) throw authError;
                usersData = authData.users;

                // Fetch avatar configs
                const userIds: string[] = usersData?.map((u: any) => u.id) || [];

                // Chunk userIds to avoid 400 Bad Request URI Too Long
                const chunkedUserIds: string[][] = [];
                for (let i = 0; i < userIds.length; i += 30) {
                    chunkedUserIds.push(userIds.slice(i, i + 30));
                }

                const [{ data: catalogData }, ...avatarDataChunks] = await Promise.all([
                    supabase.from('avatar_items').select('*'),
                    ...chunkedUserIds.map(chunk =>
                        supabase
                            .from('user_avatar_config')
                            .select('user_id, equipped_items, custom_offsets')
                            .in('user_id', chunk)
                    )
                ]);

                const avatarData: any[] = avatarDataChunks.flatMap(chunk => chunk.data || []);

                if (catalogData) {
                    setAvatarCatalog((catalogData as any[]).map(item => ({
                        ...item,
                        category: item.category as any
                    })));
                }
                const avatarMap = new Map((avatarData as any[])?.map(a => [a.user_id, {
                    items: a.equipped_items as string[],
                    offsets: a.custom_offsets as UserAvatarConfig
                }]) || []);

                // If user is logged in, check their morning status for today
                let morningStatuses: Record<string, any> = {};
                if (userIds.length > 0) {
                    const roomDataChunks = await Promise.all(
                        chunkedUserIds.map(chunk =>
                            supabase
                                .from('user_room_data')
                                .select('user_id, coins, virtual_coins, daily_counts, morning_status, last_morning_update')
                                .in('user_id', chunk)
                        )
                    );

                    const roomData = roomDataChunks.flatMap(chunk => chunk.data || []);
                    if (roomData.length > 0) {
                        roomData.forEach((d: any) => {
                            morningStatuses[d.user_id] = d;
                        });
                    }
                }

                usersData = (usersData || []).map((u: any) => {
                    const roomInfo = morningStatuses[u.id];
                    const dailyCounts = roomInfo?.daily_counts as any;
                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
                    const dailyRealEarned = dailyCounts?.date === today ? (dailyCounts?.real_earned || 0) : 0;

                    return {
                        id: u.id,
                        display_name: u.display_name || u.user_metadata?.display_name || u.email,
                        avatar_url: u.avatar_url || u.user_metadata?.avatar_url || null,
                        coins: roomInfo?.coins || 0,
                        virtual_coins: roomInfo?.virtual_coins || 0,
                        daily_real_earned: dailyRealEarned,
                        class: u.class || u.user_metadata?.class || 'Unassigned',
                        class_number: u.class_number || null,
                        email: u.email || '',
                        created_at: u.created_at || new Date().toISOString(),
                        is_admin: u.role === 'admin',
                        morning_status: roomInfo?.morning_status,
                        last_morning_update: roomInfo?.last_morning_update,
                        equipped_item_ids: avatarMap.get(u.id)?.items,
                        custom_offsets: avatarMap.get(u.id)?.offsets
                    };
                });
            }

            let finalUsers: UserWithCoins[] = [];

            if (isGuestMode) {
                finalUsers = usersData.map((u: any) => {
                    const dailyCounts = u.daily_counts || {};
                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
                    const dailyRealEarned = dailyCounts?.date === today ? (dailyCounts?.real_earned || 0) : 0;

                    return {
                        id: u.id,
                        display_name: u.display_name || u.user_metadata?.display_name || u.email,
                        avatar_url: u.avatar_url || u.user_metadata?.avatar_url || null,
                        coins: u.coins || 0,
                        virtual_coins: u.virtual_coins || 0,
                        daily_real_earned: dailyRealEarned,
                        class: u.class || u.user_metadata?.class || 'Unassigned',
                        class_number: u.class_number || null,
                        email: u.email || '',
                        created_at: u.created_at || new Date().toISOString(),
                        is_admin: u.role === 'admin',
                        morning_status: u.morning_status || 'todo',
                        last_morning_update: u.last_morning_update
                    };
                });
            } else {
                finalUsers = usersData as UserWithCoins[];
            }

            const grouped = finalUsers.reduce((acc, user) => {
                const className = user.class || 'Unassigned';
                if (!acc[className]) {
                    acc[className] = [];
                }
                acc[className].push(user);
                return acc;
            }, {} as Record<string, UserWithCoins[]>);

            Object.keys(grouped).forEach(key => {
                grouped[key].sort((a, b) => (a.class_number || 999) - (b.class_number || 999));
            });

            setGroupedUsers(grouped);

            // Fetch daily consequences (type: negative) to show frequencies
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
            const { data: recordData } = await supabase
                .from('student_records')
                .select('student_id')
                .eq('type', 'negative')
                .gte('created_at', todayStr + 'T00:00:00Z');

            const counts: Record<string, number> = {};
            recordData?.forEach(r => {
                if (r.student_id) {
                    counts[r.student_id] = (counts[r.student_id] || 0) + 1;
                }
            });
            setConsequenceCounts(counts);

        } catch (err) {
            console.error('Error in fetchUsers:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isGuestMode && guestToken) {
            fetchUsers();
        } else if (isAdmin && currentUser) {
            fetchUsers();
        }
    }, [isAdmin, currentUser, isGuestMode, guestToken]);

    const handleAwardCoins = async (userIds: string[], amount: number, reason?: string) => {
        // Confirmation for Absent
        if (reason && (reason.includes('缺席') || reason.toLowerCase().includes('absent'))) {
            const confirmed = window.confirm(`Confirm moving ${userIds.length} student(s) to Absent? This will move them to 'Done' in morning duties.`);
            if (!confirmed) return;
        }

        try {
            if (isGuestMode) {
                const { error } = await supabase.functions.invoke('public-access/submit-reward', {
                    body: {
                        token: guestToken,
                        targetUserIds: userIds,
                        amount: amount,
                        reason: reason || 'Class Reward'
                    }
                });

                if (error) throw error;
                await fetchUsers(); // Refresh data immediately
                playSuccessSound();
                alert(`Request submitted for ${userIds.length} students! Admin approval required.`);
            } else {
                for (const userId of userIds) {
                    const { error } = await supabase.rpc('increment_room_coins' as any, {
                        target_user_id: userId,
                        amount: amount,
                        log_reason: reason || 'Class Reward',
                        log_admin_id: currentUser?.id
                    });
                    if (error) console.error(`Failed to award coins to ${userId}:`, error);
                }
                playSuccessSound();
                await fetchUsers();
            }

            // If it's a consequence (amount < 0), log to student_records for the broadcast bar
            if (amount < 0) {
                const records = userIds.map(id => ({
                    student_id: id,
                    message: reason || 'Consequence',
                    type: 'negative' as 'negative' | 'positive' | 'neutral',
                    created_by: currentUser?.id,
                    is_internal: true
                }));
                await supabase.from('student_records').insert(records);
                // Refresh logs in toolbar would be handled by its own subscription
            }

            setShowAwardModal(false);
            setSelectedForAward([]);
            if (userIds === selectedStudentIds) {
                setSelectedStudentIds([]);
            }
        } catch (err) {
            console.error('Error awarding/requesting coins:', err);
            alert('Failed to process request');
        }
    };

    const handleAwardBulk = async (awards: { userId: string, amount: number, reason?: string }[]) => {
        try {
            for (const award of awards) {
                const { error } = await supabase.rpc('increment_room_coins' as any, {
                    target_user_id: award.userId,
                    amount: award.amount,
                    log_reason: award.reason || 'Dictation Bonus',
                    log_admin_id: currentUser?.id
                });
                if (error) console.error(`Failed to award bonus to ${award.userId}:`, error);
            }
            playSuccessSound();
            await fetchUsers();
            setShowAwardModal(false);
            setSelectedForAward([]);
        } catch (err) {
            console.error('Error in bulk awarding:', err);
            alert('Failed to process bulk awards');
        }
    };

    const handleHomeworkRecord = async (studentId: string, reason: string) => {
        try {
            // Check if this specific reason implies a reward (coins)
            //完成班務（交齊功課）and 完成班務（寫手冊) usually positive
            //完成班務（欠功課） usually negative or zero
            let amount = 0;
            if (reason === '完成班務（交齊功課）') amount = 20;
            else if (reason === '完成班務（寫手冊）') amount = 10;
            else if (reason === '完成班務（欠功課）') amount = -2;
            else if (reason.startsWith('功課:')) amount = -2; // Missing specific items

            const { error } = await supabase.rpc('increment_room_coins' as any, {
                target_user_id: studentId,
                amount: amount,
                log_reason: reason,
                log_admin_id: currentUser?.id
            });

            if (error) throw error;
            await fetchUsers();
            playSuccessSound();

            if (amount < 0) {
                await supabase.from('student_records').insert([{
                    student_id: studentId,
                    message: reason,
                    type: 'negative',
                    created_by: currentUser?.id,
                    is_internal: true
                }]);
            }
        } catch (err) {
            console.error('Error recording homework:', err);
            alert('Failed to record homework');
        }
    };

    const handleQuickAward = async (userId: string) => {
        if (isGuestMode) return;
        const reason = "回答問題";
        const amount = 10;
        try {
            const { error } = await supabase.rpc('increment_room_coins' as any, {
                target_user_id: userId,
                amount: amount,
                log_reason: reason,
                log_admin_id: currentUser?.id
            });
            if (error) throw error;
            playSuccessSound();
            await fetchUsers();
        } catch (err) {
            console.error('Quick award failed:', err);
        }
    };

    const handleReorder = async (newOrder: UserWithCoins[]) => {
        if (isGuestMode) return;
        try {
            const updates = newOrder.map((student, index) => ({
                userId: student.id,
                classNumber: index + 1,
                class: student.class
            }));

            const { error } = await supabase.functions.invoke('auth/bulk-update-class-numbers', {
                body: {
                    adminUserId: currentUser?.id,
                    updates: updates,
                    syncAuthMetadata: false
                }
            });

            if (error) throw error;
            await fetchUsers();
        } catch (err) {
            console.error('Failed to reorder students:', err);
            alert('Failed to save order');
        }
    };

    const handleStudentClick = (student: UserWithCoins) => {
        setSelectedStudentId(student.id);
    };

    const selectedStudent = useMemo(() => {
        if (!selectedStudentId) return null;
        return Object.values(groupedUsers).flat().find(u => u.id === selectedStudentId) || null;
    }, [selectedStudentId, groupedUsers]);

    const selectedHomeworkStudent = useMemo(() => {
        if (!selectedHomeworkStudentId) return null;
        return Object.values(groupedUsers).flat().find(u => u.id === selectedHomeworkStudentId) || null;
    }, [selectedHomeworkStudentId, groupedUsers]);

    const handleCloseProfile = () => {
        setSelectedStudentId(null);
    };

    const sortedClassNames = useMemo(() => {
        return Object.keys(groupedUsers).sort((a, b) => a.localeCompare(b));
    }, [groupedUsers]);

    if (!isAdmin && !isGuestMode) {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className={`min-h-screen bg-slate-50 p-2 md:p-12 pt-32 pb-12 transition-all duration-300 ${showNameSidebar ? 'pr-52' : ''}`}>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
                            {isGuestMode ? 'Class View (Guest)' : 'Class Dashboard'}
                        </h1>
                        <p className="text-xs md:text-base text-slate-500 mt-1">
                            {isGuestMode ? 'Request rewards for students' : 'Manage student rewards and feedback'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setShowMorningDuties(!showMorningDuties)}
                            className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2.5 md:py-2 border rounded-xl font-semibold shadow-sm transition-all text-sm
                            ${showMorningDuties
                                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}
                        `}
                        >
                            {showMorningDuties ? 'Hide Morning Duties' : 'Show Morning Duties'}
                        </button>
                        <button
                            onClick={() => setShowNameSidebar(!showNameSidebar)}
                            className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2.5 md:py-2 border rounded-xl font-semibold shadow-sm transition-all text-sm
                            ${showNameSidebar
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}
                        `}
                            title="Quick award for answering questions"
                        >
                            <Activity size={18} className={showNameSidebar ? 'text-blue-600' : 'text-slate-400'} />
                            {showNameSidebar ? 'Hide Name Bar' : 'Enable Name Bar'}
                        </button>
                        {activeClass !== 'all' && !isGuestMode && (
                            <button
                                onClick={() => setShowQuizBoard(!showQuizBoard)}
                                className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2.5 md:py-2 border rounded-xl font-semibold shadow-sm transition-all text-sm
                                ${showQuizBoard
                                        ? 'bg-purple-100 text-purple-700 border-purple-200'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}
                            `}
                            >
                                <LayoutGrid size={18} className={showQuizBoard ? 'text-purple-600' : 'text-slate-400'} />
                                {showQuizBoard ? 'Hide Quiz Board' : 'Quiz Board'}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setSelectedForAward([]);
                                setShowAwardModal(true);
                            }}
                            className="flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2.5 md:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm transition-all text-sm"
                        >
                            <Settings2 size={18} className="text-slate-400" />
                            {isGuestMode ? 'Request Reward' : 'Manage Rewards'}
                        </button>
                    </div>
                </div>

                {showMorningDuties && (
                    <MorningDutiesBoard
                        users={activeClass === 'all'
                            ? Object.values(groupedUsers).flat().filter(u => u.class && u.class !== 'Unassigned')
                            : (groupedUsers[activeClass] || []).filter(u => u.class && u.class !== 'Unassigned')
                        }
                        onReviewClick={(id) => {
                            const student = Object.values(groupedUsers).flat().find(u => u.id === id);
                            if (student) handleStudentClick(student);
                        }}
                    />
                )}

                {(!isGuestMode || !groupedUsers[activeClass] || sortedClassNames.length > 1) && (
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                            onClick={() => setActiveClass('all')}
                            className={`
                            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all
                            ${activeClass === 'all'
                                    ? 'bg-slate-900 text-white shadow-md scale-105'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}
                        `}
                        >
                            <LayoutGrid size={16} />
                            All Classes
                        </button>
                        {sortedClassNames.map(className => (
                            <button
                                key={className}
                                onClick={() => setActiveClass(className)}
                                className={`
                                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap
                                ${activeClass === className
                                        ? 'bg-blue-600 text-white shadow-md scale-105'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}
                            `}
                            >
                                <Users size={16} />
                                {className === 'Unassigned' ? 'Unassigned' : className}
                                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${activeClass === className ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                    {groupedUsers[className]?.length || 0}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                <div className="space-y-4 md:space-y-8">
                    {isLoading ? (
                        <div className="p-8 text-center">Loading users...</div>
                    ) : (
                        <>
                            {activeClass === 'all' ? (
                                sortedClassNames.map(className => (
                                    <div key={className} className="bg-white rounded-xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8">
                                        <h2 className="text-lg font-bold text-slate-800 mb-3 px-2 border-l-4 border-blue-500 pl-3 flex justify-between items-center">
                                            <span>{className === 'Unassigned' ? 'No Class Assigned' : className}</span>
                                            <span className="text-sm font-normal text-slate-400">{groupedUsers[className]?.length} Students</span>
                                        </h2>
                                        <ClassDistributor
                                            users={groupedUsers[className]}
                                            avatarCatalog={avatarCatalog}
                                            isLoading={false}
                                            onAwardCoins={async (ids) => {
                                                setSelectedForAward(ids);
                                                setShowAwardModal(true);
                                            }}
                                            onStudentClick={handleStudentClick}
                                            onHomeworkClick={(student) => setSelectedHomeworkStudentId(student.id)}
                                            onReorder={handleReorder}
                                            selectedIds={selectedStudentIds}
                                            onSelectionChange={setSelectedStudentIds}
                                            isGuestMode={isGuestMode}
                                            consequenceCounts={consequenceCounts}
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="bg-white rounded-xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4">
                                    {showQuizBoard ? (
                                        <div className="h-[700px] w-full">
                                            <InteractiveQuizDashboard className={activeClass} />
                                        </div>
                                    ) : (
                                        <>
                                            <h2 className="text-lg font-bold text-slate-800 mb-3 px-2 border-l-4 border-blue-500 pl-3 flex justify-between items-center">
                                                <span>{activeClass === 'Unassigned' ? 'No Class Assigned' : activeClass}</span>
                                                <span className="text-sm font-normal text-slate-400">{groupedUsers[activeClass]?.length} Students</span>
                                            </h2>
                                            <ClassDistributor
                                                users={groupedUsers[activeClass] || []}
                                                avatarCatalog={avatarCatalog}
                                                isLoading={false}
                                                onAwardCoins={async (ids) => {
                                                    setSelectedForAward(ids);
                                                    setShowAwardModal(true);
                                                }}
                                                onStudentClick={handleStudentClick}
                                                onHomeworkClick={(student) => setSelectedHomeworkStudentId(student.id)}
                                                onReorder={handleReorder}
                                                selectedIds={selectedStudentIds}
                                                onSelectionChange={setSelectedStudentIds}
                                                isGuestMode={isGuestMode}
                                                consequenceCounts={consequenceCounts}
                                            />
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <CoinAwardModal
                isOpen={showAwardModal}
                onClose={() => setShowAwardModal(false)}
                selectedCount={selectedForAward.length}
                selectedStudentIds={selectedForAward}
                onAward={(amount, reason) => handleAwardCoins(selectedForAward, amount, reason)}
                onAwardBulk={handleAwardBulk}
                students={Object.values(groupedUsers).flat()}
            />

            <StudentProfileModal
                isOpen={!!selectedStudent}
                onClose={handleCloseProfile}
                student={selectedStudent}
                avatarCatalog={avatarCatalog}
                onUpdateCoins={fetchUsers}
                isGuestMode={isGuestMode}
                guestToken={guestToken || undefined}
                onCustomizeAvatar={() => setIsAvatarModalOpen(true)}
            />

            {
                (!isGuestMode || activeClass === '4D') && (
                    <UniversalMessageToolbar
                        selectedStudentIds={selectedStudentIds}
                        onClearSelection={() => setSelectedStudentIds([])}
                        onRefresh={fetchUsers}
                    />
                )
            }

            {showNameSidebar && !isGuestMode && (
                <StudentNameSidebar
                    users={
                        activeClass === 'all'
                            ? Object.values(groupedUsers).flat().filter(u => u.class && u.class !== 'Unassigned')
                            : (groupedUsers[activeClass] || []).filter(u => u.class && u.class !== 'Unassigned')
                    }
                    onQuickAward={handleQuickAward}
                />
            )}
            <AvatarCustomizationModal
                isOpen={isAvatarModalOpen}
                onClose={() => {
                    setIsAvatarModalOpen(false);
                    fetchUsers();
                }}
                userId={selectedStudent?.id || currentUser?.id}
            />
            <HomeworkModal
                isOpen={!!selectedHomeworkStudentId}
                onClose={() => setSelectedHomeworkStudentId(null)}
                studentName={selectedHomeworkStudent?.display_name || ''}
                onRecord={(reason) => selectedHomeworkStudent && handleHomeworkRecord(selectedHomeworkStudent.id, reason)}
                isGuestMode={isGuestMode}
                targetClass={selectedHomeworkStudent?.class || undefined}
            />
        </div>
    );
}
