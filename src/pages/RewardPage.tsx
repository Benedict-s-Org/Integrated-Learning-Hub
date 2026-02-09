import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, Loader2, AlertCircle, Settings2, Star, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { REWARD_ICON_MAP } from '@/constants/rewardConfig';
import { CoinAwardModal, ClassReward } from '@/components/admin/CoinAwardModal';
import React from 'react';

const SUB_OPTIONS = ["中文", "英文", "數學", "常識", "其他"];
const SPECIAL_REWARD_TITLE = "完成班務（欠功課）";

export function RewardPage() {
    const { qrToken } = useParams<{ qrToken: string }>();
    const navigate = useNavigate();

    const [student, setStudent] = useState<any | null>(null);
    const [rewards, setRewards] = useState<ClassReward[]>([]);
    const [consequences, setConsequences] = useState<ClassReward[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [awarding, setAwarding] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showManageModal, setShowManageModal] = useState(false);

    // Sub-options selection
    const [pendingSubOptions, setPendingSubOptions] = useState<{ reward: ClassReward; selected: string[] } | null>(null);

    // Check if current user is admin and fetch student info
    useEffect(() => {
        const init = async () => {
            try {
                // Check admin status
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setError('Please log in as an admin to award coins.');
                    setLoading(false);
                    return;
                }

                // Check if user is admin
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                if (!profile || profile.role !== 'admin') {
                    setError('Only administrators can award coins.');
                    setLoading(false);
                    return;
                }
                setIsAdmin(true);

                // Fetch student by QR token
                if (!qrToken) {
                    setError('Invalid QR code.');
                    setLoading(false);
                    return;
                }

                const { data: studentData, error: studentError } = await supabase
                    .from('users')
                    .select('id, username, class')
                    .eq('qr_token', qrToken)
                    .single();

                if (studentError || !studentData) {
                    setError('Student not found. The QR code may be invalid.');
                    setLoading(false);
                    return;
                }

                setStudent(studentData);
                await fetchRewards();
                setLoading(false);
            } catch (err) {
                console.error('Error initializing reward page:', err);
                setError('An unexpected error occurred.');
                setLoading(false);
            }
        };

        init();
    }, [qrToken]);

    const fetchRewards = async () => {
        const { data } = await supabase
            .from('class_rewards')
            .select('*')
            .order('title', { ascending: true });

        const allItems = data || [];
        setRewards(allItems.filter(i => i.coins >= 0));
        setConsequences(allItems.filter(i => i.coins < 0));
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

    // Award coins to the student
    const handleAward = async (amount: number, reason: string) => {
        if (!student || awarding) return;

        setAwarding(true);
        setSuccessMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // 1. Update student's coins using RPC
            const { error: rpcError } = await (supabase.rpc as any)('increment_room_coins', {
                target_user_id: student.id,
                amount: amount,
                log_reason: reason,
                log_admin_id: user.id
            });

            if (rpcError) throw rpcError;

            // 2. Success feedback
            setSuccessMessage(`${amount > 0 ? '+' : ''}${amount} coins for ${reason}!`);

            // Clear success message after 2 seconds
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err) {
            console.error('Failed to award coins:', err);
            setError('Failed to award coins. Please try again.');
        } finally {
            setAwarding(false);
        }
    };

    const onRewardClick = (reward: ClassReward) => {
        if (awarding) return;
        if (reward.title === SPECIAL_REWARD_TITLE) {
            setPendingSubOptions({ reward, selected: [] });
        } else {
            handleAward(reward.coins, reward.title);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-gray-600">Loading Rewards...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h1>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    // Main reward interface
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 sm:p-8 relative">
            {/* Sub-option Selection Overlay */}
            {pendingSubOptions && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
                        <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">{pendingSubOptions.reward.title}</h3>
                        <p className="text-sm text-gray-500 mb-8 text-center">Select subjects to complete (Total 10 Coins)</p>

                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {SUB_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => handleSubOptionToggle(opt)}
                                    className={`px-4 py-4 rounded-2xl border-2 font-bold transition-all text-center
                                        ${pendingSubOptions.selected.includes(opt)
                                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                                            : 'border-gray-100 bg-white text-gray-400 hover:border-gray-200'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setPendingSubOptions(null)}
                                className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubOptionSubmit}
                                disabled={pendingSubOptions.selected.length === 0}
                                className="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                            >
                                Award 10 Coins
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="max-w-2xl mx-auto mb-8">
                <div className="flex justify-between items-start mb-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </button>

                    <button
                        onClick={() => setShowManageModal(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold shadow-sm transition-all"
                    >
                        <Settings2 size={16} className="text-gray-400" />
                        Manage Items
                    </button>
                </div>

                {/* Student Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">
                            {student?.username?.charAt(0).toUpperCase() || '?'}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">{student?.username}</h1>
                    {student?.class && (
                        <p className="text-gray-500 mt-1 font-medium bg-gray-100 inline-block px-3 py-0.5 rounded-full text-sm">
                            Class: {student.class}
                        </p>
                    )}
                </div>
            </div>

            {/* Success Toast */}
            {successMessage && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
                    <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
                        <Check size={20} />
                        <span className="font-semibold">{successMessage}</span>
                    </div>
                </div>
            )}

            {/* Skills Grid */}
            <div className="max-w-2xl mx-auto space-y-10">
                {/* Rewards Section */}
                <div>
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 text-center flex items-center justify-center gap-2">
                        <Star size={14} className="text-yellow-500" />
                        Quick Rewards
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {rewards.map(reward => (
                            <button
                                key={reward.id}
                                onClick={() => onRewardClick(reward)}
                                disabled={awarding}
                                className={`
                                    group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white shadow-sm border border-gray-100
                                    hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 transition-all duration-200
                                    ${awarding ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                <div className={`w-14 h-14 rounded-2xl ${reward.color} flex items-center justify-center text-3xl shadow-sm group-hover:shadow-md transition-shadow`}>
                                    {React.createElement(REWARD_ICON_MAP[reward.icon] || Star, { size: 28 })}
                                </div>
                                <div className="text-center w-full">
                                    <div className="font-bold text-gray-700 truncate px-1 text-sm">{reward.title}</div>
                                    <div className="text-[10px] font-black inline-block px-2 py-0.5 rounded-full mt-1 text-green-600 bg-green-50">
                                        +{reward.coins}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Consequences Section */}
                {consequences.length > 0 && (
                    <div>
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 text-center flex items-center justify-center gap-2">
                            <AlertTriangle size={14} className="text-red-500" />
                            Consequences
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {consequences.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => onRewardClick(item)}
                                    disabled={awarding}
                                    className={`
                                        group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white shadow-sm border border-gray-100
                                        hover:shadow-xl hover:-translate-y-1 hover:border-red-200 transition-all duration-200
                                        ${awarding ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                >
                                    <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center text-3xl shadow-sm group-hover:shadow-md transition-shadow`}>
                                        {React.createElement(REWARD_ICON_MAP[item.icon] || AlertTriangle, { size: 28 })}
                                    </div>
                                    <div className="text-center w-full">
                                        <div className="font-bold text-gray-700 truncate px-1 text-sm">{item.title}</div>
                                        <div className="text-[10px] font-black inline-block px-2 py-0.5 rounded-full mt-1 text-red-600 bg-red-50">
                                            {item.coins}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <p className="text-center text-gray-400 text-sm mt-8">
                Tap a category to award coins to {student?.username}
            </p>

            <CoinAwardModal
                isOpen={showManageModal}
                onClose={() => {
                    setShowManageModal(false);
                    fetchRewards(); // Refresh in case items were changed
                }}
                selectedCount={1}
                onAward={(amount, reason) => handleAward(amount, reason)}
            />
        </div>
    );
}

export default RewardPage;
