import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Loader2, AlertCircle, KeyRound, LogIn, Star, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { REWARD_ICON_MAP } from '@/constants/rewardConfig';
import { ClassReward } from '@/components/admin/CoinAwardModal';
import { playSuccessSound } from '@/utils/audio';
import React from 'react';

const SCANNER_EMAIL = 'scanner@system.local';
const SUB_OPTIONS = ["中文", "英文", "數學", "常識", "其他"];
// Special reward handling is now done via robust string matching

interface StudentInfo {
    id: string;
    username: string;
    display_name: string | null;
    class: string | null;
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

    // Sub-options selection
    const [pendingSubOptions, setPendingSubOptions] = useState<{ reward: ClassReward; selected: string[] } | null>(null);

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

                // Fetch display name from profiles
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('display_name')
                    .eq('id', studentData.id)
                    .single();

                setStudent({
                    ...studentData,
                    display_name: profile?.display_name || null,
                });

                // Fetch Rewards from DB
                const { data: rewardsData } = await (supabase
                    .from('class_rewards' as any)
                    .select('*')
                    .order('created_at', { ascending: true }) as any);

                const allItems = (rewardsData || []) as any[];
                setRewards(allItems.filter(i => i.coins >= 0));
                setConsequences(allItems.filter(i => i.coins < 0));

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

    // Sub-option handlers
    const handleSubOptionToggle = (option: string) => {
        if (!pendingSubOptions) return;
        const selected = pendingSubOptions.selected.includes(option)
            ? pendingSubOptions.selected.filter(o => o !== option)
            : [...pendingSubOptions.selected, option];
        setPendingSubOptions({ ...pendingSubOptions, selected });
    };

    const handleSubOptionSubmit = () => {
        if (!pendingSubOptions || pendingSubOptions.selected.length === 0) return;
        const reason = `${pendingSubOptions.reward.title}: ${pendingSubOptions.selected.join(', ')}`;
        handleAward(pendingSubOptions.reward.coins, reason);
        setPendingSubOptions(null);
    };

    const handleRewardClick = (item: ClassReward) => {
        if (awarding) return;

        // Robust title matching for "完成班務（欠功課）"
        const isSpecialReward = item.title.trim().includes("完成班務") && item.title.includes("欠功課");

        if (isSpecialReward) {
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
            {/* Sub-option Selection Overlay */}
            {pendingSubOptions && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
                        <h3 className="text-xl font-bold text-gray-800 mb-1 text-center">{pendingSubOptions.reward.title}</h3>
                        <p className="text-[10px] text-gray-400 mb-6 text-center uppercase tracking-widest font-bold">Total 10 Coins</p>

                        <div className="grid grid-cols-2 gap-2 mb-8">
                            {SUB_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => handleSubOptionToggle(opt)}
                                    className={`px-3 py-3 rounded-2xl border-2 font-bold transition-all text-sm
                                        ${pendingSubOptions.selected.includes(opt)
                                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                                            : 'border-gray-50 bg-gray-50/50 text-gray-400 hover:border-gray-100'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setPendingSubOptions(null)}
                                className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubOptionSubmit}
                                disabled={pendingSubOptions.selected.length === 0}
                                className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 text-sm"
                            >
                                Award Coins
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 text-center mt-4 border border-gray-100">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto mb-3 flex items-center justify-center shadow-md">
                    <span className="text-3xl font-bold text-white">
                        {(student?.display_name || student?.username)?.charAt(0).toUpperCase()}
                    </span>
                </div>
                <h1 className="text-xl font-black text-gray-800 mb-1">{student?.display_name || student?.username}</h1>
                <p className="text-gray-500 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full text-xs">
                    {student?.class || 'No Class'}
                </p>
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
                                <div className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded-md text-green-600 bg-green-50">
                                    +{reward.coins}
                                </div>
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
                                    <div className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded-md text-red-600 bg-red-50">
                                        {item.coins}
                                    </div>
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
