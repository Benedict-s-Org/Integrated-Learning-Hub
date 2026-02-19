
import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Image as ImageIcon, ArrowLeft, Settings, Save } from 'lucide-react';

interface StrokePoint {
    x: number;
    y: number;
    time: number; // relative to audio start
    pressure: number;
}

interface ExerciseRecorderProps {
    exerciseId?: string | null;
    onBack: () => void;
    onSave: () => void;
}

export const ExerciseRecorder: React.FC<ExerciseRecorderProps> = ({ exerciseId, onBack, onSave }) => {
    // Assets
    const [title, setTitle] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // Rhythm Config
    const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
    const [pressureMin, setPressureMin] = useState(0.10);
    const [pressureMax, setPressureMax] = useState(0.35);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [steps, setSteps] = useState<StrokePoint[]>([]);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [isMagnetic, setIsMagnetic] = useState(true);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // Load existing data if editing
    useEffect(() => {
        if (exerciseId) {
            loadExercise(exerciseId);
        }
    }, [exerciseId]);

    const loadExercise = async (id: string) => {
        const { data } = await supabase
            .from('cursive_exercises' as any)
            .select('*')
            .eq('id', id)
            .single();

        if (data) {
            const exercise = data as any;
            setTitle(exercise.title);
            setImageUrl(exercise.image_url);
            setAudioUrl(exercise.audio_url);
            setSteps(exercise.stroke_data || []);
            if (exercise.rhythm_config) {
                const conf = exercise.rhythm_config as any;
                setDifficulty(conf.difficulty || 'normal');
                if (conf.pressure) {
                    setPressureMin(conf.pressure.min || 0.10);
                    setPressureMax(conf.pressure.max || 0.35);
                }
            }
        }
    };

    // Draw Image to Canvas
    useEffect(() => {
        if (!imageUrl) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        img.onload = () => {
            imageRef.current = img;
            redrawCanvas();
        };
    }, [imageUrl]);

    const redrawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas || !imageRef.current) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set dimensions (fixed or responsive? Fixed for now to match recording data)
        canvas.width = 1024;
        canvas.height = 768;

        // Draw background image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

        // Draw existing strokes (preview)
        if (steps.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Blue trace
            ctx.lineWidth = 4;
            ctx.moveTo(steps[0].x, steps[0].y);
            for (let i = 1; i < steps.length; i++) {
                ctx.lineTo(steps[i].x, steps[i].y);
            }
            ctx.stroke();

            // Draw Start/End points
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(steps[0].x, steps[0].y, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(steps[steps.length - 1].x, steps[steps.length - 1].y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    // Magnetic Snapping Logic
    const getSnappedPosition = (x: number, y: number): { x: number, y: number } => {
        if (!isMagnetic || !canvasRef.current) return { x, y };

        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
        if (!ctx) return { x, y };

        // Define search window (20x20)
        const range = 20;
        const startX = Math.max(0, x - range / 2);
        const startY = Math.max(0, y - range / 2);

        try {
            const imageData = ctx.getImageData(startX, startY, range, range);
            const data = imageData.data;

            let darkestVal = 255 * 3; // Max brightness
            let bestX = x;
            let bestY = y;
            let foundDark = false;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                const brightness = r + g + b;

                // Threshold for "ink" (adjust as needed, assumes black ink on white paper)
                if (brightness < 400) {
                    if (brightness < darkestVal) {
                        darkestVal = brightness;
                        const pixelIndex = i / 4;
                        const localX = pixelIndex % range;
                        const localY = Math.floor(pixelIndex / range);
                        bestX = startX + localX;
                        bestY = startY + localY;
                        foundDark = true;
                    }
                }
            }
            return foundDark ? { x: bestX, y: bestY } : { x, y };

        } catch (e) {
            console.error(e);
            return { x, y };
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isRecording || !startTime) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const rawX = (e.clientX - rect.left) * scaleX;
        const rawY = (e.clientY - rect.top) * scaleY;

        const snapped = getSnappedPosition(rawX, rawY);

        const point: StrokePoint = {
            x: snapped.x,
            y: snapped.y,
            time: Date.now() - startTime,
            pressure: e.pressure || 0.5
        };

        setSteps(prev => [...prev, point]);

        // Draw live feedback (the red dot)
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(snapped.x, snapped.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            setIsRecording(false);
            if (audioRef.current) audioRef.current.pause();
        } else {
            setSteps([]); // Clear previous attempt
            setIsRecording(true);
            setStartTime(Date.now());
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play();
            }
            redrawCanvas(); // Clear old strokes
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `images/${fileName}`;

        const { data, error } = await supabase.storage
            .from('cursive-assets')
            .upload(filePath, file);

        if (error) {
            alert('Image upload failed: ' + error.message);
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('cursive-assets')
            .getPublicUrl(filePath);

        setImageUrl(publicUrl);
        setImageFile(file);
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `audios/${fileName}`;

        const { data, error } = await supabase.storage
            .from('cursive-assets')
            .upload(filePath, file);

        if (error) {
            alert('Audio upload failed: ' + error.message);
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('cursive-assets')
            .getPublicUrl(filePath);

        setAudioUrl(publicUrl);
        setAudioFile(file);
    };

    const handleSave = async () => {
        if (!title || !imageUrl) {
            alert('Title and Image are required');
            return;
        }

        const payload = {
            title,
            image_url: imageUrl,
            audio_url: audioUrl,
            stroke_data: steps,
            is_published: true,
            rhythm_config: {
                difficulty,
                pressure: {
                    min: pressureMin,
                    max: pressureMax,
                    hardThreshold: 0.50
                }
            }
        };

        if (exerciseId) {
            await supabase.from('cursive_exercises' as any).update(payload).eq('id', exerciseId);
        } else {
            await supabase.from('cursive_exercises' as any).insert([payload]);
        }
        onSave();
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm flex items-center justify-between border-b">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                        <ArrowLeft size={20} />
                    </button>
                    <input
                        type="text"
                        placeholder="Exercise Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="text-xl font-bold bg-transparent border-none focus:ring-0 placeholder-slate-300"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                        <ImageIcon size={18} />
                        <span>{imageFile ? 'Change Image' : 'Upload Image'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                        <Mic size={18} />
                        <span>{audioFile ? 'Change Audio' : 'Upload Audio'}</span>
                        <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                    </label>
                    <div className="h-6 w-px bg-slate-200" />
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                        <Save size={18} />
                        <span>Save Exercise</span>
                    </button>
                </div>
            </div>

            {/* Editing Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Image/Canvas Container */}
                <div className="flex-1 relative bg-slate-200 overflow-auto flex items-center justify-center p-8">
                    <div className="relative shadow-xl bg-white">
                        {!imageUrl && (
                            <div className="w-[800px] h-[600px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                                <ImageIcon size={64} className="mb-4 opacity-50" />
                                <p>Upload an image to start</p>
                            </div>
                        )}
                        <canvas
                            ref={canvasRef}
                            className="bg-white touch-none cursor-crosshair max-w-full max-h-full"
                            style={{ display: imageUrl ? 'block' : 'none' }}
                            onPointerMove={handlePointerMove}
                        />
                    </div>
                </div>

                {/* Sidebar Controls */}
                <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col gap-6 overflow-y-auto">
                    {/* Recording Controls */}
                    <div className="bg-slate-50 p-4 rounded-xl">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Mic size={18} className="text-blue-500" />
                            Recording
                        </h3>

                        <div className="flex items-center gap-2 mb-4">
                            <button
                                onClick={toggleRecording}
                                disabled={!imageUrl}
                                className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${isRecording
                                    ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                                    } disabled:opacity-50`}
                            >
                                {isRecording ? 'Stop Recording' : 'Start Recording'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="magnetic"
                                checked={isMagnetic}
                                onChange={e => setIsMagnetic(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="magnetic" className="text-sm font-medium text-slate-700 cursor-pointer">
                                Enable Magnetic Snapping
                            </label>
                        </div>
                    </div>

                    {/* Rhythm Config */}
                    <div className="bg-slate-50 p-4 rounded-xl">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Settings size={18} className="text-purple-500" />
                            Configuration
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                    Difficulty
                                </label>
                                <div className="flex gap-2">
                                    {['easy', 'normal', 'hard'].map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setDifficulty(d as any)}
                                            className={`flex-1 py-1 text-sm font-bold capitalize rounded border ${difficulty === d
                                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex justify-between">
                                    <span>Gentle Zone</span>
                                    <span>{pressureMin.toFixed(2)} - {pressureMax.toFixed(2)}</span>
                                </label>
                                <div className="h-4 bg-slate-200 rounded-full relative">
                                    <div
                                        className="absolute top-0 bottom-0 bg-green-400 rounded-full opacity-50"
                                        style={{ left: `${pressureMin * 100}%`, width: `${(pressureMax - pressureMin) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="range" min="0" max="1" step="0.05"
                                        value={pressureMin}
                                        onChange={e => setPressureMin(Number(e.target.value))}
                                        className="flex-1"
                                    />
                                    <input
                                        type="range" min="0" max="1" step="0.05"
                                        value={pressureMax}
                                        onChange={e => setPressureMax(Number(e.target.value))}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Audio Preview */}
                    {audioUrl && (
                        <div className="bg-slate-50 p-4 rounded-xl mt-auto">
                            <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
