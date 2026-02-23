import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Loader2, AlertCircle, KeyRound, LogIn, Star, AlertTriangle, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { REWARD_ICON_MAP, DEFAULT_SUB_OPTIONS } from '@/constants/rewardConfig';
import { ClassReward } from '@/components/admin/CoinAwardModal';
import { RewardSubOptionOverlay } from '@/components/admin/RewardSubOptionOverlay';
import { playSuccessSound } from '@/utils/audio';
import React from 'react';

const SCANNER_EMAIL = 'scanner@system.local';

interface StudentInfo {
    id: string;
    username: string;
    display_name: string | null;
    class: string | null;
    coins: number;
    virtual_coins?: number;
    daily_real_earned?: number; // Add this
}

export function QuickRewardPage() {
    const { qrToken } = useParams<{ qrToken: string }>();
    const { user } = useAuth();

    const [accessCode, setAccessCode] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [rewards, setRewards] = useState<ClassReward[]>([]);
    const [consequences, setConsequences] = useState<ClassReward[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [awarding, setAwarding] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Custom amount state
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customValues, setCustomValues] = useState<Record<string, string>>({});

    // Sub-options selection
    const [pendingSubOptions, setPendingSubOptions] = useState<{ reward: ClassReward; selected: string[] } | null>(null);

    const getEffectiveSubOptions = (reward: ClassReward) => {
        if (reward.sub_options && Object.keys(reward.sub_options).length > 0) {
            return reward.sub_options;
        }
        return DEFAULT_SUB_OPTIONS;
    };

    // Initialize: Check Auth & Fetch Student & Rewards
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError(null);

            // 1. Check Authentication
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setLoading(false);
                return;
            }

            // 2. Fetch Student (if authenticated)
            if (!qrToken) {
                setError('Invalid QR code.');
                setLoading(false);
                return;
            }

            try {
                const { data: studentData, studentError } = (await supabase
                    .from('users')
                    .select('id, username, class')
                    .eq('qr_token', qrToken)
                    .single() as any);

                if (studentError || !studentData) {
                    setError('Student not found. The QR code may be invalid.');
                    setLoading(false);
                    return;
                }

                // Fetch- [x] Allow Warning Consequence (-0) for consequences
                // - [x] Update `CoinAwardModal.tsx` validation and display logic
                // - [x] Update `QuickRewardPage.tsx` display logic
                // - [x] Update `QRScannerPage.tsx` display logic
                // - [x] Update `RewardPage.tsx` display logic
                // - [x] Update `StudentOverview.tsx` display logic
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('display_name')
                    .eq('id', studentData.id)
                    .single();

                const { data: roomData } = await (supabase
                    .from('user_room_data' as any)
                    .select('user_id, coins, virtual_coins, daily_counts')
                    .eq('user_id', studentData.id)
                    .single() as any);

                const today = new Date().toISOString().split('T')[0];
                const dailyRealEarned = (roomData as any)?.daily_counts?.date === today ? ((roomData as any)?.daily_counts?.real_earned || 0) : 0;

                setStudent({
                    ...studentData,
                    display_name: profile?.display_name || null,
                    coins: roomData?.coins || 0,
                    virtual_coins: roomData?.virtual_coins || 0,
                    daily_real_earned: dailyRealEarned,
                });

                // Fetch Rewards from DB
                const { data: rewardsData } = await (supabase
                    .from('class_rewards' as any)
                    .select('*')
                    .order('created_at', { ascending: true }) as any);

                const allItems = (rewardsData || []) as any[];
                setRewards(allItems.filter(i => i.coins >= 0));
                setConsequences(allItems.filter(i => i.coins <= 0));

            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load required data.');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [qrToken, user]);

    // Handle Scanner Login
    const handleScannerLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAuthenticating(true);
        setAuthError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: SCANNER_EMAIL,
                password: accessCode
            });

            if (error) {
                setAuthError('Invalid Access Code');
            }
        } catch (err) {
            setAuthError('Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    };


    const handleRewardClick = (item: ClassReward) => {
        if (awarding) return;

        // In custom mode, clicking the item itself does nothing unless it's a special reward
        if (isCustomMode) return;

        const effectiveSubs = getEffectiveSubOptions(item);
        const hasSubs = Object.keys(effectiveSubs).length > 0;

        if (hasSubs) {
            setPendingSubOptions({ reward: item, selected: [] });
        } else {
            handleAward(item.coins, item.title);
        }
    };

    // Award coins
    const handleAward = async (amount: number, reason: string) => {
        if (!student || awarding) return;

        setAwarding(true);
        setSuccessMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.reload();
                return;
            }

            // 1. Update student's coins using RPC
            const { error: rpcError } = await (supabase.rpc as any)('increment_room_coins', {
                target_user_id: student.id,
                amount: amount,
                log_reason: reason,
                log_admin_id: user.id
            });

            if (rpcError) throw rpcError;

            playSuccessSound();
            setSuccessMessage(`${amount > 0 ? '+' : ''}${amount} coins for ${reason}!`);
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err) {
            console.error('Failed to award coins:', err);
            setError('Failed to award coins. Please try again.');
        } finally {
            setAwarding(false);
        }
    };

    if (loading && user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <KeyRound size={32} />
                        </div>
                        <h1 className="text-xl font-bold text-gray-800">Scanner Access</h1>
                        <p className="text-sm text-gray-500 mt-2">Enter the daily access code to start awarding coins.</p>
                    </div>

                    <form onSubmit={handleScannerLogin} className="space-y-4">
                        <input
                            type="password"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            placeholder="Access Code"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center text-lg tracking-widest"
                            autoFocus
                        />
                        {authError && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 justify-center">
                                <AlertCircle size={16} />
                                {authError}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={isAuthenticating || !accessCode}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAuthenticating ? <Loader2 className="animate-spin" /> : <LogIn size={20} />}
                            Unlock Scanner
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800">Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-200 rounded-lg font-medium">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 relative">
            {/* Sub-option Selection Overlay (Shared Component) */}
            {pendingSubOptions && (
                <RewardSubOptionOverlay
                    reward={pendingSubOptions.reward}
                    onClose={() => setPendingSubOptions(null)}
                    onSubmit={(selectedItems) => {
                        const reason = `${pendingSubOptions.reward.title}: ${selectedItems.join(', ')}`;
                        handleAward(pendingSubOptions.reward.coins, reason);
                        setPendingSubOptions(null);
                    }}
                />
            )}

            <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 text-center mt-4 border border-gray-100">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-md relative group">
                    <span className="text-3xl font-bold text-white">
                        {(student?.display_name || student?.username)?.charAt(0).toUpperCase()}
                    </span>
                    <button
                        onClick={() => setIsCustomMode(!isCustomMode)}
                        className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all scale-100 active:scale-90
                            ${isCustomMode ? 'bg-orange-500 text-white' : 'bg-white text-gray-400 hover:text-orange-500'}
                        `}
                        title="Toggle Custom Reward Amounts"
                    >
                        <Plus size={16} strokeWidth={3} />
                    </button>
                </div>
                <h1 className="text-xl font-black text-gray-800 mb-1">{student?.display_name || student?.username}</h1>
                <div className="flex justify-center items-center gap-2">
                    <p className="text-gray-500 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full text-xs">
                        {student?.class || 'No Class'}
                    </p>
                    <div className="px-3 py-1 bg-yellow-100 text-yellow-700 font-bold rounded-full text-xs flex items-center gap-1">
                        <span>🪙</span>
                        <span>{(student?.coins || 0) - (student?.daily_real_earned || 0)}+{student?.daily_real_earned || 0}</span>
                        <span className="opacity-75">({student?.virtual_coins || 0})</span>
                    </div>
                </div>
            </div>

            {successMessage && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold">
                        <Check size={24} strokeWidth={3} />
                        <span>{successMessage}</span>
                    </div>
                </div>
            )}

            <div className="w-full max-w-md mt-6 space-y-6">
                {/* Rewards Section */}
                <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
                        <Star size={14} className="text-yellow-500" />
                        Rewards
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {rewards.map(reward => (
                            <button
                                key={reward.id}
                                onClick={() => handleRewardClick(reward)}
                                disabled={awarding}
                                className={`
                                    relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm
                                    active:scale-95 transition-all duration-100 touch-manipulation
                                    ${awarding ? 'opacity-50' : 'hover:shadow-md hover:border-blue-200'}
                                `}
                            >
                                <div className={`w-12 h-12 rounded-xl ${reward.color} flex items-center justify-center mb-1`}>
                                    {React.createElement(REWARD_ICON_MAP[reward.icon] || Star, { size: 24, strokeWidth: 2.5 })}
                                </div>
                                <span className="font-bold text-gray-700 text-xs leading-tight text-center truncate w-full px-1">{reward.title}</span>
                                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                    <div className="text-[10px] font-black px-1.5 py-0.5 rounded-md text-green-600 bg-green-50">
                                        {reward.coins > 0 ? `+${reward.coins}` : reward.coins}
                                    </div>
                                </div>

                                {isCustomMode && (
                                    <div className="mt-2 flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="number"
                                            value={customValues[reward.id] ?? reward.coins}
                                            onChange={(e) => setCustomValues({
                                                ...customValues,
                                                [reward.id]: e.target.value
                                            })}
                                            className="flex-1 min-w-0 px-2 py-1 text-xs border rounded-lg text-center font-bold focus:ring-1 focus:ring-orange-300 outline-none"
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const amount = parseInt(customValues[reward.id]);
                                                handleAward(isNaN(amount) ? reward.coins : amount, reward.title);
                                            }}
                                            className="p-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
                                        >
                                            <Check size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Consequences Section */}
                {consequences.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
                            <AlertTriangle size={14} className="text-red-500" />
                            Consequences
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {consequences.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleRewardClick(item)}
                                    disabled={awarding}
                                    className={`
                                        relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm
                                        active:scale-95 transition-all duration-100 touch-manipulation
                                        ${awarding ? 'opacity-50' : 'hover:shadow-md hover:border-red-200'}
                                    `}
                                >
                                    <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-1`}>
                                        {React.createElement(REWARD_ICON_MAP[item.icon] || AlertTriangle, { size: 24, strokeWidth: 2.5 })}
                                    </div>
                                    <span className="font-bold text-gray-700 text-xs leading-tight text-center truncate w-full px-1">{item.title}</span>
                                    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                        <div className="text-[10px] font-black px-1.5 py-0.5 rounded-md text-red-600 bg-red-50">
                                            {item.coins === 0 ? '-0' : item.coins}
                                        </div>
                                    </div>

                                    {isCustomMode && (
                                        <div className="mt-2 flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="number"
                                                value={customValues[item.id] ?? item.coins}
                                                onChange={(e) => setCustomValues({
                                                    ...customValues,
                                                    [item.id]: e.target.value
                                                })}
                                                className="flex-1 min-w-0 px-2 py-1 text-xs border rounded-lg text-center font-bold focus:ring-1 focus:ring-red-300 outline-none"
                                                onClick={e => e.stopPropagation()}
                                            />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const amount = parseInt(customValues[item.id]);
                                                    handleAward(isNaN(amount) ? item.coins : amount, item.title);
                                                }}
                                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                                            >
                                                <Check size={14} strokeWidth={3} />
                                            </button>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <p className="mt-8 text-[10px] text-center text-gray-300 max-w-xs uppercase tracking-widest font-bold">
                Tap button to instantly award
            </p>
        </div>
    );
}

export default QuickRewardPage;
