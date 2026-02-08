import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Heart, Star, Zap, Trophy, BookOpen, Users, Check, Loader2, AlertCircle, KeyRound, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

// Skill buttons for awarding coins
const SKILLS = [
    { id: 'helping', name: 'Helping Others', amount: 1, icon: Heart, color: 'text-pink-500', bg: 'bg-pink-100' },
    { id: 'ontask', name: 'On Task', amount: 1, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-100' },
    { id: 'participating', name: 'Participating', amount: 1, icon: Zap, color: 'text-purple-500', bg: 'bg-purple-100' },
    { id: 'teamwork', name: 'Teamwork', amount: 2, icon: Users, color: 'text-blue-500', bg: 'bg-blue-100' },
    { id: 'persistence', name: 'Working Hard', amount: 2, icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-100' },
    { id: 'homework', name: 'Homework', amount: 5, icon: BookOpen, color: 'text-green-500', bg: 'bg-green-100' },
];

const SCANNER_EMAIL = 'scanner@system.local';

interface StudentInfo {
    id: string;
    username: string;
    display_name: string | null;
    class: string | null;
}

export function QuickRewardPage() {
    const { qrToken } = useParams<{ qrToken: string }>();
    const { user } = useAuth(); // We'll use signIn from context if available, or direct supabase

    const [accessCode, setAccessCode] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const [student, setStudent] = useState<StudentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [awarding, setAwarding] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Initialize: Check Auth & Fetch Student
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError(null);

            // 1. Check Authentication
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setLoading(false);
                return; // Show Login Screen
            }

            // 2. Fetch Student (if authenticated)
            if (!qrToken) {
                setError('Invalid QR code.');
                setLoading(false);
                return;
            }

            try {
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

                // Fetch display name from profiles
                const { data: profile } = await (supabase
                    .from('user_profiles')
                    .select('display_name')
                    .eq('id', studentData.id)
                    .single() as any);

                setStudent({
                    ...studentData,
                    display_name: profile?.display_name || null,
                });
            } catch (err) {
                console.error('Error fetching student:', err);
                setError('Failed to load student data.');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [qrToken, user]); // Re-run when user changes (i.e. after login)

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
            } else {
                // Login success, useEffect will trigger and load student
            }
        } catch (err) {
            setAuthError('Authentication failed');
        } finally {
            setIsAuthenticating(false);
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
                // Session expired?
                window.location.reload();
                return;
            }

            // 1. Update student's coins using RPC
            const { error: rpcError } = await (supabase.rpc as any)('increment_room_coins', {
                target_user_id: student.id,
                amount: amount
            });

            if (rpcError) throw rpcError;

            // 2. Log the transaction
            await (supabase
                .from('coin_transactions' as any)
                .insert({
                    user_id: student.id,
                    amount: amount,
                    reason: reason,
                    created_by: user.id
                }) as any);

            setSuccessMessage(`+${amount} coins for ${reason}!`);
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err) {
            console.error('Failed to award coins:', err);
            setError('Failed to award coins. Please try again.');
        } finally {
            setAwarding(false);
        }
    };

    // --- RENDER STATES ---

    // 1. Loading
    if (loading && user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    // 2. Not Authenticated (Scanner Login)
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
                        <div>
                            <input
                                type="password"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                placeholder="Access Code"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center text-lg tracking-widest"
                                autoFocus
                            />
                        </div>

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

    // 3. Authenticated but Error (Invalid User/Token)
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

    // 4. Main Interface (Student Found)
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4">

            {/* Student Card */}
            <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 text-center mt-4 border border-gray-100">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-md">
                    <span className="text-4xl font-bold text-white">
                        {(student?.display_name || student?.username)?.charAt(0).toUpperCase()}
                    </span>
                </div>
                <h1 className="text-2xl font-black text-gray-800 mb-1">{student?.display_name || student?.username}</h1>
                <p className="text-gray-500 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full text-sm">
                    {student?.class || 'No Class'}
                </p>
                {/* Visual feedback for 'You are logged in as Scanner' */}
                <p className="text-[10px] text-gray-300 mt-4 uppercase tracking-widest">Scanner Active</p>
            </div>

            {/* Success Toast */}
            {successMessage && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
                    <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold">
                        <Check size={24} strokeWidth={3} />
                        <span>{successMessage}</span>
                    </div>
                </div>
            )}

            {/* Actions Grid */}
            <div className="w-full max-w-md mt-6 grid grid-cols-2 gap-4">
                {SKILLS.map(skill => (
                    <button
                        key={skill.id}
                        onClick={() => handleAward(skill.amount, skill.name)}
                        disabled={awarding}
                        className={`
                            relative flex flex-col items-center gap-2 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm
                            active:scale-95 transition-all duration-100 touch-manipulation
                            ${awarding ? 'opacity-50' : 'hover:shadow-md hover:border-blue-200'}
                        `}
                    >
                        <div className={`w-14 h-14 rounded-2xl ${skill.bg} ${skill.color} flex items-center justify-center mb-1`}>
                            <skill.icon size={28} strokeWidth={2.5} />
                        </div>
                        <span className="font-bold text-gray-700 text-sm leading-tight">{skill.name}</span>
                        <div className="absolute top-3 right-3 bg-gray-900/5 text-gray-600 text-xs font-black px-2 py-1 rounded-md">
                            +{skill.amount}
                        </div>
                    </button>
                ))}
            </div>

            <p className="mt-8 text-xs text-center text-gray-400 max-w-xs">
                Tap button to instantly award coins.
                <br />
                User: {user?.email}
            </p>
        </div>
    );
}

export default QuickRewardPage;
