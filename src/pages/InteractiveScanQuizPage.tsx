import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Play, Square, Settings, Users, X, Plus, ChevronRight, Video, FileText, CheckCircle2, SlidersHorizontal, Trash2, Camera } from 'lucide-react';

// Import AR from js-aruco2
import { AR } from 'js-aruco2';
import { ARUCO_DICT_4X4_1000 } from '@/lib/aruco-dictionary';
import MarkerGenerator from '../components/admin/MarkerGenerator';
import { ImportSourceSelector } from '../components/SpacedRepetition/ImportSourceSelector';
import { FileImporter } from '../components/SpacedRepetition/FileImporter';
import { NotionImporter } from '../components/SpacedRepetition/NotionImporter';
import { ImportedQuestion } from '../utils/importParsers';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';

// Inject custom dictionary
if (AR && AR.DICTIONARIES && !AR.DICTIONARIES.DICT_4X4_1000) {
    AR.DICTIONARIES.DICT_4X4_1000 = {
        nBits: 16,
        tau: 0.1,
        codeList: ARUCO_DICT_4X4_1000
    };
}

interface QuizSession {
    id: string;
    host_id: string;
    title: string;
    class_id: string | null;
    status: 'idle' | 'polling' | 'revealed';
    current_question_id: string | null;
    created_at: string;
}

interface QuizQuestion {
    id: string;
    question_text: string;
    options: Record<string, string>;
    correct_answer: string;
}

type ViewMode = 'dashboard' | 'go-live-prep' | 'active-session' | 'create-session' | 'marker-generator';

