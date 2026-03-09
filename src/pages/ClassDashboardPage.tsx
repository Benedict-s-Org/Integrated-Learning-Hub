import { useState, useEffect, useMemo } from 'react';
import { getHKTodayString, getHKTodayStartISO, isHKMorningTime } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ClassDistributor } from '@/components/admin/ClassDistributor';
import { REWARD_REASONS } from '@/constants/rewardConfig';
import { CoinAwardModal } from '@/components/admin/CoinAwardModal';
import { StudentProfileModal } from '@/components/admin/StudentProfileModal';
import { History, Settings2, LayoutGrid, Users, Activity, Layers, Save, Zap } from 'lucide-react';
import { playSuccessSound } from '@/utils/audio';
import { UniversalMessageToolbar } from '@/components/admin/notifications/UniversalMessageToolbar';
import { MorningDutiesBoard } from '@/components/admin/MorningDutiesBoard';
import { ProgressLogModal } from '@/components/admin/ProgressLogModal';
import { StudentNameSidebar } from '@/components/admin/StudentNameSidebar';
import { AvatarImageItem, UserAvatarConfig } from '@/components/avatar/avatarParts';
import { AvatarCustomizationModal } from '@/components/avatar/AvatarCustomizationModal';
import { InteractiveQuizDashboard } from '@/components/admin/InteractiveQuizDashboard';
import { HomeworkModal } from '@/components/admin/HomeworkModal';
import { coinService } from '@/services/coinService';
import { useDocumentPiP } from '@/hooks/useDocumentPiP';
import { PipWindow } from '@/components/common/PipWindow';
import { BroadcastBoard } from '@/components/admin/BroadcastBoard';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface UserWithCoins {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    coins: number;
    virtual_coins?: number;
    daily_real_earned?: number;
    daily_reward_count?: number; // Add this
    class?: string | null;
    class_number: number | null;
    email: string;
    created_at: string;
    is_admin: boolean;
    morning_status?: 'todo' | 'review' | 'completed' | 'absent';
    last_morning_update?: string;
    equipped_item_ids?: string[];
    custom_offsets?: UserAvatarConfig;
    ecas?: string[];
}

interface SortableTabProps {
    id: string;
    label: string;
    isActive: boolean;
    onClick: () => void;
    isEditMode: boolean;
    count?: number;
}

