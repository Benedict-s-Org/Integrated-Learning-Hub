import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ClassDistributor } from '@/components/admin/ClassDistributor';
import { CoinAwardModal } from '@/components/admin/CoinAwardModal';
import { StudentProfileModal } from '@/components/admin/StudentProfileModal';

interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    class?: string | null;
}

export function ClassDashboardPage() {
    const { isAdmin, user: currentUser } = useAuth();
    const [groupedUsers, setGroupedUsers] = useState<Record<string, UserWithCoins[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [showAwardModal, setShowAwardModal] = useState(false);
    const [selectedForAward, setSelectedForAward] = useState<string[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<UserWithCoins | null>(null);
    // Keep track of all users for searching/lookup if needed, though strictly we use groupedUsers for display
    const [allUsers, setAllUsers] = useState<UserWithCoins[]>([]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            // Fetch users from Auth Edge Function to get metadata (class)
            const { data: authData, error: authError } = await supabase.functions.invoke('auth/list-users', {
                body: { adminUserId: currentUser?.id }
            });

            if (authError) throw authError;

            // Fetch room data for coins
            const { data: roomData, error: roomError } = await supabase
                .from('user_room_data')
                .select('user_id, coins');

            if (roomError) {
                console.warn('Error fetching room data:', roomError);
            }

            const roomDataMap = new Map((roomData || []).map(r => [r.user_id, r.coins]));

            const usersWithCoins: UserWithCoins[] = (authData.users || []).map((u: any) => ({
                id: u.id,
                display_name: u.display_name || u.user_metadata?.display_name || u.email,
                avatar_url: u.user_metadata?.avatar_url || null,
                coins: roomDataMap.get(u.id) || 0,
                class: u.class || u.user_metadata?.class || 'Unassigned'
            }));

            setAllUsers(usersWithCoins);

            // Group by class
            const grouped = usersWithCoins.reduce((acc, user) => {
                const className = user.class || 'Unassigned';
                if (!acc[className]) {
                    acc[className] = [];
                }
                acc[className].push(user);
                return acc;
            }, {} as Record<string, UserWithCoins[]>);

            // Sort users within each group
            Object.keys(grouped).forEach(key => {
                grouped[key].sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
            });

            setGroupedUsers(grouped);

        } catch (err) {
            console.error('Error in fetchUsers:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin && currentUser) {
            fetchUsers();
        }
    }, [isAdmin, currentUser]);

    const handleAwardCoins = async (userIds: string[], amount: number) => {
        try {
            for (const userId of userIds) {
                // Use the new RPC for room coins
                const { error } = await supabase.rpc('increment_room_coins' as any, {
                    target_user_id: userId,
                    amount: amount
                });

                if (error) {
                    console.error(`Failed to award coins to ${userId}:`, error);
                    // Fallback manual update
                    const user = allUsers.find(u => u.id === userId);
                    if (user) {
                        await supabase
                            .from('user_room_data')
                            .update({ coins: (user.coins || 0) + amount })
                            .eq('user_id', userId);
                    }
                }
            }
            await fetchUsers();
            setShowAwardModal(false);
            setSelectedForAward([]);
        } catch (err) {
            console.error('Error awarding coins:', err);
            alert('Failed to award coins');
        }
    };

    const handleStudentClick = (student: UserWithCoins) => {
        setSelectedStudent(student);
    };

    const handleCloseProfile = () => {
        setSelectedStudent(null);
    };

    if (!isAdmin) {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Class Dashboard</h1>
                    <p className="text-slate-500">Manage student rewards and feedback</p>
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
                onAward={(amount) => handleAwardCoins(selectedForAward, amount)}
            />

            <StudentProfileModal
                isOpen={!!selectedStudent}
                onClose={handleCloseProfile}
                student={selectedStudent}
                onUpdateCoins={fetchUsers}
            />
        </div>
    );
}