export function InteractiveScanQuizPage() {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { isSuperAdmin } = useSuperAdmin();

    const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
    const [sessions, setSessions] = useState<QuizSession[]>([]);
    const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [classes, setClasses] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [responses, setResponses] = useState<Record<string, string>>({}); // student_id -> answer
    const [showSettings, setShowSettings] = useState(false);
    const [rewardTiers, setRewardTiers] = useState({ first: 30, second: 20, third: 10, participation: 5 });
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [timerSeconds, setTimerSeconds] = useState(30);
    const [sessionTitle, setSessionTitle] = useState('');
    const [draftQuestions, setDraftQuestions] = useState([{ id: 1, text: '', a: '', b: '', c: '', d: '', correct: 'A' }]);
    const [isSubmittingSession, setIsSubmittingSession] = useState(false);
    const [createSessionMode, setCreateSessionMode] = useState<'selector' | 'manual' | 'file' | 'notion'>('selector');

    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
            return;
        }

        fetchSessions();
        fetchClasses();

        // Initialize detector
        if (AR && AR.Detector) {
            detectorRef.current = new AR.Detector({ dictionaryName: 'DICT_4X4_1000' });
        }

        return () => {
            stopScan();
        };
    }, [isAdmin]);

    const fetchSessions = async () => {
        const { data } = await supabase
            .from('interactive_quiz_sessions' as any)
            .select('*')
            .eq('host_id', user?.id)
            .order('created_at', { ascending: false });

        if (data) setSessions(data as unknown as QuizSession[]);
    };

    const fetchClasses = async () => {
        let query = supabase.from('users' as any).select('class, managed_by_id').not('class', 'is', null);
        const { data } = await query;
        if (data) {
            // Standard admins only see classes from their managed students
            const filtered = isSuperAdmin ? data : data.filter((d: any) => d.managed_by_id === user?.id);
            const uniqueClasses = Array.from(new Set(filtered.map((d: any) => d.class))).sort();
            setClasses(uniqueClasses as string[]);
            if (uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0] as string);
        }
    };

    const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this session?')) return;

        await supabase.from('interactive_quiz_sessions' as any).delete().eq('id', id);
        setSessions(prev => prev.filter(s => s.id !== id));
    };

    const handleCreateNewSession = () => {
        setSessionTitle(`Class Quiz ${new Date().toLocaleDateString()}`);
        setDraftQuestions([{ id: Date.now(), text: '', a: '', b: '', c: '', d: '', correct: 'A' }]);
        setIsSubmittingSession(false);
        setCreateSessionMode('selector');
        setViewMode('create-session');
    };

    const enterGoLivePrep = (session: QuizSession) => {
        setActiveSession(session);
        if (session.class_id) setSelectedClass(session.class_id);
        setViewMode('go-live-prep');
    };

    const handleStartLiveSession = async () => {
        if (!activeSession || !selectedClass) return;

        // Update session with class and active status
        const { data, error } = await supabase
            .from('interactive_quiz_sessions' as any)
            .update({ class_id: selectedClass, status: 'idle' })
            .eq('id', activeSession.id)
            .select()
            .single();

        if (data && !error) {
            const _data = data as unknown as QuizSession;
            setActiveSession(_data);
            await loadQuestions(_data.id);
            subscribeToResponses(_data.id);
            setViewMode('active-session');
        }
    };

    const loadQuestions = async (sessionId: string) => {
        const { data } = await supabase
            .from('interactive_quiz_questions' as any)
            .select('*')
            .eq('session_id', sessionId)
            .order('order_index', { ascending: true });

        if (data) {
            const _data = data as unknown as QuizQuestion[];
            setQuestions(_data);
            if (_data.length > 0 && activeSession?.current_question_id) {
                const idx = _data.findIndex(q => q.id === activeSession.current_question_id);
                if (idx !== -1) setCurrentQuestionIndex(idx);
            }
        }
    };

    const subscribeToResponses = (sessionId: string) => {
        supabase.channel(`responses_${sessionId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'interactive_quiz_responses', filter: `session_id=eq.${sessionId}` }, payload => {
                const newResponse = payload.new;
                if (activeSession?.current_question_id === newResponse.question_id) {
                    setResponses(prev => ({ ...prev, [newResponse.student_id]: newResponse.answer }));
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'interactive_quiz_sessions', filter: `id=eq.${sessionId}` }, payload => {
                setActiveSession(payload.new as QuizSession);
            })
            .subscribe();
    };

    // Scanner State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const animationFrameId = useRef<number>();
    const detectorRef = useRef<any>(null);
    const lastDetectTime = useRef<number>(0);

    const startScan = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setIsScanning(true);
                processFrame();
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera.");
        }
    };

    const stopScan = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        setIsScanning(false);
    };

    const processFrame = () => {
        if (!videoRef.current || !canvasRef.current || !detectorRef.current || !isScanning) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animationFrameId.current = requestAnimationFrame(processFrame);
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const now = performance.now();
        if (now - lastDetectTime.current > 200) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let markers = detectorRef.current.detect(imageData);
            if (markers.length > 0) {
                drawMarkers(ctx, markers);
                processMarkers(markers);
            }
            lastDetectTime.current = performance.now();
        }

        animationFrameId.current = requestAnimationFrame(processFrame);
    };

    const getAnswerFromRotation = (marker: any): string => {
        const c0 = marker.corners[0];
        const c1 = marker.corners[1];
        const c3 = marker.corners[3];
        const dxTop = c1.x - c0.x;
        const dyTop = c1.y - c0.y;
        const dxLeft = c0.x - c3.x;
        const dyLeft = c0.y - c3.y;

        const lenTop = Math.sqrt(dxTop * dxTop + dyTop * dyTop);
        const lenLeft = Math.sqrt(dxLeft * dxLeft + dyLeft * dyLeft);

        const dirXTop = dxTop / lenTop;
        const dirYTop = dyTop / lenTop;
        const dirXLeft = dxLeft / lenLeft;
        const dirYLeft = dyLeft / lenLeft;

        // A is Up: Vector 0->1 is horizontal to the right (1, 0), Vector 3->0 is vertical up (0, -1)
        if (dirXTop > 0.7 && dirYLeft < -0.7) return 'A';
        // B is Up: Vector 0->1 is vertical down (0, 1), Vector 3->0 is horizontal right (1, 0)
        if (dirYTop > 0.7 && dirXLeft > 0.7) return 'B';
        // C is Up: Vector 0->1 is horizontal left (-1, 0), Vector 3->0 is vertical down (0, 1)
        if (dirXTop < -0.7 && dirYLeft > 0.7) return 'C';
        // D is Up: Vector 0->1 is vertical up (0, -1), Vector 3->0 is horizontal left (-1, 0)
        if (dirYTop < -0.7 && dirXLeft < -0.7) return 'D';

        return 'A'; // Default fallback
    };

    const processMarkers = async (markers: any[]) => {
        if (!activeSession || activeSession.status !== 'polling' || !activeSession.current_question_id) return;

        const updates: any[] = [];
        const uniqueStudentIds = new Set<string>();

        markers.forEach(marker => {
            const answer = getAnswerFromRotation(marker);
            // Mock map marker ID to student ID based on class formatting for now.
            // In a real scenario, this would look up the user by marker_id.
            const studentId = `${selectedClass}-${marker.id}`;

            if (!uniqueStudentIds.has(studentId) && responses[studentId] !== answer) {
                uniqueStudentIds.add(studentId);
                updates.push({
                    session_id: activeSession.id,
                    question_id: activeSession.current_question_id!,
                    student_id: studentId,
                    answer: answer
                });
            }
        });

        if (updates.length > 0) {
            const { error } = await supabase
                .from('interactive_quiz_responses' as any)
                .upsert(updates, { onConflict: 'session_id,question_id,student_id' });

            if (!error) {
                const newResponses = { ...responses };
                updates.forEach(u => newResponses[u.student_id] = u.answer);
                setResponses(newResponses);
            }
        }
    };

    const drawMarkers = (ctx: CanvasRenderingContext2D, markers: any[]) => {
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#10b981"; // Emerald
        markers.forEach(marker => {
            ctx.beginPath();
            ctx.moveTo(marker.corners[0].x, marker.corners[0].y);
            ctx.lineTo(marker.corners[1].x, marker.corners[1].y);
            ctx.lineTo(marker.corners[2].x, marker.corners[2].y);
            ctx.lineTo(marker.corners[3].x, marker.corners[3].y);
            ctx.closePath();
            ctx.stroke();

            // Mark top edge
            ctx.strokeStyle = "#ef4444"; // Red
            ctx.beginPath();
            ctx.moveTo(marker.corners[0].x, marker.corners[0].y);
            ctx.lineTo(marker.corners[1].x, marker.corners[1].y);
            ctx.stroke();
            ctx.strokeStyle = "#10b981";

            const cx = (marker.corners[0].x + marker.corners[2].x) / 2;
            const cy = (marker.corners[0].y + marker.corners[2].y) / 2;

            // Draw background for ID pill
            ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
            ctx.beginPath();
            ctx.roundRect(cx - 30, cy - 20, 60, 40, 8);
            ctx.fill();

            // Draw ID
            ctx.fillStyle = "#10b981";
            ctx.font = "bold 24px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(marker.id.toString(), cx, cy);
        });
    };

    // --- RENDER DASHBOARD ---
    const renderDashboard = () => (
        <div className="w-full px-6 md:px-10 py-6 md:py-8 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-10">
                <h1 className="text-4xl font-black text-slate-800 tracking-tight">Welcome to QR Up!</h1>
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl shadow-sm border border-slate-200 transition-all active:scale-95">
                        <Settings size={20} className="text-slate-500" />
                        System Setting
                    </button>
                    <button onClick={handleCreateNewSession} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-400 to-rose-400 hover:from-orange-500 hover:to-rose-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-200 transition-all active:scale-95">
                        <Plus size={20} strokeWidth={3} />
                        Create New Session
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map(s => (
                    <div key={s.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-500">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{s.title || 'Untitled Session'}</h3>
                                    <p className="text-sm font-medium text-slate-500">{new Date(s.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                        <div className="pt-6 border-t border-slate-100 mt-2 flex justify-between items-center">
                            <button onClick={(e) => handleDeleteSession(e, s.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={20} />
                            </button>
                            <button onClick={() => enterGoLivePrep(s)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-95">
                                Go Live!
                                <Play size={16} fill="currentColor" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {sessions.length === 0 && (
                <div className="text-center py-20">
                    <div className="w-24 h-24 bg-orange-100 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Camera size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">No Sessions Yet</h2>
                    <p className="text-slate-500 max-w-sm mx-auto">Create a new session to add questions and start scanning your students' answers.</p>
                </div>
            )}

            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 text-orange-500 rounded-xl">
                                    <SlidersHorizontal size={24} />
                                </div>
                                <h2 className="text-xl font-black text-slate-800">System Setting</h2>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-8">
                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Reward Tiers (Coins)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">1st Place</label>
                                        <input type="number" value={rewardTiers.first} onChange={e => setRewardTiers({ ...rewardTiers, first: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">2nd Place</label>
                                        <input type="number" value={rewardTiers.second} onChange={e => setRewardTiers({ ...rewardTiers, second: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">3rd Place</label>
                                        <input type="number" value={rewardTiers.third} onChange={e => setRewardTiers({ ...rewardTiers, third: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 block mb-1">Participation</label>
                                        <input type="number" value={rewardTiers.participation} onChange={e => setRewardTiers({ ...rewardTiers, participation: parseInt(e.target.value) || 0 })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">General</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="font-bold text-slate-700">Sound Effects</p>
                                            <p className="text-xs text-slate-400 mt-1">Play sounds on scan & reveal</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="font-bold text-slate-700">Scan Timer (Seconds)</p>
                                            <p className="text-xs text-slate-400 mt-1">Time allowed per question</p>
                                        </div>
                                        <input type="number" value={timerSeconds} onChange={e => setTimerSeconds(parseInt(e.target.value) || 30)} className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700 text-center outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20" />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                        <div>
                                            <p className="font-bold text-orange-700">ArUco Marker Generator</p>
                                            <p className="text-xs text-orange-400 mt-1">Generate and print student markers</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setShowSettings(false);
                                                setViewMode('marker-generator');
                                            }}
                                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all active:scale-95 text-sm"
                                        >
                                            Launch
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setShowSettings(false)} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-95">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // --- RENDER GO LIVE PREP ---
    const renderGoLivePrep = () => (
        <div className="w-full h-full flex items-center justify-center p-6 bg-slate-100/50 backdrop-blur animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-orange-400 to-rose-400 p-8 text-white relative">
                    <button onClick={() => setViewMode('dashboard')} className="absolute top-6 left-6 p-2 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur transition-all">
                        <X size={24} />
                    </button>
                    <div className="mt-8">
                        <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold tracking-wide uppercase shadow-sm">Preparation</span>
                        <h2 className="text-3xl font-black mt-4 leading-tight">{activeSession?.title}</h2>
                    </div>
                </div>

                <div className="p-8 flex-1 overflow-y-auto">
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Host for Class</label>
                        <select
                            value={selectedClass}
                            onChange={e => setSelectedClass(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-lg font-bold text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-400/20 transition-all appearance-none cursor-pointer"
                        >
                            <option value="" disabled>Select a class...</option>
                            {classes.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 pointer-events-none opacity-75">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Settings size={18} /> System Defaults (Read Only)</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                                <span>Reward Tiers</span>
                                <span className="text-slate-800">1st: {rewardTiers.first}, 2nd: {rewardTiers.second}, 3rd: {rewardTiers.third}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                                <span>Sound Effects</span>
                                <span className="text-slate-800">{soundEnabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                                <span>Scan Timer</span>
                                <span className="text-slate-800">{timerSeconds}s</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                    <button onClick={() => setViewMode('dashboard')} className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleStartLiveSession}
                        disabled={!selectedClass}
                        className="flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-lg"
                    >
                        Start Live Session
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>
        </div>
    );

    // --- RENDER ACTIVE SESSION ---
    const renderActiveSession = () => (
        <div className="w-full h-screen bg-slate-900 text-white flex flex-col md:flex-row overflow-hidden absolute inset-0 z-50 animate-in slide-in-from-bottom duration-500">
            {/* Left Side: Camera & Grid */}
            <div className="flex-1 flex flex-col min-w-0 pr-0 md:pr-4 p-4 md:p-6 pb-0">
                <header className="flex justify-between items-center mb-6">
                    <div>
                        <span className="text-orange-400 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                            QR Up! Live
                            {activeSession?.status === 'polling' && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">REC</span>}
                            {activeSession?.status === 'revealed' && <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full">REVEALED</span>}
                        </span>
                        <h1 className="text-2xl font-black truncate">{activeSession?.title} <span className="text-slate-500 ml-2 font-medium">• Class {selectedClass}</span></h1>
                    </div>
                    <button onClick={endSessionAndReturn} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all active:scale-95">
                        End Session
                    </button>
                </header>

                <div className="flex-1 flex flex-col gap-6 max-h-full pb-6">
                    {/* Camera Feed */}
                    <div className="flex-1 bg-black rounded-3xl border-4 border-slate-800 shadow-2xl relative overflow-hidden">
                        {isScanning ? (
                            <>
                                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover hidden" playsInline />
                                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <button onClick={stopScan} className="bg-red-500 hover:bg-red-400 text-white p-3 rounded-full shadow-lg transition active:scale-90">
                                        <Square fill="currentColor" size={20} />
                                    </button>
                                </div>
                                {activeSession?.status === 'polling' && (
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-emerald-400 px-4 py-2 rounded-full font-bold flex items-center gap-2 animate-pulse mt-2 ml-2 shadow-lg">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                                        Scanning Active
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <Video size={64} className="text-slate-700 mb-6" />
                                <button
                                    onClick={startScan}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-full font-black text-lg shadow-[0_0_40px_rgba(16,185,129,0.3)] transition transform active:scale-95 flex items-center gap-2"
                                >
                                    <Play fill="currentColor" /> Start Camera
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Question Box */}
                    <div className="bg-slate-800 rounded-3xl p-6 md:p-8 flex items-center justify-center min-h-[120px] shadow-2xl">
                        <h2 className="text-2xl md:text-4xl font-black text-center leading-tight">
                            {questions[currentQuestionIndex]?.question_text || "Waiting for question..."}
                        </h2>
                    </div>

                    {/* 2x2 Massive Color Grid */}
                    <div className="grid grid-cols-2 grid-rows-2 gap-4 h-[35vh]">
                        <button className="bg-red-500 hover:bg-red-400 rounded-3xl p-6 flex items-center justify-center shadow-lg transition-transform active:scale-95 group relative overflow-hidden">
                            <span className="absolute top-4 left-6 text-2xl font-black text-white/50">A</span>
                            <span className="text-3xl lg:text-5xl font-black text-white text-center z-10">{questions[currentQuestionIndex]?.options?.A || 'Option A'}</span>
                        </button>
                        <button className="bg-orange-500 hover:bg-orange-400 rounded-3xl p-6 flex items-center justify-center shadow-lg transition-transform active:scale-95 group relative overflow-hidden">
                            <span className="absolute top-4 left-6 text-2xl font-black text-white/50">B</span>
                            <span className="text-3xl lg:text-5xl font-black text-white text-center z-10">{questions[currentQuestionIndex]?.options?.B || 'Option B'}</span>
                        </button>
                        <button className="bg-blue-500 hover:bg-blue-400 rounded-3xl p-6 flex items-center justify-center shadow-lg transition-transform active:scale-95 group relative overflow-hidden">
                            <span className="absolute top-4 left-6 text-2xl font-black text-white/50">C</span>
                            <span className="text-3xl lg:text-5xl font-black text-white text-center z-10">{questions[currentQuestionIndex]?.options?.C || 'Option C'}</span>
                        </button>
                        <button className="bg-purple-500 hover:bg-purple-400 rounded-3xl p-6 flex items-center justify-center shadow-lg transition-transform active:scale-95 group relative overflow-hidden">
                            <span className="absolute top-4 left-6 text-2xl font-black text-white/50">D</span>
                            <span className="text-3xl lg:text-5xl font-black text-white text-center z-10">{questions[currentQuestionIndex]?.options?.D || 'Option D'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Side: Roster Panel */}
            <div className="w-full md:w-80 lg:w-96 bg-slate-800 flex flex-col h-full shrink-0 border-l border-slate-700">
                <div className="p-6 border-b border-slate-700 bg-slate-800/80 backdrop-blur z-10 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg text-white mb-1">Live Roster</h3>
                        <p className="text-sm font-medium text-emerald-400">{Object.keys(responses).length} Réponses</p>
                    </div>
                    <button
                        onClick={toggleRevealStatus}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-90 ${activeSession?.status === 'polling'
                            ? 'bg-blue-600 hover:bg-blue-500 text-white'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                            }`}
                        title={activeSession?.status === 'polling' ? "Reveal Answers" : "Next Question / Reset"}
                    >
                        {activeSession?.status === 'polling' ? <CheckCircle2 size={24} /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Student List */}
                    {Object.keys(responses).map(sid => {
                        const isRevealed = activeSession?.status === 'revealed';
                        const isCorrect = responses[sid] === questions[currentQuestionIndex]?.correct_answer;

                        return (
                            <div key={sid} className="bg-slate-700 p-4 rounded-xl flex justify-between items-center border border-slate-600 shadow-sm">
                                <span className="font-bold text-slate-200 truncate pr-4">{sid}</span>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${!isRevealed
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                    : isCorrect
                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                                        : 'bg-red-500 border-red-400 text-white'
                                    }`}>
                                    <span className="font-black text-lg">
                                        {!isRevealed ? '?' : responses[sid]}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {Object.keys(responses).length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                            <Users size={48} className="mb-4 opacity-30" />
                            <p className="font-bold text-lg text-slate-400">No Answers Yet</p>
                            <p className="text-sm mt-2">Point camera at student markers to register their answers automatically.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const toggleRevealStatus = async () => {
        if (!activeSession) return;

        const newStatus = activeSession.status === 'polling' ? 'revealed' : 'polling';

        const { error } = await supabase
            .from('interactive_quiz_sessions' as any)
            .update({ status: newStatus })
            .eq('id', activeSession.id);

        if (!error) {
            setActiveSession({ ...activeSession, status: newStatus });
            if (newStatus === 'polling') {
                // If moving back to polling (e.g., next question), we might want to clear local responses
                // For a real app, you'd advance currentQuestionIndex here.
                setResponses({});
            }
        }
    };

    const endSessionAndReturn = () => {
        stopScan();
        setActiveSession(null);
        setViewMode('dashboard');
    };

    // --- RENDER CREATE SESSION ---
    const renderCreateSession = () => {
        const handleImportQuestions = (imported: ImportedQuestion[]) => {
            const mapped = imported.map((q, idx) => ({
                id: Date.now() + idx,
                text: q.question,
                a: q.choices[0] || '',
                b: q.choices[1] || '',
                c: q.choices[2] || '',
                d: q.choices[3] || '',
                correct: (['A', 'B', 'C', 'D'][q.correct_answer_index] || 'A') as 'A' | 'B' | 'C' | 'D'
            }));
            setDraftQuestions(mapped);
            setCreateSessionMode('manual');
        };

        if (createSessionMode === 'selector') {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50">
                    <button onClick={() => setViewMode('dashboard')} className="absolute top-8 left-8 p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm border border-slate-200 transition-all active:scale-95 text-slate-500">
                        <ArrowLeft size={24} />
                    </button>
                    <ImportSourceSelector onSourceSelect={(source) => setCreateSessionMode(source as any)} />
                </div>
            );
        }

        if (createSessionMode === 'file') {
            return (
                <div className="w-full h-full bg-slate-50 overflow-y-auto">
                    <FileImporter
                        title={sessionTitle}
                        description=""
                        onImport={(valid) => handleImportQuestions(valid as ImportedQuestion[])}
                        onCancel={() => setCreateSessionMode('selector')}
                    />
                </div>
            );
        }

        if (createSessionMode === 'notion') {
            return (
                <div className="w-full h-full bg-slate-50 overflow-y-auto">
                    <NotionImporter
                        title={sessionTitle}
                        description=""
                        onImport={(valid) => handleImportQuestions(valid as ImportedQuestion[])}
                        onCancel={() => setCreateSessionMode('selector')}
                    />
                </div>
            );
        }

        const addQuestion = () => setDraftQuestions([...draftQuestions, { id: Date.now(), text: '', a: '', b: '', c: '', d: '', correct: 'A' }]);
        const removeQuestion = (id: number) => setDraftQuestions(draftQuestions.filter(q => q.id !== id));
        const updateQuestion = (id: number, field: string, value: string) => {
            setDraftQuestions(draftQuestions.map(q => q.id === id ? { ...q, [field]: value } : q));
        };

        const handleSaveSession = async () => {
            if (!sessionTitle) return alert("Please enter a session title");
            const validQs = draftQuestions.filter(q => q.text.trim() && q.a.trim() && q.b.trim() && q.c.trim() && q.d.trim());
            if (validQs.length === 0) return alert("Please add at least one complete question.");

            setIsSubmittingSession(true);
            const { data: sessionData, error: sessionError } = await supabase
                .from('interactive_quiz_sessions' as any)
                .insert({ host_id: user?.id, title: sessionTitle, status: 'idle' })
                .select()
                .single();

            if (sessionData && !sessionError) {
                const _sessionData = sessionData as unknown as QuizSession;
                const qInserts = validQs.map((q, idx) => ({
                    session_id: _sessionData.id,
                    question_text: q.text,
                    options: { "A": q.a, "B": q.b, "C": q.c, "D": q.d },
                    correct_answer: q.correct,
                    order_index: idx
                }));
                await supabase.from('interactive_quiz_questions' as any).insert(qInserts);

                setSessions([_sessionData, ...sessions]);
                setViewMode('dashboard');
            } else {
                alert("Failed to create session.");
            }
            setIsSubmittingSession(false);
        };

        return (
            <div className="w-full max-w-5xl mx-auto p-6 md:p-8 animate-in slide-in-from-right duration-300 h-screen flex flex-col">
                <header className="flex justify-between items-center mb-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setViewMode('dashboard')} className="p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm border border-slate-200 transition-all active:scale-95 text-slate-500">
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800">Create New Session</h1>
                            <p className="text-slate-500 font-medium font-sm">Add questions manually or import them.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveSession}
                        disabled={isSubmittingSession}
                        className="px-8 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmittingSession ? 'Saving...' : 'Save Session'} <CheckCircle2 size={20} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                        <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Session Title</label>
                        <input
                            type="text"
                            value={sessionTitle}
                            onChange={e => setSessionTitle(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xl font-black text-slate-800 outline-none focus:border-orange-400 focus:bg-white transition-all"
                            placeholder="e.g. History Midterm Quiz"
                        />
                    </div>

                    <div className="space-y-6">
                        {draftQuestions.map((q, index) => (
                            <div key={q.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 relative group">
                                <div className="absolute top-6 left-6 w-8 h-8 bg-slate-100 text-slate-400 font-bold rounded-lg flex items-center justify-center">
                                    {index + 1}
                                </div>
                                {draftQuestions.length > 1 && (
                                    <button
                                        onClick={() => removeQuestion(q.id)}
                                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <div className="ml-12 mb-6">
                                    <input
                                        type="text"
                                        value={q.text}
                                        onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                                        placeholder="Type your question here..."
                                        className="w-full text-xl font-bold text-slate-800 placeholder:text-slate-300 outline-none bg-transparent border-b-2 border-transparent focus:border-orange-200 pb-2 transition-colors"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(['A', 'B', 'C', 'D'] as const).map(opt => (
                                        <div key={opt} className={`relative flex items-center p-3 rounded-2xl border-2 transition-all ${q.correct === opt ? 'border-emerald-400 bg-emerald-50/50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                                            <button
                                                onClick={() => updateQuestion(q.id, 'correct', opt)}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-all ${q.correct === opt ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}
                                                title={`Mark ${opt} as correct`}
                                            >
                                                {opt}
                                            </button>
                                            <input
                                                type="text"
                                                value={q[opt.toLowerCase() as 'a' | 'b' | 'c' | 'd']}
                                                onChange={e => updateQuestion(q.id, opt.toLowerCase(), e.target.value)}
                                                placeholder={`Option ${opt} text`}
                                                className="flex-1 ml-3 bg-transparent font-medium text-slate-700 outline-none placeholder:text-slate-300"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={addQuestion}
                        className="w-full py-6 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-[2rem] text-slate-500 font-bold flex flex-col items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <Plus className="bg-white p-2 text-slate-400 rounded-full shadow-sm w-10 h-10" />
                        Add Another Question
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-full bg-slate-50 flex flex-col relative overflow-hidden font-sans">
            {viewMode === 'dashboard' && renderDashboard()}
            {viewMode === 'create-session' && renderCreateSession()}
            {viewMode === 'go-live-prep' && renderGoLivePrep()}
            {viewMode === 'active-session' && renderActiveSession()}
            {viewMode === 'marker-generator' && (
                <div className="w-full h-full overflow-y-auto">
                    <MarkerGenerator onBack={() => setViewMode('dashboard')} />
                </div>
            )}
        </div>
    );
}
