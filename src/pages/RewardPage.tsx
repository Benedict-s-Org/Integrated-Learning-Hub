import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, Star, Zap, Trophy, BookOpen, Users, Check, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// Skill buttons for awarding coins (same as CoinAwardModal)
const SKILLS = [
    { id: 'helping', name: 'Helping Others', amount: 1, icon: Heart, color: 'text-pink-500', bg: 'bg-pink-100' },
    { id: 'ontask', name: 'On Task', amount: 1, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-100' },
    { id: 'participating', name: 'Participating', amount: 1, icon: Zap, color: 'text-purple-500', bg: 'bg-purple-100' },
    { id: 'teamwork', name: 'Teamwork', amount: 2, icon: Users, color: 'text-blue-500', bg: 'bg-blue-100' },
    { id: 'persistence', name: 'Working Hard', amount: 2, icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-100' },
    { id: 'homework', name: 'Homework', amount: 5, icon: BookOpen, color: 'text-green-500', bg: 'bg-green-100' },
];

interface StudentInfo {
    id: string;
    username: string;
    class: string | null;
}

export function RewardPage() {
    const { qrToken } = useParams<{ qrToken: string }>();
    const navigate = useNavigate();

    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [awarding, setAwarding] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
                const { data: profile } = await (supabase
                    .from('user_profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single() as any);

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

                const { data: studentData, error: studentError } = await (supabase
                    .from('users')
                    .select('id, username, class')
                    .eq('qr_token', qrToken)
                    .single() as any);

                if (studentError || !studentData) {
                    setError('Student not found. The QR code may be invalid.');
                    setLoading(false);
                    return;
                }

                setStudent(studentData);
                setLoading(false);
            } catch (err) {
                console.error('Error initializing reward page:', err);
                setError('An unexpected error occurred.');
                setLoading(false);
            }
        };

        init();
    }, [qrToken]);

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
                amount: amount
            });

            if (rpcError) throw rpcError;

            // 2. Log the transaction
            const { error: txError } = await (supabase
                .from('coin_transactions' as any)
                .insert({
                    user_id: student.id,
                    amount: amount,
                    reason: reason,
                    created_by: user.id
                }) as any);

            if (txError) {
                console.warn('Failed to log transaction:', txError);
                // Don't throw - the coins were already awarded
            }

            setSuccessMessage(`+${amount} coins for ${reason}!`);

            // Clear success message after 2 seconds
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err) {
            console.error('Failed to award coins:', err);
            setError('Failed to award coins. Please try again.');
        } finally {
            setAwarding(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-gray-600">Loading...</p>
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 sm:p-8">
            {/* Header */}
            <div className="max-w-2xl mx-auto mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-4"
                >
                    <ArrowLeft size={20} />
                    Back
                </button>

                {/* Student Card */}
                <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">
                            {student?.username?.charAt(0).toUpperCase() || '?'}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">{student?.username}</h1>
                    {student?.class && (
                        <p className="text-gray-500 mt-1">Class: {student.class}</p>
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
            <div className="max-w-2xl mx-auto">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 text-center">
                    Tap to Award Coins
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {SKILLS.map(skill => (
                        <button
                            key={skill.id}
                            onClick={() => handleAward(skill.amount, skill.name)}
                            disabled={awarding}
                            className={`
                group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white shadow-md
                hover:shadow-xl hover:-translate-y-1 transition-all duration-200
                ${awarding ? 'opacity-50 cursor-not-allowed' : ''}
              `}
                        >
                            <div className={`w-16 h-16 rounded-2xl ${skill.bg} ${skill.color} flex items-center justify-center text-3xl shadow-sm group-hover:shadow-md transition-shadow`}>
                                <skill.icon size={32} />
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-gray-700">{skill.name}</div>
                                <div className="text-xs font-bold text-gray-400 bg-gray-100 inline-block px-2 py-0.5 rounded-full mt-1">
                                    +{skill.amount}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer hint */}
            <p className="text-center text-gray-400 text-sm mt-8">
                Tap a skill to instantly award coins to {student?.username}
            </p>
        </div>
    );
}

export default RewardPage;
