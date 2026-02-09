import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import {
    Camera,
    ArrowLeft,
    Check,
    Loader2,
    AlertCircle,
    ScanLine,
    RotateCcw,
    Star,
    Zap,
    AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { REWARD_ICON_MAP } from '@/constants/rewardConfig';
import { ClassReward } from '@/components/admin/CoinAwardModal';
import React from 'react';

const SCANNER_EMAIL = 'scanner@system.local';
const SUB_OPTIONS = ["中文", "英文", "數學", "常識", "其他"];
const SPECIAL_REWARD_TITLE = "完成班務（欠功課）";

interface ScannedStudent {
    id: string;
    username: string;
    display_name: string | null;
    class: string | null;
}

export function QRScannerPage() {
    const navigate = useNavigate();
    const { user, signIn } = useAuth();

    const [scannerState, setScannerState] = useState<'scanning' | 'found' | 'awarding' | 'error'>('scanning');
    const [scanTrigger, setScanTrigger] = useState(0); // Trigger to force re-runs

    const [student, setStudent] = useState<ScannedStudent | null>(null);
    const [rewards, setRewards] = useState<ClassReward[]>([]);
    const [consequences, setConsequences] = useState<ClassReward[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [awarding, setAwarding] = useState(false);

    // Sub-options selection
    const [pendingSubOptions, setPendingSubOptions] = useState<{ reward: ClassReward; selected: string[] } | null>(null);

    // Login State
    const [accessCode, setAccessCode] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerContainerId = 'qr-scanner-container';

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

    // Fetch Rewards
    useEffect(() => {
        const fetchRewards = async () => {
            const { data, error: rError } = await (supabase
                .from('class_rewards' as any)
                .select('*')
                .order('title', { ascending: true }) as any);

            if (rError) {
                console.error('Error fetching rewards:', rError);
                return;
            }

            const allItems: ClassReward[] = data || [];
            setRewards(allItems.filter(i => i.coins >= 0));
            setConsequences(allItems.filter(i => i.coins < 0));
        };
        if (user) fetchRewards();
    }, [user]);

    // Handle Scan Success Callback
    const handleScanSuccess = useCallback(async (decodedText: string) => {
        // Stop scanning immediately on success
        if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
            await scannerRef.current.stop();
        }

        const match = decodedText.match(/\/(?:quick-reward|reward)\/([a-f0-9-]{36})$/i);
        if (!match) {
            setError('Invalid QR code format.');
            setScannerState('error');
            return;
        }

        const qrToken = match[1];

        try {
            const { data: studentData, error: fetchError } = await (supabase
                .from('users' as any)
                .select('id, username, class')
                .eq('qr_token', qrToken)
                .single() as any);

            if (fetchError || !studentData) {
                setError('Student not found. QR code may be invalid.');
                setScannerState('error');
                return;
            }

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name')
                .eq('id', studentData.id)
                .single();

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

    // Manual start function
    const startCameraManually = useCallback(async () => {
        if (!user) return;

        // Brief delay for DOM to settle
        await new Promise(resolve => setTimeout(resolve, 200));

        const container = document.getElementById(scannerContainerId);
        if (!container) {
            console.warn('Scanner container not yet available');
            return;
        }

        try {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                    await scannerRef.current.stop();
                }
            }

            scannerRef.current = new Html5Qrcode(scannerContainerId);
            await scannerRef.current.start(
                {
                    facingMode: 'environment',
                    // Request high resolution for better detail with reflective codes
                    width: { min: 640, ideal: 1280, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 }
                },
                {
                    fps: 15, // Faster capture
                    qrbox: { width: 300, height: 300 }, // Slightly larger scan box
                    aspectRatio: 1.0,
                    // Use experimental native decoder if available (very fast/sensitive on modern OS)
                    //@ts-ignore - Experimental library feature
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true
                    }
                },
                handleScanSuccess,
                () => { }
            );
            console.log('Camera started manually');
        } catch (err) {
            console.error('Manual camera start failed:', err);
            setError('Failed to start camera. Please ensure camera permissions are granted.');
        }
    }, [user, handleScanSuccess]);

    // Scanner Lifecycle Management
    useEffect(() => {
        if (!user || scannerState !== 'scanning') return;

        let isMounted = true;
        const startScanner = async () => {
            // Initial delay
            await new Promise(resolve => setTimeout(resolve, 250));
            if (!isMounted) return;

            const container = document.getElementById(scannerContainerId);
            if (!container) {
                console.log('Container skipped');
                return;
            }

            try {
                if (scannerRef.current) {
                    const state = scannerRef.current.getState();
                    if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
                        await scannerRef.current.stop();
                    }
                }

                scannerRef.current = new Html5Qrcode(scannerContainerId);
                await scannerRef.current.start(
                    {
                        facingMode: 'environment',
                        width: { min: 640, ideal: 1280 },
                        height: { min: 480, ideal: 720 }
                    },
                    {
                        fps: 15,
                        qrbox: { width: 300, height: 300 },
                        aspectRatio: 1.0,
                        //@ts-ignore
                        experimentalFeatures: {
                            useBarCodeDetectorIfSupported: true
                        }
                    },
                    handleScanSuccess,
                    () => { }
                );
            } catch (err) {
                console.error('Auto start failed:', err);
            }
        };

        startScanner();

        return () => {
            isMounted = false;
            if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                scannerRef.current.stop().catch(console.error);
            }
        };
    }, [user, scannerState, scanTrigger, handleScanSuccess]);

    const handleScannerLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await performLogin(accessCode);
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
        if (item.title === SPECIAL_REWARD_TITLE) {
            setPendingSubOptions({ reward: item, selected: [] });
        } else {
            handleAward(item.coins, item.title);
        }
    };

    const handleAward = async (amount: number, reason: string) => {
        if (!student || awarding) return;

        setAwarding(true);

        try {
            const { error: rpcError } = await (supabase.rpc as any)('increment_room_coins', {
                target_user_id: student.id,
                amount: amount,
                log_reason: reason,
                log_admin_id: user?.id
            });

            if (rpcError) throw rpcError;

            setSuccessMessage(`${amount > 0 ? '+' : ''}${amount} coins for ${reason}!`);

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

    const resetScanner = () => {
        setStudent(null);
        setError(null);
        setSuccessMessage(null);
        setPendingSubOptions(null);
        setScannerState('scanning');
        setScanTrigger(prev => prev + 1); // Increment trigger to force re-run of effect
    };

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
                            {isAuthenticating ? <Loader2 className="animate-spin" /> : <ScanLine size={20} />}
                            Unlock Scanner
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white relative">
            {/* Sub-option Selection Overlay */}
            {pendingSubOptions && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-slate-800 rounded-3xl p-8 w-full max-w-md border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
                        <h3 className="text-xl font-bold mb-1 text-center">{pendingSubOptions.reward.title}</h3>
                        <p className="text-[10px] text-white/40 mb-8 text-center uppercase tracking-widest font-bold">Total 10 Coins</p>

                        <div className="grid grid-cols-2 gap-3 mb-8">
                            {SUB_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => handleSubOptionToggle(opt)}
                                    className={`px-4 py-4 rounded-2xl border-2 font-bold transition-all text-sm
                                        ${pendingSubOptions.selected.includes(opt)
                                            ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                                            : 'border-white/5 bg-white/5 text-white/40 hover:border-white/20'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setPendingSubOptions(null)}
                                className="flex-1 py-4 text-white/60 font-bold hover:bg-white/5 rounded-2xl transition-colors"
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

            <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </button>
                    <div className="flex items-center gap-2">
                        <Camera size={20} className="text-blue-400" />
                        <span className="font-bold">QR Scanner</span>
                    </div>
                    <div className="w-16" />
                </div>
            </header>

            <main className="pt-16 pb-8 px-4 flex flex-col items-center min-h-screen">
                {scannerState === 'scanning' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
                        <div className="relative w-full aspect-square rounded-3xl overflow-hidden border-4 border-blue-500/50 shadow-2xl shadow-blue-500/20">
                            <div id={scannerContainerId} className="w-full h-full" />
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <ScanLine className="w-64 h-64 text-blue-400/50 animate-pulse" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col items-center gap-4">
                            <div className="text-center">
                                <p className="text-white/60 text-sm">Point the camera at a student's QR code</p>
                                <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest font-bold">Avoid glare from reflective surfaces</p>
                            </div>

                            <button
                                onClick={() => {
                                    startCameraManually();
                                    setScanTrigger(prev => prev + 1);
                                }}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                            >
                                <Zap size={18} fill="currentColor" />
                                Enable Camera
                            </button>
                        </div>
                    </div>
                )}

                {(scannerState === 'found' || scannerState === 'awarding') && student && (
                    <div className="flex-1 flex flex-col items-center w-full max-w-lg animate-in fade-in slide-in-from-bottom duration-300">
                        <div className="w-full bg-white/10 backdrop-blur-lg rounded-3xl p-6 text-center mt-8 border border-white/20">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <span className="text-3xl font-bold text-white">
                                    {(student.display_name || student.username)?.charAt(0).toUpperCase() || '?'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold">{student.display_name || student.username}</h2>
                            {student.class && <p className="text-white/60 mt-1 uppercase tracking-widest text-[10px] font-bold">Class: {student.class}</p>}
                        </div>

                        {successMessage && (
                            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
                                <div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
                                    <Check size={20} />
                                    <span className="font-semibold">{successMessage}</span>
                                </div>
                            </div>
                        )}

                        <div className="w-full mt-6 space-y-10">
                            {/* Rewards Section */}
                            <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest text-center mb-4 font-bold flex items-center justify-center gap-2">
                                    <Star size={14} className="text-yellow-500" />
                                    Rewards
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {rewards.map((reward) => (
                                        <button
                                            key={reward.id}
                                            onClick={() => handleRewardClick(reward)}
                                            disabled={awarding}
                                            className={`
                                                flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10
                                                hover:bg-white/20 hover:border-white/30 active:scale-95 transition-all duration-200
                                                ${awarding ? 'opacity-50 cursor-not-allowed' : ''}
                                            `}
                                        >
                                            <div className={`w-12 h-12 rounded-xl ${reward.color} flex items-center justify-center`}>
                                                {React.createElement(REWARD_ICON_MAP[reward.icon] || Star, { size: 24 })}
                                            </div>
                                            <span className="font-semibold text-sm truncate w-full px-1 text-center">{reward.title}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-500/20 text-green-400">
                                                +{reward.coins}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Consequences Section */}
                            {consequences.length > 0 && (
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase tracking-widest text-center mb-4 font-bold flex items-center justify-center gap-2">
                                        <AlertTriangle size={14} className="text-red-500" />
                                        Consequences
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {consequences.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => handleRewardClick(item)}
                                                disabled={awarding}
                                                className={`
                                                    flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10
                                                    hover:bg-white/20 hover:border-white/30 active:scale-95 transition-all duration-200
                                                    ${awarding ? 'opacity-50 cursor-not-allowed' : ''}
                                                `}
                                            >
                                                <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center`}>
                                                    {React.createElement(REWARD_ICON_MAP[item.icon] || AlertTriangle, { size: 24 })}
                                                </div>
                                                <span className="font-semibold text-sm truncate w-full px-1 text-center">{item.title}</span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400">
                                                    {item.coins}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={resetScanner}
                            disabled={awarding}
                            className="mt-12 flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full font-semibold transition-colors border border-white/10"
                        >
                            <RotateCcw size={18} />
                            Scan Another Student
                        </button>
                    </div>
                )}

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
