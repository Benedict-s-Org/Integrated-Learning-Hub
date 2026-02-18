import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play, Pause, RefreshCw, Home, Star, Volume2, Upload } from 'lucide-react';

interface StrokePoint {
    x: number;
    y: number;
    time: number;
    pressure: number;
}

interface CursiveExercise {
    id: string;
    title: string;
    image_url: string;
    audio_url: string;
    stroke_data: StrokePoint[];
    canvas_width: number;
    canvas_height: number;
}

interface CursivePlayerProps {
    exerciseId: string;
    onBack: () => void;
}

export const CursivePlayer: React.FC<CursivePlayerProps> = ({ exerciseId, onBack }) => {
    // Data State
    const [exercise, setExercise] = useState<CursiveExercise | null>(null);
    const [loading, setLoading] = useState(true);

    // Playback State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Scoring State
    const [userPath, setUserPath] = useState<StrokePoint[]>([]);
    const [score, setScore] = useState(0);
    const [totalError, setTotalError] = useState(0);
    const [frames, setFrames] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // For guide/shining head
    const inputCanvasRef = useRef<HTMLCanvasElement>(null); // For user drawing
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const animationFrameRef = useRef<number>();
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Load Exercise
    useEffect(() => {
        const loadExercise = async () => {
            const { data } = await supabase
                .from('cursive_exercises')
                .select('*')
                .eq('id', exerciseId)
                .single();

            if (data) {
                setExercise({
                    ...data,
                    stroke_data: data.stroke_data as unknown as StrokePoint[]
                });

                // Preload Image
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = data.image_url;
                img.onload = () => {
                    imageRef.current = img;
                    drawBackground();
                };
            }
            setLoading(false);
        };
        loadExercise();
    }, [exerciseId]);

    // Initial Drawing
    const drawBackground = () => {
        const canvas = canvasRef.current;
        if (!canvas || !imageRef.current || !exercise) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set dimensions
        canvas.width = exercise.canvas_width || 1024;
        canvas.height = exercise.canvas_height || 768;

        ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

        // Draw faint admin trace
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (exercise.stroke_data.length > 0) {
            ctx.moveTo(exercise.stroke_data[0].x, exercise.stroke_data[0].y);
            for (let i = 1; i < exercise.stroke_data.length; i++) {
                ctx.lineTo(exercise.stroke_data[i].x, exercise.stroke_data[i].y);
            }
            ctx.stroke();
        }
    };

    // Animation Loop
    useEffect(() => {
        if (!isPlaying || !exercise) {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const animate = () => {
            if (!audioRef.current || !overlayCanvasRef.current) return;

            const time = audioRef.current.currentTime * 1000; // ms
            setCurrentTime(time);

            // Calculate progress through stroke data
            const guidePos = getGuidePosition(time);
            drawGuide(guidePos);

            if (time >= duration * 1000 && duration > 0) {
                handleFinish();
                return;
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPlaying, duration, exercise]);

    const getGuidePosition = (time: number): { x: number, y: number, visible: boolean } => {
        if (!exercise) return { x: 0, y: 0, visible: false };

        const data = exercise.stroke_data;
        if (data.length === 0) return { x: 0, y: 0, visible: false };

        // Find the segment we are in
        // Assuming data is sorted by time
        if (time < data[0].time) return { x: data[0].x, y: data[0].y, visible: true }; // Waiting at start
        if (time > data[data.length - 1].time) return { ...data[data.length - 1], visible: false }; // Finished

        // Binary search or linear scan (linear for now since we move forward)
        // Optimization: track last index
        for (let i = 0; i < data.length - 1; i++) {
            if (time >= data[i].time && time <= data[i + 1].time) {
                const t1 = data[i].time;
                const t2 = data[i + 1].time;
                const ratio = (time - t1) / (t2 - t1);

                return {
                    x: data[i].x + (data[i + 1].x - data[i].x) * ratio,
                    y: data[i].y + (data[i + 1].y - data[i].y) * ratio,
                    visible: true
                };
            }
        }

        return { x: 0, y: 0, visible: false };
    };

    const drawGuide = (pos: { x: number, y: number, visible: boolean }) => {
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear previous frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (pos.visible) {
            // Draw "Shining" Head
            const gradient = ctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, 15);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.8)'); // Blue glow
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
            ctx.fill();

            // Draw solid core
            ctx.fillStyle = '#2563eb';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    // User Input Handling
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isPlaying || !exercise || isFinished) return;

        const canvas = inputCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Visual Feedback (User Trace)
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; // User ink color
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y); // Should really connect to last point... but for simplicity
            // To connect: store last point in ref
            // Let's assume high frequency events for now
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Scoring Logic: Rhythm Check
        // Calculate distance to current guide position
        const guidePos = getGuidePosition(currentTime);
        if (guidePos.visible) { // Only score if we should be drawing
            const dist = Math.hypot(x - guidePos.x, y - guidePos.y);

            // Accumulate error
            // Only accumulate if pen is down? pointer events handle that
            // "PointerMove" fires regardless? No, setPointerCapture on down.
            // Oh wait, pointermove fires always. We need to check pressure or buttons.
            if (e.buttons > 0) {
                setTotalError(prev => prev + dist);
                setFrames(prev => prev + 1);
            }
        }
    };

    // Calculate final score
    const calculateScore = () => {
        if (frames === 0) return 0;
        const avgError = totalError / frames;
        // Map average error (pixels) to score
        // e.g. 0 error = 100
        // 50px error = 0
        const score = Math.max(0, 100 - (avgError * 2)); // Strictness factor
        return Math.round(score);
    };

    const handleFinish = async () => {
        setIsFinished(true);
        setIsPlaying(false);
        const finalScore = calculateScore();
        setScore(finalScore);

        // Save Attempt
        const { error } = await supabase
            .from('cursive_attempts')
            .insert([{
                exercise_id: exerciseId,
                score: finalScore,
                // stroke_data: userPath // Optimization: don't save full path for now unless needed for playback
            }]);

        if (error) console.error('Error saving attempt:', error);
    };

    const handlePlay = () => {
        if (!audioRef.current) return;
        if (isFinished) {
            // Reset
            setIsFinished(false);
            setScore(0);
            setTotalError(0);
            setFrames(0);
            audioRef.current.currentTime = 0;
            // Clear canvases
            const c1 = overlayCanvasRef.current;
            const c2 = inputCanvasRef.current;
            if (c1) c1.getContext('2d')?.clearRect(0, 0, c1.width, c1.height);
            if (c2) c2.getContext('2d')?.clearRect(0, 0, c2.width, c2.height);
        }
        audioRef.current.play();
        setIsPlaying(true);
    };

    const handlePause = () => {
        if (!audioRef.current) return;
        audioRef.current.pause();
        setIsPlaying(false);
    };

    if (loading) return <div className="p-12 text-center text-slate-500">Loading exercise...</div>;
    if (!exercise) return <div className="p-12 text-center text-red-500">Exercise not found</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-100">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                        <Home size={20} />
                    </button>
                    <div>
                        <h2 className="font-bold text-lg text-slate-800">{exercise.title}</h2>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Volume2 size={14} />
                            <span>Rhythm synced</span>
                        </div>
                    </div>
                </div>

                {isFinished && (
                    <div className="flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-lg text-yellow-700 font-bold animate-pulse">
                        <Star size={20} fill="currentColor" />
                        <span>Score: {score}</span>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={isPlaying ? handlePause : handlePlay}
                        className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${isPlaying
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl hover:scale-105'
                            }`}
                    >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
                        <span>{isPlaying ? 'Pause' : isFinished ? 'Retry' : 'Start'}</span>
                    </button>
                </div>
            </div>

            {/* Stage */}
            <div className="flex-1 relative bg-slate-200 overflow-hidden flex items-center justify-center p-4">
                <div className="relative shadow-2xl bg-white rounded-lg overflow-hidden border-4 border-slate-300">
                    {/* Background Layer (Image + Trace) */}
                    <canvas
                        ref={canvasRef}
                        className="bg-white block"
                    />

                    {/* User Input Layer */}
                    <canvas
                        ref={inputCanvasRef}
                        width={exercise.canvas_width || 1024}
                        height={exercise.canvas_height || 768}
                        className="absolute inset-0 touch-none cursor-crosshair"
                        onPointerMove={handlePointerMove}
                        onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
                    />

                    {/* Guide Overlay Layer (Shining head) */}
                    <canvas
                        ref={overlayCanvasRef}
                        width={exercise.canvas_width || 1024}
                        height={exercise.canvas_height || 768}
                        className="absolute inset-0 pointer-events-none"
                    />

                    {/* Message Overlay */}
                    {!isPlaying && !isFinished && currentTime === 0 && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm pointer-events-none">
                            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm animate-in fade-in zoom-in duration-300">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Play size={32} fill="currentColor" className="ml-1" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Ready to Write?</h3>
                                <p className="text-slate-500">
                                    Listen to the rhythm and follow the shining light. Try to stay as close as possible!
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Audio Element */}
            <audio
                ref={audioRef}
                src={exercise.audio_url}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={handleFinish}
                className="hidden"
            />
        </div>
    );
};
