import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Users, Play, Square, ArrowLeft, Zap, Star, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Competition {
    id: string;
    title: string;
    status: 'waiting' | 'active' | 'finished';
    group_scores: Record<string, number>;
}

export function GroupCompetitionPage() {
    const { user, isAdmin } = useAuth();
    const [status, setStatus] = useState<'idle' | 'preparing' | 'battle' | 'victory'>('idle');
    const [activeSession, setActiveSession] = useState<Competition | null>(null);
    const [scores, setScores] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    const [isSyncing, setIsSyncing] = useState(false);
    const [winningGroup, setWinningGroup] = useState<number | null>(null);
    const [targetScore, setTargetScore] = useState(100);
    const [showSettings, setShowSettings] = useState(false);
    const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
    const deltasRef = useRef<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });

    const TARGET_SCORE = 100;

    // Initialize session and subscribe to real-time
    useEffect(() => {
        if (status !== 'battle' || !activeSession?.id) return;

        const channel = supabase
            .channel(`competition:${activeSession.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'group_competitions',
                    filter: `id=eq.${activeSession.id}`
                },
                (payload) => {
                    const newScores = payload.new.group_scores;
                    if (newScores) {
                        setScores(prev => {
                            const updated = { ...prev };
                            Object.entries(newScores).forEach(([k, v]) => {
                                updated[parseInt(k)] = v as number;
                            });
                            return updated;
                        });
                    }
                    if (payload.new.status === 'finished') {
                        setStatus('victory');
                        // Find winner from scores
                        const currentScores = payload.new.group_scores;
                        const winner = Object.entries(currentScores).sort((a: any, b: any) => b[1] - a[1])[0];
                        if (winner) {
                            setWinningGroup(parseInt(winner[0]));
                            confetti({
                                particleCount: 150,
                                spread: 70,
                                origin: { y: 0.6 }
                            });
                        }
                    }
                }
            )
            .subscribe();

        // Buffered sync every 500ms
        syncTimerRef.current = setInterval(async () => {
            const currentDeltas = { ...deltasRef.current };
            const hasChanges = Object.values(currentDeltas).some(v => v > 0);

            if (hasChanges && !isSyncing) {
                setIsSyncing(true);
                try {
                    const { data: latest } = await (supabase
                        .from('group_competitions' as any)
                        .select('group_scores')
                        .eq('id', activeSession.id)
                        .single() as any);

                    if (latest) {
                        const updatedScores = { ...latest.group_scores };
                        Object.entries(currentDeltas).forEach(([group, delta]) => {
                            updatedScores[group] = (updatedScores[group] || 0) + delta;
                        });

                        // Check for victory
                        const victor = Object.entries(updatedScores).find(([_, s]) => (s as number) >= TARGET_SCORE);
                        const newStatus = victor ? 'finished' : 'active';

                        await (supabase
                            .from('group_competitions' as any)
                            .update({ 
                                group_scores: updatedScores,
                                status: newStatus
                            })
                            .eq('id', activeSession.id) as any);

                        // Clear deltas that were successfully sent
                        Object.keys(currentDeltas).forEach(k => {
                            deltasRef.current[parseInt(k)] -= currentDeltas[parseInt(k)];
                        });

                        if (victor) {
                            setWinningGroup(parseInt(victor[0]));
                        }
                    }
                } catch (err) {
                    console.error('Sync error:', err);
                } finally {
                    setIsSyncing(false);
                }
            }
        }, 500);

        return () => {
            supabase.removeChannel(channel);
            if (syncTimerRef.current) clearInterval(syncTimerRef.current);
        };
    }, [status, activeSession?.id]);

    const handleStartBattle = async () => {
        if (!isAdmin) return;

        // Either find an existing active session or create a new one
        const { data: session, error } = await (supabase
            .from('group_competitions' as any)
            .insert([{
                host_id: user?.id,
                title: `Battle ${new Date().toLocaleTimeString()}`,
                status: 'active',
                group_scores: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 }
            }])
            .select()
            .single() as any);

        if (error) {
            console.error('Error creating session:', error);
            return;
        }

        setActiveSession(session);
        setScores({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
        setStatus('battle');
    };

    const playPopSound = () => {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440 + Math.random() * 200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    };

    const handleLaneInteraction = (groupNumber: number) => {
        if (status !== 'battle') return;

        // Visual feedback is handled by CSS/React state
        playPopSound();

        // Update local UI immediately for zero-latency feel
        setScores(prev => ({
            ...prev,
            [groupNumber]: prev[groupNumber] + 1
        }));

        // Store in buffer for sync
        deltasRef.current[groupNumber] += 1;
    };

    if (status === 'battle' || status === 'victory') {
        return (
            <div className="h-screen w-screen bg-slate-900 flex flex-col overflow-hidden select-none touch-none">
                {/* Top Zone: Visualization (50% height) */}
                <div className="h-1/2 relative flex items-center justify-center p-8 border-b border-slate-800">
                    <div className="absolute top-8 left-8 flex items-center gap-3">
                        <Trophy className="text-yellow-400" size={32} />
                        <h1 className="text-4xl font-black text-white tracking-widest uppercase">Group War</h1>
                    </div>

                    {/* Progress Track Mockup */}
                    <div className="w-full h-full flex items-end justify-around pb-12">
                        {[1, 2, 3, 4, 5, 6].map(num => (
                            <div key={num} className="flex flex-col items-center gap-4 transition-all duration-300" style={{ transform: `translateY(-${Math.min(scores[num], 80)}%)` }}>
                                <div className="relative">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl bg-gradient-to-b ${
                                        num === 1 ? 'from-red-400 to-red-600' :
                                        num === 2 ? 'from-orange-400 to-orange-600' :
                                        num === 3 ? 'from-yellow-400 to-yellow-600' :
                                        num === 4 ? 'from-emerald-400 to-emerald-600' :
                                        num === 5 ? 'from-blue-400 to-blue-600' :
                                        'from-purple-400 to-purple-600'
                                    }`}>
                                        <Zap className="text-white fill-white" size={32} />
                                    </div>
                                    <div className="absolute -top-4 -right-4 bg-white text-slate-900 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border-2 border-slate-900">
                                        {num}
                                    </div>
                                </div>
                                <div className="h-64 w-2 bg-slate-800 rounded-full relative overflow-hidden">
                                     <div className="absolute bottom-0 left-0 w-full bg-slate-700 transition-all duration-300" style={{ height: `${Math.min(scores[num], 100)}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Zone: Interaction (50% height, reachable for P.3) */}
                <div className="h-1/2 grid grid-cols-6 gap-3 p-4 bg-slate-950">
                    {[1, 2, 3, 4, 5, 6].map(num => (
                        <button
                            key={num}
                            onPointerDown={() => handleLaneInteraction(num)}
                            className={`group relative h-full rounded-t-[3rem] border-x-4 border-t-4 transition-all active:scale-95 overflow-hidden flex flex-col items-center justify-center ${
                                num === 1 ? 'border-red-500/30 bg-red-400/5' :
                                num === 2 ? 'border-orange-500/30 bg-orange-400/5' :
                                num === 3 ? 'border-yellow-500/30 bg-yellow-400/5' :
                                num === 4 ? 'border-emerald-500/30 bg-emerald-400/5' :
                                num === 5 ? 'border-blue-500/30 bg-blue-400/5' :
                                'border-purple-500/30 bg-purple-400/5'
                            }`}
                        >
                            {/* Tap Effect Overlay */}
                            <div className="absolute inset-0 bg-white/0 group-active:bg-white/10 transition-colors"></div>
                            
                            <div className="text-6xl font-black text-white/10 mb-8 select-none">{num}</div>
                            
                            <div className="bg-white/5 backdrop-blur-sm px-6 py-4 rounded-3xl border border-white/10">
                                <span className="text-3xl font-black text-white">{scores[num]}</span>
                            </div>
                            
                            <div className="absolute bottom-12 uppercase tracking-widest font-black text-white/30 text-xs">
                                Tap Zone
                            </div>
                        </button>
                    ))}
                </div>

                {/* System Controls (Admin Only overlay) */}
                {isAdmin && (
                    <div className="absolute top-6 right-8 flex gap-3">
                        <button 
                            onClick={() => setShowSettings(true)} 
                            className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-slate-700 shadow-xl"
                        >
                             <Users size={24} />
                        </button>
                        <button 
                            onClick={() => setStatus('idle')} 
                            className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl border border-red-700 shadow-xl"
                        >
                             <Square size={24} fill="currentColor" />
                        </button>
                    </div>
                )}

                {/* Admin Settings Modal */}
                {showSettings && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-8">
                        <div className="bg-white rounded-[2rem] w-full max-w-md p-8 overflow-hidden shadow-2xl">
                            <h3 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">Game Settings</h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Target Score</label>
                                    <input 
                                        type="number" 
                                        value={targetScore}
                                        onChange={(e) => setTargetScore(parseInt(e.target.value))}
                                        className="w-full text-4xl font-black p-4 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={async () => {
                                        if (activeSession) {
                                            await (supabase.from('group_competitions' as any).update({ 
                                                group_scores: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 } 
                                            }).eq('id', activeSession.id) as any);
                                            setScores({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
                                            deltasRef.current = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
                                        }
                                        setShowSettings(false);
                                    }}
                                    className="w-full py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                                >
                                    RESET SCORES
                                </button>
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                                >
                                    CLOSE
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Victory Overlay */}
                {status === 'victory' && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-500">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-yellow-400 blur-3xl opacity-20 animate-pulse"></div>
                            <Trophy size={120} className="text-yellow-400 relative z-10" />
                        </div>
                        <h2 className="text-6xl font-black text-white mb-4 tracking-tighter uppercase italic">Victory!</h2>
                        <div className={`text-9xl font-black mb-12 bg-gradient-to-b bg-clip-text text-transparent ${
                            winningGroup === 1 ? 'from-red-400 to-red-600' :
                            winningGroup === 2 ? 'from-orange-400 to-orange-600' :
                            winningGroup === 3 ? 'from-yellow-400 to-yellow-600' :
                            winningGroup === 4 ? 'from-emerald-400 to-emerald-600' :
                            winningGroup === 5 ? 'from-blue-400 to-blue-600' :
                            'from-purple-400 to-purple-600'
                        }`}>
                            GROUP {winningGroup}
                        </div>
                        <button 
                            onClick={() => setStatus('idle')}
                            className="px-12 py-6 bg-white text-slate-900 text-2xl font-black rounded-[2rem] hover:scale-105 transition-transform"
                        >
                            Return Home
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
            <div className="w-full max-w-xl bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-10 text-white text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur">
                        <Star size={40} className="fill-yellow-300 text-yellow-300" />
                    </div>
                    <h1 className="text-4xl font-black mb-2">Group Competition</h1>
                    <p className="text-indigo-100 font-medium">Coordinate, Compete, Succeed.</p>
                </div>

                <div className="p-10 space-y-8 text-center">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Groups</h3>
                             <p className="text-4xl font-black text-slate-800 tracking-tight">6</p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Multitouch</h3>
                             <p className="text-4xl font-black text-slate-800 tracking-tight">20+</p>
                        </div>
                    </div>

                    <button
                        onClick={handleStartBattle}
                        className="w-full py-6 bg-slate-900 hover:bg-slate-800 text-white text-2xl font-black rounded-[2rem] shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-4"
                    >
                        {isSyncing ? <Loader2 className="animate-spin" size={28} /> : <Play fill="currentColor" size={28} />}
                        Launch Battle Screen
                    </button>
                </div>
            </div>
            
            <button className="mt-8 flex items-center gap-2 font-bold text-slate-400 hover:text-slate-600 transition-colors">
                <ArrowLeft size={20} />
                Return to Dashboard
            </button>
        </div>
    );
}

export default GroupCompetitionPage;
