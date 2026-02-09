import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ClassDistributor } from '@/components/admin/ClassDistributor';
import { CoinAwardModal } from '@/components/admin/CoinAwardModal';
import { StudentProfileModal } from '@/components/admin/StudentProfileModal';
import { Settings2, LayoutGrid, Users } from 'lucide-react';
import { playSuccessSound } from '@/utils/audio';
import { UniversalMessageToolbar } from '@/components/admin/notifications/UniversalMessageToolbar';
import { MorningDutiesBoard } from '@/components/admin/MorningDutiesBoard';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    virtual_coins?: number;
    daily_real_earned?: number;
    class?: string | null;
    seat_number: number | null;
    email: string;
    created_at: string;
    is_admin: boolean;
    morning_status?: 'todo' | 'review' | 'completed';
    last_morning_update?: string;
}

export function ClassDashboardPage() {
    const { isAdmin, user: currentUser } = useAuth();

    // Guest Mode State
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get('token');
    const [isGuestMode, setIsGuestMode] = useState(!!token);
    const [guestToken] = useState<string | null>(token);

    const [groupedUsers, setGroupedUsers] = useState<Record<string, UserWithCoins[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [showAwardModal, setShowAwardModal] = useState(false);
    const [selectedForAward, setSelectedForAward] = useState<string[]>([]); // For legacy CoinAwardModal

    // New Selection State
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [showMorningDuties, setShowMorningDuties] = useState(() => {
        const hour = new Date().getHours();
        return hour < 9; // Default true before 9am
    });

    // Class Tabs State
    const [activeClass, setActiveClass] = useState<string>('all');

    // Modals State
    const [selectedStudent, setSelectedStudent] = useState<UserWithCoins | null>(null);


    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            let usersData = [];

            if (isGuestMode && guestToken) {
                const { data: verifyData, error: verifyError } = await supabase.functions.invoke('public-access/verify', {
                    body: { token: guestToken }
                });

                if (verifyError || !verifyData.valid) {
                    setIsGuestMode(false);
                    alert("Invalid or expired link");
                    return;
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
            }

            let finalUsers: UserWithCoins[] = [];

            if (isGuestMode) {
                finalUsers = usersData.map((u: any) => ({
                    id: u.id,
                    display_name: u.display_name || u.user_metadata?.display_name || u.email,
                    avatar_url: u.avatar_url || u.user_metadata?.avatar_url || null,
                    coins: u.coins || 0,
                    class: u.class || u.user_metadata?.class || 'Unassigned',
                    seat_number: u.seat_number || null,
                    email: u.email || '',
                    created_at: u.created_at || new Date().toISOString(),
                    is_admin: u.role === 'admin'
                }));
            } else {
                const { data: roomData, error: roomError } = await supabase
                    .from('user_room_data')
                    .select('user_id, coins, virtual_coins, daily_counts, morning_status, last_morning_update');

                if (roomError) console.warn('Error fetching room data:', roomError);
                const today = new Date().toISOString().split('T')[0];
                const roomDataMap = new Map((roomData || []).map(r => {
                    const dailyCounts = r.daily_counts as any;
                    const dailyRealEarned = dailyCounts?.date === today ? (dailyCounts?.real_earned || 0) : 0;
                    return [r.user_id, {
                        coins: r.coins,
                        virtual_coins: r.virtual_coins,
                        daily_real_earned: dailyRealEarned,
                        morning_status: r.morning_status,
                        last_morning_update: r.last_morning_update
                    }];
                }));

                finalUsers = usersData.map((u: any) => ({
                    id: u.id,
                    display_name: u.display_name || u.user_metadata?.display_name || u.email,
                    avatar_url: u.avatar_url || u.user_metadata?.avatar_url || null,
                    coins: roomDataMap.get(u.id)?.coins || 0,
                    virtual_coins: roomDataMap.get(u.id)?.virtual_coins || 0,
                    daily_real_earned: roomDataMap.get(u.id)?.daily_real_earned || 0,
                    class: u.class || u.user_metadata?.class || 'Unassigned',
                    seat_number: u.seat_number || null,
                    email: u.email || '',
                    created_at: u.created_at || new Date().toISOString(),
                    is_admin: u.role === 'admin'
                }));
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
                grouped[key].sort((a, b) => (a.seat_number || 999) - (b.seat_number || 999));
            });

            setGroupedUsers(grouped);

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
            setShowAwardModal(false);
            setSelectedForAward([]);
            // Also clear generic selection if used for award
            if (userIds === selectedStudentIds) {
                setSelectedStudentIds([]);
            }
        } catch (err) {
            console.error('Error awarding/requesting coins:', err);
            alert('Failed to process request');
        }
    };

    const handleReorder = async (newOrder: UserWithCoins[]) => {
        if (isGuestMode) return;
        try {
            console.log('Starting reorder for', newOrder.length, 'students');

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
        setSelectedStudent(student);
    };

    const handleCloseProfile = () => {
        setSelectedStudent(null);
    };

    // Sort class names for tabs
    const sortedClassNames = useMemo(() => {
        return Object.keys(groupedUsers).sort((a, b) => a.localeCompare(b));
    }, [groupedUsers]);

    if (!isAdmin && !isGuestMode) {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 p-2 md:p-12 pt-32 pb-12"> {/* Adjusted padding for top toolbar */}
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl md:text-3xl font-bold text-slate-900">
                            {isGuestMode ? 'Class View (Guest)' : 'Class Dashboard'}
                        </h1>
                        <p className="text-[10px] md:text-base text-slate-500">
                            {isGuestMode ? 'Request rewards for students' : 'Manage student rewards and feedback'}
                        </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
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
                            onClick={() => {
                                setSelectedForAward([]); // Clear specific selection
                                setShowAwardModal(true);
                            }}
                            className="flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2.5 md:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm transition-all text-sm"
                        >
                            <Settings2 size={18} className="text-slate-400" />
                            {isGuestMode ? 'Request Reward' : 'Manage Rewards'}
                        </button>
                    </div>
                </div>

                {/* Morning Duties Board */}
                {showMorningDuties && !isGuestMode && (
                    <MorningDutiesBoard
                        users={activeClass === 'all'
                            ? Object.values(groupedUsers).flat().filter(u => u.class && u.class !== 'Unassigned')
                            : (groupedUsers[activeClass] || []).filter(u => u.class && u.class !== 'Unassigned')
                        }
                        onReviewClick={(id) => {
                            // Select user and maybe scroll to them or open profile?
                            // For now, let's just select them in the toolbar context if we want to act on them
                            const student = Object.values(groupedUsers).flat().find(u => u.id === id);
                            if (student) handleStudentClick(student);
                        }}
                    />
                )}

                {/* Class Tabs */}
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

                <div className="space-y-4 md:space-y-8">
                    {isLoading ? (
                        <div className="p-8 text-center">Loading users...</div>
                    ) : (
                        <>
                            {activeClass === 'all' ? (
                                // Show All Classes
                                sortedClassNames.map(className => (
                                    <div key={className} className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8">
                                        <h2 className="text-lg font-bold text-slate-800 mb-3 px-2 border-l-4 border-blue-500 pl-3 flex justify-between items-center">
                                            <span>{className === 'Unassigned' ? 'No Class Assigned' : className}</span>
                                            <span className="text-sm font-normal text-slate-400">{groupedUsers[className]?.length} Students</span>
                                        </h2>
                                        <ClassDistributor
                                            users={groupedUsers[className]}
                                            isLoading={false}
                                            onAwardCoins={async (ids) => {
                                                setSelectedForAward(ids);
                                                setShowAwardModal(true);
                                            }}
                                            onStudentClick={handleStudentClick}
                                            onReorder={handleReorder}
                                            selectedIds={selectedStudentIds}
                                            onSelectionChange={setSelectedStudentIds}
                                        />
                                    </div>
                                ))
                            ) : (
                                // Show Single Class
                                <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4">
                                    <h2 className="text-lg font-bold text-slate-800 mb-3 px-2 border-l-4 border-blue-500 pl-3 flex justify-between items-center">
                                        <span>{activeClass === 'Unassigned' ? 'No Class Assigned' : activeClass}</span>
                                        <span className="text-sm font-normal text-slate-400">{groupedUsers[activeClass]?.length} Students</span>
                                    </h2>
                                    <ClassDistributor
                                        users={groupedUsers[activeClass] || []}
                                        isLoading={false}
                                        onAwardCoins={async (ids) => {
                                            setSelectedForAward(ids);
                                            setShowAwardModal(true);
                                        }}
                                        onStudentClick={handleStudentClick}
                                        onReorder={handleReorder}
                                        selectedIds={selectedStudentIds}
                                        onSelectionChange={setSelectedStudentIds}
                                    />
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
            />

            <StudentProfileModal
                isOpen={!!selectedStudent}
                onClose={handleCloseProfile}
                student={selectedStudent}
                onUpdateCoins={fetchUsers}
                isGuestMode={isGuestMode}
                guestToken={guestToken || undefined}
            />

            {!isGuestMode && (
                <UniversalMessageToolbar
                    selectedStudentIds={selectedStudentIds}
                    onClearSelection={() => setSelectedStudentIds([])}
                    onRefresh={fetchUsers}
                />
            )}

        </div>
    );
}
