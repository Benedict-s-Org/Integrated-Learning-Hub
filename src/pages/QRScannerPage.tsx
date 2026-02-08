import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import {
    Camera,
    ArrowLeft,
    Heart,
    Star,
    Zap,
    Trophy,
    BookOpen,
    Users,
    Check,
    Loader2,
    AlertCircle,
    ScanLine,
    RotateCcw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

const SCANNER_EMAIL = 'scanner@system.local';

// Skill buttons for awarding coins (same as RewardPage)
const SKILLS = [
    { id: 'helping', name: 'Helping Others', amount: 1, icon: Heart, color: 'text-pink-500', bg: 'bg-pink-100' },
    { id: 'ontask', name: 'On Task', amount: 1, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-100' },
    { id: 'participating', name: 'Participating', amount: 1, icon: Zap, color: 'text-purple-500', bg: 'bg-purple-100' },
    { id: 'teamwork', name: 'Teamwork', amount: 2, icon: Users, color: 'text-blue-500', bg: 'bg-blue-100' },
    { id: 'persistence', name: 'Working Hard', amount: 2, icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-100' },
    { id: 'homework', name: 'Homework', amount: 5, icon: BookOpen, color: 'text-green-500', bg: 'bg-green-100' },
];

interface ScannedStudent {
    id: string;
    username: string;
    display_name: string | null;
    class: string | null;
}

export function QRScannerPage() {
    const navigate = useNavigate();
    const { user, signIn } = useAuth(); // Removed unused isAdmin

    const [scannerState, setScannerState] = useState<'scanning' | 'found' | 'awarding' | 'error'>('scanning');
    const [student, setStudent] = useState<ScannedStudent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [awarding, setAwarding] = useState(false);

    // Login State
    const [accessCode, setAccessCode] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerContainerId = 'qr-scanner-container';

    // Initialize scanner
    const [searchParams] = useSearchParams();

    // Reusable login function
    const performLogin = useCallback(async (code: string) => {
        setIsAuthenticating(true);
        setAuthError(null);

        try {
            const { error } = await signIn(SCANNER_EMAIL, code);

            if (error) {
                console.error('Login failed:', error);
                setAuthError('Invalid Access Code');
            } else {
                // Login success
            }
        } catch (err) {
            console.error('Login error:', err);
            setAuthError('Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    }, [signIn]);

    // Check for magic link login
    useEffect(() => {
        const code = searchParams.get('code');
        if (code && !user && !isAuthenticating) {
            setAccessCode(code);
            performLogin(code);
        }
    }, [searchParams, user, performLogin, isAuthenticating]);

    useEffect(() => {
        if (!user) return; // Only start if logged in

        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        const startScanner = async () => {
            try {
                await html5QrCode.start(
                    { facingMode: 'environment' }, // Use rear camera
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                    },
                    handleScanSuccess,
                    () => { } // Ignore scan errors (no QR found yet)
                );
            } catch (err) {
                console.error('Failed to start scanner:', err);
                setError('Could not access camera. Please grant camera permission.');
                setScannerState('error');
            }
        };

        startScanner();

        return () => {
            if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                scannerRef.current.stop().catch(console.error);
            }
        };
    }, [user]); // Changed dependency from isAdmin to user

    // Handle Scanner Login
    const handleScannerLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await performLogin(accessCode);
    };

    // Handle successful QR scan
    const handleScanSuccess = useCallback(async (decodedText: string) => {
        // Stop scanner immediately to prevent duplicate scans
        if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
            await scannerRef.current.stop();
        }

        // Extract qrToken from URL (format: .../quick-reward/UUID or .../reward/UUID)
        // Supports both legacy and new formats
        const match = decodedText.match(/\/(?:quick-reward|reward)\/([a-f0-9-]{36})$/i);
        if (!match) {
            console.warn('Scanned text did not match expected format:', decodedText);
            setError('Invalid QR code format.');
            setScannerState('error');
            return;
        }

        const qrToken = match[1];

        // Fetch student by QR token
        try {
            const { data: studentData, error: fetchError } = await (supabase
                .from('users')
                .select('id, username, class')
                .eq('qr_token', qrToken)
                .single() as any);

            if (fetchError || !studentData) {
                setError('Student not found. QR code may be invalid.');
                setScannerState('error');
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
            setScannerState('found');
        } catch (err) {
            console.error('Error fetching student:', err);
            setError('Failed to identify student.');
            setScannerState('error');
        }
    }, []);

    // Award coins to student
    const handleAward = async (amount: number, reason: string) => {
        if (!student || awarding) return;

        setAwarding(true);
        setScannerState('awarding');

        try {
            // Award coins using RPC
            const { error: rpcError } = await (supabase.rpc as any)('increment_room_coins', {
                target_user_id: student.id,
                amount: amount,
            });

            if (rpcError) throw rpcError;

            // Log the transaction
            await (supabase.from('coin_transactions' as any).insert({
                user_id: student.id,
                amount: amount,
                reason: reason,
                created_by: user?.id,
            }) as any);

            setSuccessMessage(`+${amount} coins for ${reason}!`);

            // Auto-reset after 1.5 seconds
            setTimeout(() => {
                resetScanner();
            }, 1500);
        } catch (err) {
            console.error('Failed to award coins:', err);
            setError('Failed to award coins. Please try again.');
            setScannerState('error');
        } finally {
            setAwarding(false);
        }
    };

    // Reset scanner for next student
    const resetScanner = async () => {
        setStudent(null);
        setError(null);
        setSuccessMessage(null);
        setScannerState('scanning');

        // Restart scanner
        if (scannerRef.current) {
            try {
                await scannerRef.current.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    handleScanSuccess,
                    () => { }
                );
            } catch (err) {
                console.error('Failed to restart scanner:', err);
            }
        }
    };

    // Not Authenticated -> Show Login
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Camera size={32} />
                        </div>
                        <h1 className="text-xl font-bold text-gray-800">Scanner Access</h1>
                        <p className="text-sm text-gray-500 mt-2">Enter code to unlock camera.</p>
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
                            {isAuthenticating ? <Loader2 className="animate-spin" /> : <ScanLine size={20} />}
                            Unlock Scanner
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={() => navigate('/')} // Changed from -1 to home, more safe
                        className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </button>
                    <div className="flex items-center gap-2">
                        <Camera size={20} className="text-blue-400" />
                        <span className="font-bold">QR Scanner</span>
                    </div>
                    <div className="w-16" /> {/* Spacer for centering */}
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-16 pb-8 px-4 flex flex-col items-center min-h-screen">
                {/* Scanner View */}
                {scannerState === 'scanning' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
                        <div className="relative w-full aspect-square rounded-3xl overflow-hidden border-4 border-blue-500/50 shadow-2xl shadow-blue-500/20">
                            <div id={scannerContainerId} className="w-full h-full" />
                            {/* Scan overlay */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <ScanLine className="w-64 h-64 text-blue-400/50 animate-pulse" />
                                </div>
                            </div>
                        </div>
                        <p className="mt-6 text-white/60 text-center">Point the camera at a student's QR code</p>
                    </div>
                )}

                {/* Student Found - Reward Selection */}
                {(scannerState === 'found' || scannerState === 'awarding') && student && (
                    <div className="flex-1 flex flex-col items-center w-full max-w-lg animate-in fade-in slide-in-from-bottom duration-300">
                        {/* Student Card */}
                        <div className="w-full bg-white/10 backdrop-blur-lg rounded-3xl p-6 text-center mt-8 border border-white/20">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <span className="text-3xl font-bold text-white">
                                    {(student.display_name || student.username)?.charAt(0).toUpperCase() || '?'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold">{student.display_name || student.username}</h2>
                            {student.class && <p className="text-white/60 mt-1">Class: {student.class}</p>}
                        </div>

                        {/* Success Toast */}
                        {successMessage && (
                            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
                                <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
                                    <Check size={20} />
                                    <span className="font-semibold">{successMessage}</span>
                                </div>
                            </div>
                        )}

                        {/* Skills Grid */}
                        <div className="w-full mt-6">
                            <p className="text-sm text-white/40 uppercase tracking-wider text-center mb-4">
                                Tap to Award Coins
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {SKILLS.map((skill) => (
                                    <button
                                        key={skill.id}
                                        onClick={() => handleAward(skill.amount, skill.name)}
                                        disabled={awarding}
                                        className={`
                      flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10
                      hover:bg-white/20 hover:border-white/30 transition-all duration-200
                      ${awarding ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                                    >
                                        <div className={`w-12 h-12 rounded-xl ${skill.bg} ${skill.color} flex items-center justify-center`}>
                                            <skill.icon size={24} />
                                        </div>
                                        <span className="font-semibold text-sm">{skill.name}</span>
                                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">+{skill.amount}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Scan Again Button */}
                        <button
                            onClick={resetScanner}
                            disabled={awarding}
                            className="mt-8 flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-semibold transition-colors"
                        >
                            <RotateCcw size={18} />
                            Scan Another Student
                        </button>
                    </div>
                )}

                {/* Error State */}
                {scannerState === 'error' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
                        <div className="bg-red-500/20 backdrop-blur-lg rounded-3xl p-8 text-center border border-red-500/30">
                            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                            <h2 className="text-xl font-bold mb-2">Error</h2>
                            <p className="text-white/70 mb-6">{error}</p>
                            <button
                                onClick={resetScanner}
                                className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default QRScannerPage;
