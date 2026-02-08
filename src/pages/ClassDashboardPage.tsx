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
    const [groupedUsers, setGroupedUsers] = useState<Record<string, UserWithCoins[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [showAwardModal, setShowAwardModal] = useState(false);
    const [selectedForAward, setSelectedForAward] = useState<string[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<UserWithCoins | null>(null);
    const [allUsers, setAllUsers] = useState<UserWithCoins[]>([]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.functions.invoke('auth/list-users', {
                body: { adminUserId: currentUser?.id }
            });

            if (authError) throw authError;

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
                avatar_url: u.avatar_url || u.user_metadata?.avatar_url || null,
                coins: roomDataMap.get(u.id) || 0,
                class: u.class || u.user_metadata?.class || 'Unassigned',
                seat_number: u.seat_number || null,
                email: u.email || '',
                created_at: u.created_at || new Date().toISOString(),
                is_admin: u.role === 'admin'
            }));

            setAllUsers(usersWithCoins);

            const grouped = usersWithCoins.reduce((acc, user) => {
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
        if (isAdmin && currentUser) {
            fetchUsers();
        }
    }, [isAdmin, currentUser]);

    const handleAwardCoins = async (userIds: string[], amount: number) => {
        try {
            for (const userId of userIds) {
                const { error } = await supabase.rpc('increment_room_coins' as any, {
                    target_user_id: userId,
                    amount: amount
                });

                if (error) {
                    console.error(`Failed to award coins to ${userId}:`, error);
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

    const handleReorder = async (newOrder: UserWithCoins[]) => {
        try {
            console.log('Starting reorder for', newOrder.length, 'students');

            const updates = newOrder.map((student, index) => ({
                userId: student.id,
                classNumber: index + 1,
                class: student.class // Maintain existing class name
            }));

            const { data, error } = await supabase.functions.invoke('auth/bulk-update-class-numbers', {
                body: {
                    adminUserId: currentUser?.id,
                    updates: updates,
                    syncAuthMetadata: false // Skip slow sync
                }
            });

            if (error) throw error;

            if (data?.errors && data.errors.length > 0) {
                console.warn('Some reorder updates failed:', data.errors);
            }

            console.log('Bulk update successful, refreshing users...');
            await fetchUsers();
        } catch (err) {
            console.error('Failed to reorder students:', err);
            alert('Failed to save order. Please check console.');
            throw err;
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
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Class Dashboard</h1>
                        <p className="text-slate-500">Manage student rewards and feedback</p>
                    </div>

                    {isAdmin && (
                        <button
                            onClick={() => {
                                setSelectedForAward([]);
                                setShowAwardModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm transition-all"
                        >
                            <Settings2 size={20} className="text-slate-400" />
                            Manage Rewards
                        </button>
                    )}
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
