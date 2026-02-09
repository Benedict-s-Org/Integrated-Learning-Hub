import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ClassDistributor } from '@/components/admin/ClassDistributor';
import { CoinAwardModal } from '@/components/admin/CoinAwardModal';
import { StudentProfileModal } from '@/components/admin/StudentProfileModal';
import { Settings2 } from 'lucide-react';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    class?: string | null;
    seat_number: number | null;
    email: string;
    created_at: string;
    is_admin: boolean;
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
    const [selectedForAward, setSelectedForAward] = useState<string[]>([]);
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
                    .select('user_id, coins');

                if (roomError) console.warn('Error fetching room data:', roomError);
                const roomDataMap = new Map((roomData || []).map(r => [r.user_id, r.coins]));

                finalUsers = usersData.map((u: any) => ({
                    id: u.id,
                    display_name: u.display_name || u.user_metadata?.display_name || u.email,
                    avatar_url: u.avatar_url || u.user_metadata?.avatar_url || null,
                    coins: roomDataMap.get(u.id) || 0,
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
                await fetchUsers();
            }
            setShowAwardModal(false);
            setSelectedForAward([]);
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

    if (!isAdmin && !isGuestMode) {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-12">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                            {isGuestMode ? 'Class View (Guest)' : 'Class Dashboard'}
                        </h1>
                        <p className="text-sm md:text-base text-slate-500">
                            {isGuestMode ? 'Request rewards for students' : 'Manage student rewards and feedback'}
                        </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => {
                                setSelectedForAward([]);
                                setShowAwardModal(true);
                            }}
                            className="flex-1 md:flex-none justify-center flex items-center gap-2 px-4 py-3 md:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm transition-all"
                        >
                            <Settings2 size={20} className="text-slate-400" />
                            {isGuestMode ? 'Request Reward' : 'Manage Rewards'}
                        </button>
                    </div>
                </div>

                <div className="space-y-8">
                    {isLoading ? (
                        <div className="p-8 text-center">Loading users...</div>
                    ) : (
                        Object.entries(groupedUsers).sort(([a], [b]) => a.localeCompare(b)).map(([className, classUsers]) => (
                            <div key={className} className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                                <h2 className="text-xl font-bold text-slate-800 mb-4 px-2 border-l-4 border-blue-500 pl-3">
                                    {className === 'Unassigned' ? 'No Class Assigned' : className}
                                </h2>
                                <ClassDistributor
                                    users={classUsers}
                                    isLoading={false}
                                    onAwardCoins={async (ids) => {
                                        setSelectedForAward(ids);
                                        setShowAwardModal(true);
                                    }}
                                    onStudentClick={handleStudentClick}
                                    onReorder={handleReorder}
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>

            <CoinAwardModal
                isOpen={showAwardModal}
                onClose={() => setShowAwardModal(false)}
                selectedCount={selectedForAward.length}
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

        </div>
    );
}
