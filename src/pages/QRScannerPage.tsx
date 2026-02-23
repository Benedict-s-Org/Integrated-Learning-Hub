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
    AlertTriangle,
    Minus,
    Plus,
    Search
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { REWARD_ICON_MAP, DEFAULT_SUB_OPTIONS } from '@/constants/rewardConfig';
import { ClassReward } from '@/components/admin/CoinAwardModal';
import { RewardSubOptionOverlay } from '@/components/admin/RewardSubOptionOverlay';
import React from 'react';

const SCANNER_EMAIL = 'scanner@system.local';

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
    const [scanTrigger, setScanTrigger] = useState(0);

    const [student, setStudent] = useState<ScannedStudent | null>(null);
    const [rewards, setRewards] = useState<ClassReward[]>([]);
    const [consequences, setConsequences] = useState<ClassReward[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [awarding, setAwarding] = useState(false);

    // Sub-options selection
    const [pendingSubOptions, setPendingSubOptions] = useState<{ reward: ClassReward; selected: string[] } | null>(null);

    const getEffectiveSubOptions = (reward: ClassReward) => {
        if (reward.sub_options && Object.keys(reward.sub_options).length > 0) {
            return reward.sub_options;
        }
        return DEFAULT_SUB_OPTIONS;
    };

    // Login State
    const [accessCode, setAccessCode] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    // Advanced Camera Features
    const [detectedTargets, setDetectedTargets] = useState<{ text: string, box: any }[]>([]);
    const [cameraCapabilities, setCameraCapabilities] = useState<any>(null);
    const [zoomValue, setZoomValue] = useState(1);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const detectionLoopRef = useRef<number | null>(null);
    const scannerContainerId = 'qr-scanner-container';

    const [searchParams] = useSearchParams();

    // Reusable login function
    const performLogin = useCallback(async (code: string) => {
        setIsAuthenticating(true);
        setAuthError(null);
        try {
            const { error } = await signIn(SCANNER_EMAIL, code);
            if (error) setAuthError('Invalid Access Code');
        } catch (err) {
            setAuthError('Authentication failed');
        } finally {
            setIsAuthenticating(false);
        }
    }, [signIn]);

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

            if (rError) return;

            const allItems: ClassReward[] = data || [];
            setRewards(allItems.filter(i => i.coins >= 0));
            setConsequences(allItems.filter(i => i.coins <= 0));
        };
        if (user) fetchRewards();
    }, [user]);

    // Handle Scan Success Callback
    const handleScanSuccess = useCallback(async (decodedText: string) => {
        if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
            await scannerRef.current.stop();
        }

        const match = decodedText.match(/\/(?:quick-reward|reward)\/([a-f0-9-]{36})(?:\/|\?|$)/i);
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
            setError('Failed to identify student.');
            setScannerState('error');
        }
    }, []);

    const startDetectionLoop = useCallback(() => {
        if (!('BarcodeDetector' in window)) return;
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const loop = async () => {
            if (!videoRef.current || scannerState !== 'scanning') return;
            try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                    setDetectedTargets(barcodes.map((b: any) => ({
                        text: b.rawValue,
                        box: b.boundingBox
                    })));
                } else {
                    setDetectedTargets([]);
                }
            } catch (err) { }
            detectionLoopRef.current = requestAnimationFrame(loop);
        };
        detectionLoopRef.current = requestAnimationFrame(loop);
    }, [scannerState]);

    const handleZoomChange = async (value: number) => {
        if (!scannerRef.current) return;
        try {
            const track = (scannerRef.current as any).getRunningTrack();
            if (track && track.getCapabilities().zoom) {
                await track.applyConstraints({ advanced: [{ zoom: value }] });
                setZoomValue(value);
            }
        } catch (err) { }
    };

    const handleViewfinderTap = async (e: React.MouseEvent<HTMLDivElement>) => {
        if (!scannerRef.current) return;
        const track = (scannerRef.current as any).getRunningTrack();
        if (!track) return;
        const capabilities = track.getCapabilities();
        if (capabilities.focusMode && capabilities.focusMode.includes('manual')) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            try {
                await track.applyConstraints({
                    advanced: [{ pointsOfInterest: [{ x, y }], focusMode: 'manual' }] as any
                });
            } catch (err) { }
        }
    };

    const startCameraManually = useCallback(async () => {
        if (!user) return;
        await new Promise(resolve => setTimeout(resolve, 200));
        const container = document.getElementById(scannerContainerId);
        if (!container) return;

        try {
            if (scannerRef.current) {
                if (scannerRef.current.getState() !== Html5QrcodeScannerState.NOT_STARTED) {
                    await scannerRef.current.stop();
                }
            }

            scannerRef.current = new Html5Qrcode(scannerContainerId);
            await scannerRef.current.start(
                { facingMode: 'environment', width: { min: 640, ideal: 1280 }, height: { min: 480, ideal: 720 } },
                {
                    fps: 15, qrbox: { width: 450, height: 450 }, aspectRatio: 1.0,
                    //@ts-ignore 
                    experimentalFeatures: { useBarCodeDetectorIfSupported: true }
                },
                handleScanSuccess,
                () => { }
            );

            const track = (scannerRef.current as any).getRunningTrack();
            if (track) {
                const caps = track.getCapabilities();
                setCameraCapabilities(caps);
                if (caps.zoom) setZoomValue(caps.zoom.min);
            }

            const video = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement;
            if (video) {
                videoRef.current = video;
                startDetectionLoop();
            }
        } catch (err) {
            setError('Failed to start camera.');
        }
    }, [user, handleScanSuccess, startDetectionLoop]);

    useEffect(() => {
        if (!user || scannerState !== 'scanning') return;
        let isMounted = true;
        const startScanner = async () => {
            await new Promise(resolve => setTimeout(resolve, 300));
            if (!isMounted) return;
            const container = document.getElementById(scannerContainerId);
            if (!container) return;
            try {
                if (scannerRef.current) {
                    if (scannerRef.current.getState() !== Html5QrcodeScannerState.NOT_STARTED) {
                        await scannerRef.current.stop();
                    }
                }
                scannerRef.current = new Html5Qrcode(scannerContainerId);
                await scannerRef.current.start(
                    { facingMode: 'environment', width: { min: 640, ideal: 1280 }, height: { min: 480, ideal: 720 } },
                    {
                        fps: 15, qrbox: { width: 450, height: 450 }, aspectRatio: 1.0,
                        //@ts-ignore
                        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
                    },
                    handleScanSuccess,
                    () => { }
                );
                const track = (scannerRef.current as any).getRunningTrack();
                if (track) {
                    const caps = track.getCapabilities();
                    setCameraCapabilities(caps);
                    if (caps.zoom) setZoomValue(caps.zoom.min);
                }
                const video = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement;
                if (video) {
                    videoRef.current = video;
                    startDetectionLoop();
                }
            } catch (err) { }
        };
        startScanner();
        return () => {
            isMounted = false;
            if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
            if (scannerRef.current?.getState() === Html5QrcodeScannerState.SCANNING) {
                scannerRef.current.stop().catch(() => { });
            }
        };
    }, [user, scannerState, scanTrigger, handleScanSuccess, startDetectionLoop]);


    const handleRewardClick = (item: ClassReward) => {
        if (awarding) return;

        const effectiveSubs = getEffectiveSubOptions(item);
        const hasSubs = Object.keys(effectiveSubs).length > 0;

        if (hasSubs) {
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
            setTimeout(() => resetScanner(), 1500);
        } catch (err) {
            console.error('RPC Error:', err);
            setError('Failed to award coins.');
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
        setDetectedTargets([]);
        setScannerState('scanning');
        setScanTrigger(prev => prev + 1);
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
                    <form onSubmit={(e) => { e.preventDefault(); performLogin(accessCode); }} className="space-y-4">
                        <input
                            type="password"
                            value={accessCode}
                            onChange={(e) => setAccessCode(e.target.value)}
                            placeholder="Access Code"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center text-lg tracking-widest"
                            autoFocus
                        />
                        {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 justify-center"><AlertCircle size={16} />{authError}</div>}
                        <button type="submit" disabled={isAuthenticating || !accessCode} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {isAuthenticating ? <Loader2 className="animate-spin" /> : <ScanLine size={20} />}Unlock Scanner
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white relative">
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
                    isDark={true}
                />
            )}

            <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10">
                <div className="flex items-center justify-between px-4 py-3">
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"><ArrowLeft size={20} />Back</button>
                    <div className="flex items-center gap-2"><Camera size={20} className="text-blue-400" /><span className="font-bold">QR Scanner</span></div>
                    <div className="w-16" />
                </div>
            </header>

            <main className="pt-16 pb-8 px-4 flex flex-col items-center min-h-screen">
                {scannerState === 'scanning' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
                        <div className="relative w-full aspect-square rounded-[3rem] overflow-hidden border-[6px] border-blue-500/30 shadow-2xl shadow-blue-500/10 cursor-crosshair" onClick={handleViewfinderTap}>
                            <div id={scannerContainerId} className="w-full h-full" />
                            <div className="absolute inset-0 pointer-events-none z-10">
                                {detectedTargets.length > 1 && detectedTargets.map((target, idx) => (
                                    <div key={idx} className="absolute pointer-events-auto border-4 border-blue-500 rounded-2xl bg-blue-500/10 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                        style={{
                                            left: `${(target.box.x / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                            top: `${(target.box.y / (videoRef.current?.videoHeight || 1)) * 100}%`,
                                            width: `${(target.box.width / (videoRef.current?.videoWidth || 1)) * 100}%`,
                                            height: `${(target.box.height / (videoRef.current?.videoHeight || 1)) * 100}%`,
                                        }} onClick={(e) => { e.stopPropagation(); handleScanSuccess(target.text); }}>
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap shadow-xl">Tap to select</div>
                                    </div>
                                ))}
                                {detectedTargets.length === 0 && <div className="absolute inset-0 flex items-center justify-center"><ScanLine className="w-64 h-64 text-blue-400/20 animate-pulse" /></div>}
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col items-center gap-6 w-full">
                            {cameraCapabilities?.zoom && (
                                <div className="w-full px-6 flex flex-col gap-3">
                                    <div className="flex items-center justify-between text-[10px] font-black text-white/40 uppercase tracking-widest"><div className="flex items-center gap-2"><Search size={12} />Zoom</div><span>{zoomValue.toFixed(1)}x</span></div>
                                    <div className="flex items-center gap-4">
                                        <Minus size={14} className="text-white/40" />
                                        <input type="range" min={cameraCapabilities.zoom.min} max={cameraCapabilities.zoom.max} step={0.1} value={zoomValue} onChange={(e) => handleZoomChange(parseFloat(e.target.value))} className="flex-1 accent-blue-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer" />
                                        <Plus size={14} className="text-white/40" />
                                    </div>
                                </div>
                            )}
                            <div className="text-center">
                                <p className="text-white/60 text-sm font-medium">Point at a student's QR code</p>
                                <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest font-black">{detectedTargets.length > 1 ? "Multiple codes found! Tap one above." : "Avoid glare & tap to focus if needed"}</p>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => { startCameraManually(); setScanTrigger(prev => prev + 1); }} className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-500/30 transition-all active:scale-95 uppercase text-[10px] tracking-widest"><Zap size={14} fill="currentColor" />Enable Camera</button>
                                <button onClick={() => handleZoomChange(1)} className="flex items-center justify-center w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all active:scale-95" title="Reset Zoom"><RotateCcw size={18} /></button>
                            </div>
                        </div>
                    </div>
                )}

                {(scannerState === 'found' || scannerState === 'awarding') && student && (
                    <div className="flex-1 flex flex-col items-center w-full max-w-lg animate-in fade-in slide-in-from-bottom duration-300">
                        <div className="w-full bg-white/10 backdrop-blur-lg rounded-3xl p-6 text-center mt-8 border border-white/20">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                                <span className="text-3xl font-bold text-white">{(student.display_name || student.username)?.charAt(0).toUpperCase() || '?'}</span>
                            </div>
                            <h2 className="text-2xl font-bold">{student.display_name || student.username}</h2>
                            {student.class && <p className="text-white/60 mt-1 uppercase tracking-widest text-[10px] font-bold">Class: {student.class}</p>}
                        </div>
                        {successMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300"><div className="bg-green-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2"><Check size={20} /> <span className="font-semibold">{successMessage}</span></div></div>}
                        <div className="w-full mt-6 space-y-10">
                            <div>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest text-center mb-4 font-bold flex items-center justify-center gap-2"><Star size={14} className="text-yellow-500" />Rewards</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {rewards.map((reward) => (
                                        <button key={reward.id} onClick={() => handleRewardClick(reward)} disabled={awarding} className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 hover:border-white/30 active:scale-95 transition-all duration-200 ${awarding ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <div className={`w-12 h-12 rounded-xl ${reward.color} flex items-center justify-center`}>{React.createElement(REWARD_ICON_MAP[reward.icon] || Star, { size: 24 })}</div>
                                            <span className="font-semibold text-sm truncate w-full px-1 text-center">{reward.title}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-500/20 text-green-400">
                                                {reward.coins > 0 ? `+${reward.coins}` : reward.coins}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {consequences.length > 0 && (
                                <div>
                                    <p className="text-[10px] text-white/40 uppercase tracking-widest text-center mb-4 font-bold flex items-center justify-center gap-2"><AlertTriangle size={14} className="text-red-500" />Consequences</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {consequences.map((item) => (
                                            <button key={item.id} onClick={() => handleRewardClick(item)} disabled={awarding} className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 hover:border-white/30 active:scale-95 transition-all duration-200 ${awarding ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center`}>{React.createElement(REWARD_ICON_MAP[item.icon] || AlertTriangle, { size: 24 })}</div>
                                                <span className="font-semibold text-sm truncate w-full px-1 text-center">{item.title}</span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400">
                                                    {item.coins === 0 ? '-0' : item.coins}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={resetScanner} disabled={awarding} className="mt-12 flex items-center gap-2 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-full font-semibold transition-colors border border-white/10"><RotateCcw size={18} />Scan Another Student</button>
                    </div>
                )}
                {scannerState === 'error' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
                        <div className="bg-red-500/20 backdrop-blur-lg rounded-3xl p-8 text-center border border-red-500/30">
                            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" /><h2 className="text-xl font-bold mb-2">Error</h2><p className="text-white/70 mb-6">{error}</p>
                            <div className="flex flex-col gap-3">
                                <button onClick={resetScanner} className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"><RotateCcw size={18} />Try Again</button>
                                <button onClick={() => { startCameraManually(); setScanTrigger(prev => prev + 1); }} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition-all active:scale-95 uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"><Zap size={14} fill="currentColor" />Enable Camera</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default QRScannerPage;