function SortableTab({ id, label, isActive, onClick, isEditMode, count }: SortableTabProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...(isEditMode ? { ...attributes, ...listeners } : {})}
            onClick={isEditMode ? undefined : onClick}
            className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap
                ${isActive
                    ? 'bg-blue-600 text-white shadow-md scale-105'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}
                ${isEditMode ? 'cursor-grab active:cursor-grabbing border-dashed border-blue-400 bg-blue-50/30' : ''}
                ${isDragging ? 'opacity-50' : ''}
            `}
        >
            <Users size={16} />
            {label === 'Unassigned' ? 'Unassigned' : label}
            {count !== undefined && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                </span>
            )}
        </button>
    );
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
    const [showMorningDuties, setShowMorningDuties] = useState(() => isHKMorningTime());
    const [showProgressLog, setShowProgressLog] = useState(false);
    const [showNameSidebar, setShowNameSidebar] = useState(false);
    const [showQuizBoard, setShowQuizBoard] = useState(false);
    const [showBroadcastBoard, setShowBroadcastBoard] = useState(false);

    // Predefined Groups
    const [orderedClasses, setOrderedClasses] = useState<{ id: string, name: string }[]>([]);
    const [orderedActivities, setOrderedActivities] = useState<{ id: string, name: string }[]>([]);

    // PiP State
    const { isSupported: isPipSupported, pipWindow, requestPip, closePip } = useDocumentPiP();
    const isSidebarPoppedOut = !!pipWindow;

    // Nav State
    const [viewMode, setViewMode] = useState<'classes' | 'activities'>('classes');
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeClass, setActiveClass] = useState<string>('all');

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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
                    const today = getHKTodayString();
                    const dailyRealEarned = dailyCounts?.date === today
                        ? (dailyCounts?.real_earned_amount || dailyCounts?.real_earned || 0)
                        : 0;
                    const dailyRewardCount = dailyCounts?.date === today
                        ? (dailyCounts?.real_earned_count || 0)
                        : 0;

                    // Improved: Reset morning_status if the update date is not today
                    const lastUpdateStr = roomInfo?.last_morning_update;
                    const isTodayUpdate = lastUpdateStr === today;
                    const morningStatus = isTodayUpdate ? (roomInfo?.morning_status || 'todo') : 'todo';

                    return {
                        id: u.id,
                        display_name: u.display_name || u.user_metadata?.display_name || u.email,
                        avatar_url: u.avatar_url || u.user_metadata?.avatar_url || null,
                        coins: roomInfo?.coins || 0,
                        virtual_coins: roomInfo?.virtual_coins || 0,
                        daily_real_earned: dailyRealEarned,
                        daily_reward_count: dailyRewardCount,
                        class: u.class || u.user_metadata?.class || 'Unassigned',
                        class_number: u.class_number || null,
                        email: u.email || '',
                        created_at: u.created_at || new Date().toISOString(),
                        is_admin: u.role === 'admin',
                        morning_status: morningStatus,
                        last_morning_update: lastUpdateStr,
                        equipped_item_ids: avatarMap.get(u.id)?.items,
                        custom_offsets: avatarMap.get(u.id)?.offsets,
                        ecas: u.ecas || []
                    };
                });
            }

            let finalUsers: UserWithCoins[] = [];

            if (isGuestMode) {
                finalUsers = usersData.map((u: any) => {
                    const dailyCounts = u.daily_counts || {};
                    const today = getHKTodayString();
                    const dailyRealEarned = dailyCounts?.date === today
                        ? (dailyCounts?.real_earned_amount || dailyCounts?.real_earned || 0)
                        : 0;

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
                        last_morning_update: u.last_morning_update,
                        ecas: u.ecas || []
                    };
                });
            } else {
                finalUsers = usersData as UserWithCoins[];
            }

            // Fetch Predefined Groups
            if (isAdmin) {
                const [classesRes, activitiesRes] = await Promise.all([
                    (supabase as any).from('classes').select('id, name').order('order_index'),
                    (supabase as any).from('activities').select('id, name').order('order_index')
                ]);
                let classData = (classesRes.data || []) as { id: string, name: string }[];
                const activityData = (activitiesRes.data || []) as { id: string, name: string }[];

                // Auto-populate classes table from distinct user class names
                const existingClassNames = new Set(classData.map(c => c.name));
                const userClassNames = [...new Set(
                    finalUsers
                        .map(u => u.class)
                        .filter((c): c is string => !!c && c !== 'Unassigned')
                )];
                const missingClasses = userClassNames.filter(name => !existingClassNames.has(name));

                if (missingClasses.length > 0) {
                    console.log('[fetchUsers] Auto-creating missing classes:', missingClasses);
                    const inserts = missingClasses.map((name, i) => ({
                        name,
                        order_index: classData.length + i
                    }));
                    const { error: insertError } = await (supabase as any)
                        .from('classes')
                        .insert(inserts);

                    if (!insertError) {
                        // Re-fetch to get the new IDs
                        const { data: refreshed } = await (supabase as any)
                            .from('classes')
                            .select('id, name')
                            .order('order_index');
                        classData = (refreshed || []) as { id: string, name: string }[];
                    } else {
                        console.error('[fetchUsers] Failed to auto-create classes:', insertError);
                    }
                }

                setOrderedClasses(classData);
                setOrderedActivities(activityData);

                const classNames = classData.map(c => c.name);
                const activityNames = activityData.map(a => a.name);

                const grouped: Record<string, UserWithCoins[]> = {};

                // Initialize with predefined ones
                [...classNames, ...activityNames].forEach(name => {
                    grouped[name] = [];
                });

                // Safety: Collect any classes present in users but not in predefined list
                finalUsers.forEach(user => {
                    const className = user.class;
                    if (className && className !== 'Unassigned' && !grouped[className]) {
                        grouped[className] = [];
                    }
                });

                grouped['Unassigned'] = [];

                finalUsers.forEach(user => {
                    const className = user.class || 'Unassigned';
                    if (!grouped[className]) grouped[className] = [];
                    grouped[className].push(user);

                    user.ecas?.forEach(eca => {
                        // Normalize ECA name to match predefined activity if possible
                        const matchedActivity = activityData.find(a => a.name.toLowerCase() === eca.toLowerCase());
                        const normalizedEca = matchedActivity ? matchedActivity.name : eca;

                        if (!grouped[normalizedEca]) grouped[normalizedEca] = [];
                        grouped[normalizedEca].push(user);
                    });
                });

                Object.keys(grouped).forEach(key => {
                    grouped[key].sort((a, b) => (a.class_number || 999) - (b.class_number || 999));
                });
                setGroupedUsers(grouped);
            } else {
                // Guest mode
                const grouped = finalUsers.reduce((acc, user) => {
                    const className = user.class || 'Unassigned';
                    if (!acc[className]) acc[className] = [];
                    acc[className].push(user);

                    user.ecas?.forEach(eca => {
                        if (!acc[eca]) acc[eca] = [];
                        if (eca !== className) acc[eca].push(user);
                    });
                    return acc;
                }, {} as Record<string, UserWithCoins[]>);

                Object.keys(grouped).forEach(key => {
                    grouped[key].sort((a, b) => (a.class_number || 999) - (b.class_number || 999));
                });
                setGroupedUsers(grouped);
            }

            // Fetch daily consequences (type: negative) to show frequencies
            const { data: recordData } = await supabase
                .from('student_records')
                .select('student_id')
                .eq('type', 'negative')
                .gte('created_at', getHKTodayStartISO());

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

    // Real-time updates for counts and status
    useEffect(() => {
        const channel = supabase
            .channel('dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_room_data' }, () => {
                fetchUsers();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'student_records' }, () => {
                fetchUsers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleAwardCoins = async (userIds: string[], amount: number, reason?: string, kind?: 'reward' | 'consequence') => {
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
                        reason: reason || 'Class Reward',
                        isInstant: true
                    }
                });

                if (error) throw error;
                await fetchUsers(); // Refresh data immediately
                playSuccessSound();
                alert(`Request submitted for ${userIds.length} students! Admin approval required.`);
            } else {
                const batchId = crypto.randomUUID();
                for (const userId of userIds) {
                    const result = await coinService.awardCoins({
                        userId,
                        amount,
                        reason: reason || REWARD_REASONS.CLASS_REWARD,
                        type: kind === 'consequence' ? 'consequence' : 'reward',
                        batchId: batchId
                    });
                    if (!result.success) {
                        console.error(`Failed to award coins to ${userId}:`, result.error);
                        alert(`Database error when rewarding ${userId}: ${result.error.message}`);
                        throw result.error;
                    }
                }
                playSuccessSound();
                await fetchUsers();
            }

            // Log specific record update is now handled above for all kinds
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

    const handleGuestQuickAward = async (userId: string) => {
        if (!isGuestMode || !guestToken) return;
        try {
            const { error } = await supabase.functions.invoke('public-access/submit-reward', {
                body: {
                    token: guestToken,
                    targetUserIds: [userId],
                    amount: 10,
                    reason: REWARD_REASONS.ANSWER_QUESTION,
                    isInstant: true
                }
            });

            if (error) throw error;
            playSuccessSound();
            // Optimistic-ish update: refresh from DB to see the instant count update from edge function
            await fetchUsers();
        } catch (err) {
            console.error('Guest quick award failed:', err);
            alert('Failed to request reward');
        }
    };

    const handleAwardBulk = async (awards: { userId: string, amount: number, reason?: string }[]) => {
        try {
            const batchId = crypto.randomUUID();
            for (const award of awards) {
                const result = await coinService.awardCoins({
                    userId: award.userId,
                    amount: award.amount,
                    reason: award.reason || REWARD_REASONS.DICTATION_BONUS,
                    type: award.amount > 0 ? 'reward' : 'consequence',
                    batchId: batchId
                });
                if (!result.success) console.error(`Failed to award bonus to ${award.userId}:`, result.error);
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
            // Check for existing records today for "交齊功課" or "欠功課"
            const isHomeworkReason =
                reason === REWARD_REASONS.COMPLETE_ALL_HOMEWORK ||
                reason === REWARD_REASONS.MISSING_HOMEWORK ||
                reason.startsWith('功課:');

            if (isHomeworkReason) {
                // Today's start in HK time
                const todayStart = getHKTodayStartISO();

                const { data: existingRecords, error: fetchError } = await supabase
                    .from('student_records')
                    .select('id, message')
                    .eq('student_id', studentId)
                    .gte('created_at', todayStart)
                    .or(`message.like.完成班務（交齊功課）%,message.like.完成班務（欠功課）%,message.like.功課:%`);

                if (fetchError) {
                    console.error('Error checking existing homework records:', fetchError);
                } else if (existingRecords && existingRecords.length > 0) {
                    const confirmChange = window.confirm("You have record in the system. Do you want to change the record?");
                    if (!confirmChange) return;

                    // Revert the previous record
                    if (isGuestMode) {
                        const { error: revertError } = await supabase.functions.invoke('public-access/revert-homework', {
                            body: {
                                token: guestToken,
                                p_student_id: studentId
                            }
                        });
                        if (revertError) {
                            console.error('Error reverting homework record (Guest):', revertError);
                            alert(`Failed to reset previous record: ${revertError.message}`);
                            return;
                        }
                    } else {
                        const { error: revertError } = await (supabase as any).rpc('revert_homework_record', {
                            p_student_id: studentId
                        });
                        if (revertError) {
                            console.error('Error reverting homework record (Admin):', revertError);
                            alert(`Failed to reset previous record: ${revertError.message}`);
                            return;
                        }
                    }
                }
            }

            let amount = 0;
            if (reason === REWARD_REASONS.COMPLETE_ALL_HOMEWORK) amount = 20;
            else if (reason === REWARD_REASONS.HANDBOOK_ENTRY) amount = 10;
            else if (reason === REWARD_REASONS.MISSING_HOMEWORK) amount = 10;
            else if (reason.startsWith('功課:')) amount = 10; // Missing specific items

            if (isGuestMode) {
                const { error } = await supabase.functions.invoke('public-access/submit-reward', {
                    body: {
                        token: guestToken,
                        targetUserIds: [studentId],
                        amount: amount,
                        reason: reason,
                        isInstant: true // Critical for immediate balance update
                    }
                });
                if (error) throw error;
            } else {
                const result = await coinService.awardCoins({
                    userId: studentId,
                    amount: amount,
                    reason: reason,
                    type: amount >= 0 ? 'reward' : 'consequence',
                    batchId: crypto.randomUUID()
                });
                if (!result.success) throw result.error;
            }

            await fetchUsers(); // Re-enable to ensure student moves to "Review" status instantly
            playSuccessSound();
        } catch (err: any) {
            console.error('Error recording homework FULL:', err);
            const errorMsg = err?.message || err?.details || err?.hint || JSON.stringify(err);
            alert(`Failed to record homework: ${errorMsg}`);
        }
    };

    const handleQuickAward = async (userId: string) => {
        if (isGuestMode) return;
        const reason = REWARD_REASONS.ANSWER_QUESTION;
        const amount = 10;
        try {
            const result = await coinService.awardCoins({
                userId,
                amount,
                reason,
                type: 'reward',
                batchId: crypto.randomUUID()
            });
            if (!result.success) throw result.error;
            playSuccessSound();
            await fetchUsers();
        } catch (err: any) {
            console.error('Quick award failed:', err);
            alert(`Quick award failed: ${err.message || 'Unknown error'}`);
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

    const handleGetGuestLink = async (className: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('public-access/create-link', {
                body: {
                    adminUserId: currentUser?.id,
                    targetClass: className
                }
            });

            if (error) throw error;

            const token = data.token;
            const guestUrl = `${window.location.origin}/class-dashboard?token=${token}`;

            await navigator.clipboard.writeText(guestUrl);
            alert(`Guest link for class ${className} copied to clipboard!`);
        } catch (err) {
            console.error('Failed to create guest link:', err);
            alert('Failed to generate guest link');
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
        const isClassesView = viewMode === 'classes';
        const currentOrderedItems = isClassesView ? orderedClasses : orderedActivities;
        const otherPredefinedNames = (isClassesView ? orderedActivities : orderedClasses).map(i => i.name.toLowerCase());
        const allKeys = Object.keys(groupedUsers);

        if (isAdmin) {
            // Priority 1: Current ordered items (from state, allows DND to work)
            const baseOrder = currentOrderedItems.map(item => item.name);

            // Priority 2: Extra keys found in groupedUsers but not in any predefined state
            const extras = allKeys.filter(k => {
                const kLower = k.toLowerCase();
                const isInBase = baseOrder.some(b => b.toLowerCase() === kLower);
                const isInOther = otherPredefinedNames.includes(kLower);
                return !isInBase && !isInOther && k !== 'Unassigned';
            });

            // Combine based on view mode
            if (isClassesView) {
                return [...baseOrder, ...extras, 'Unassigned'].filter(name => groupedUsers[name] !== undefined);
            } else {
                return baseOrder.filter(name => (groupedUsers[name] !== undefined && (groupedUsers[name]?.length || 0) > 0));
            }
        }

        // Guest mode restricted to a single class
        return allKeys.filter(k => k === activeClass);
    }, [groupedUsers, orderedClasses, orderedActivities, isAdmin, viewMode, activeClass]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        if (viewMode === 'classes') {
            setOrderedClasses((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return items;
                return arrayMove(items, oldIndex, newIndex);
            });
        } else {
            setOrderedActivities((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return items;
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSaveOrder = async () => {
        setIsLoading(true);
        try {
            const items = viewMode === 'classes' ? orderedClasses : orderedActivities;
            const table = viewMode === 'classes' ? 'classes' : 'activities';

            const updates = items.map((item, index) =>
                (supabase as any).from(table).update({ order_index: index }).eq('id', item.id)
            );

            const results = await Promise.all(updates);
            const errors = results.filter(r => r.error).map(r => r.error);

            if (errors.length > 0) throw errors[0];

            setIsEditMode(false);
            await fetchUsers(); // Re-fetch to confirm order
        } catch (err) {
            console.error('Failed to save order:', err);
            alert('Failed to save preferred order');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAdmin && !isGuestMode) {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className={`min-h-screen bg-slate-50 p-2 md:p-12 pt-16 md:pt-32 pb-12 transition-all duration-300 ${showNameSidebar ? 'pr-0 md:pr-52 sidebar-active' : ''}`}>
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
                        {!isGuestMode && (
                            <>
                                <button
                                    onClick={() => setShowProgressLog(true)}
                                    className="flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2.5 md:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm transition-all text-sm"
                                >
                                    <History size={18} className="text-slate-400" />
                                    Progress Log
                                </button>
                                <button
                                    onClick={() => setShowBroadcastBoard(true)}
                                    className="flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2.5 md:py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-sm transition-all text-sm"
                                >
                                    <Zap size={18} className="text-slate-400" />
                                    Broadcast
                                </button>
                            </>
                        )}
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
                                if (isSidebarPoppedOut) {
                                    closePip();
                                } else {
                                    setShowNameSidebar(!showNameSidebar);
                                }
                            }}
                            className={`flex-1 md:flex-none justify-center flex items-center gap-2 px-3 py-2.5 md:py-2 border rounded-xl font-semibold shadow-sm transition-all text-sm
                            ${(showNameSidebar || isSidebarPoppedOut)
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}
                        `}
                            title="Quick award for answering questions"
                        >
                            <Activity size={18} className={(showNameSidebar || isSidebarPoppedOut) ? 'text-blue-600' : 'text-slate-400'} />
                            {isSidebarPoppedOut ? 'Close Desktop Bar' : (showNameSidebar ? 'Hide Name Bar' : 'Enable Name Bar')}
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
                        users={(() => {
                            const rawUsers = activeClass === 'all'
                                ? Object.values(groupedUsers).flat()
                                : (groupedUsers[activeClass] || []);

                            // Deduplicate by ID to avoid composite key issues in MorningDutiesBoard
                            const uniqueUsersMap = new Map();
                            rawUsers.forEach(u => {
                                if (u.class && u.class !== 'Unassigned' && !uniqueUsersMap.has(u.id)) {
                                    uniqueUsersMap.set(u.id, u);
                                }
                            });
                            return Array.from(uniqueUsersMap.values());
                        })()}
                        onReviewClick={(id) => {
                            const student = Object.values(groupedUsers).flat().find(u => u.id === id);
                            if (student) handleStudentClick(student);
                        }}
                    />
                )}

                {(!isGuestMode) && (
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                            <button
                                onClick={() => {
                                    setViewMode('classes');
                                    setActiveClass('all');
                                }}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'classes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Classes
                            </button>
                            <button
                                onClick={() => {
                                    setViewMode('activities');
                                    setActiveClass((orderedActivities[0]?.name) || 'all');
                                }}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'activities' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Activities
                            </button>
                        </div>

                        {isAdmin && (
                            <div className="flex gap-2">
                                {isEditMode ? (
                                    <>
                                        <button
                                            onClick={handleSaveOrder}
                                            className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-all flex items-center gap-2"
                                        >
                                            <Save size={16} />
                                            Save Order
                                        </button>
                                        <button
                                            onClick={() => setIsEditMode(false)}
                                            className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setIsEditMode(true)}
                                        className="px-4 py-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-all flex items-center gap-2"
                                    >
                                        <Layers size={16} />
                                        Edit Order
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {(!isGuestMode) && (
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                        {viewMode === 'classes' && (
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
                        )}

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={sortedClassNames.map(className =>
                                    (viewMode === 'classes' ? orderedClasses : orderedActivities).find(i => i.name === className)?.id || className
                                )}
                                strategy={horizontalListSortingStrategy}
                            >
                                {sortedClassNames.map(className => {
                                    const id = (viewMode === 'classes' ? orderedClasses : orderedActivities).find(i => i.name === className)?.id || className;
                                    return (
                                        <SortableTab
                                            key={className}
                                            id={id}
                                            label={className}
                                            isActive={activeClass === className}
                                            onClick={() => setActiveClass(className)}
                                            isEditMode={isEditMode}
                                            count={groupedUsers[className]?.length}
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
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
                                            onHomeworkClick={viewMode === 'classes' ? (student) => setSelectedHomeworkStudentId(student.id) : undefined}
                                            onReorder={handleReorder}
                                            selectedIds={selectedStudentIds}
                                            onSelectionChange={setSelectedStudentIds}
                                            isGuestMode={isGuestMode}
                                            consequenceCounts={consequenceCounts}
                                            className={className}
                                            onGetGuestLink={handleGetGuestLink}
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
                                                onHomeworkClick={viewMode === 'classes' ? (student) => setSelectedHomeworkStudentId(student.id) : undefined}
                                                onReorder={handleReorder}
                                                selectedIds={selectedStudentIds}
                                                onSelectionChange={setSelectedStudentIds}
                                                isGuestMode={isGuestMode}
                                                consequenceCounts={consequenceCounts}
                                                className={activeClass}
                                                onGetGuestLink={handleGetGuestLink}
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
                onAward={(amount, reason, kind) => handleAwardCoins(selectedForAward, amount, reason, kind)}
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

            {showNameSidebar && !isSidebarPoppedOut && (
                <StudentNameSidebar
                    users={
                        activeClass === 'all'
                            ? Object.values(groupedUsers).flat().filter(u => u.class && u.class !== 'Unassigned')
                            : (groupedUsers[activeClass] || []).filter(u => u.class && u.class !== 'Unassigned')
                    }
                    onQuickAward={isGuestMode ? handleGuestQuickAward : handleQuickAward}
                    onClose={() => setShowNameSidebar(false)}
                    onPopOut={isPipSupported ? async () => {
                        await requestPip({ width: 200, height: window.screen.availHeight });
                        setShowNameSidebar(false); // Hide the in-app sidebar when popped out
                    } : undefined}
                />
            )}

            {isSidebarPoppedOut && (
                <PipWindow pipWindow={pipWindow}>
                    <StudentNameSidebar
                        users={
                            activeClass === 'all'
                                ? Object.values(groupedUsers).flat().filter(u => u.class && u.class !== 'Unassigned')
                                : (groupedUsers[activeClass] || []).filter(u => u.class && u.class !== 'Unassigned')
                        }
                        onQuickAward={isGuestMode ? handleGuestQuickAward : handleQuickAward}
                        isPoppedOut={true}
                    />
                </PipWindow>
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

            <ProgressLogModal
                isOpen={showProgressLog}
                onClose={() => setShowProgressLog(false)}
            />

            {showBroadcastBoard && activeClass !== 'all' && (
                <BroadcastBoard
                    className={activeClass}
                    isGuestMode={isGuestMode}
                    guestToken={guestToken}
                    onClose={() => setShowBroadcastBoard(false)}
                />
            )}
        </div>
    );
}
