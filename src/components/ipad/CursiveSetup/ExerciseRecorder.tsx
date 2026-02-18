import React, { useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Play, Square, Save, RotateCcw, Music, Image as ImageIcon, ArrowLeft, Mic } from 'lucide-react';

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

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [steps, setSteps] = useState<StrokePoint[]>([]);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [isMagnetic, setIsMagnetic] = useState(true);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const requestRef = useRef<number>();

    // Load existing data if editing
    useEffect(() => {
        if (exerciseId) {
            loadExercise(exerciseId);
        }
    }, [exerciseId]);

    const loadExercise = async (id: string) => {
        const { data, error } = await supabase
            .from('cursive_exercises')
            .select('*')
            .eq('id', id)
            .single();

        if (data) {
            setTitle(data.title);
            setImageUrl(data.image_url);
            setAudioUrl(data.audio_url);
            if (data.stroke_data) setSteps(data.stroke_data as any);
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
                // const a = data[i + 3];

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

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isRecording) return;
        // Start capturing strokes? 
        // Actually we might want continuous recording even if pen is up?
        // For now, let's record only when pen is down.
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
            // Stop
            setIsRecording(false);
            if (audioRef.current) audioRef.current.pause();
        } else {
            // Start
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

    const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'audio') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Existing upload helper might need update or we make a simple one here
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${type}s/${fileName}`; // images/123.jpg or audios/123.mp3

        const { data, error } = await supabase.storage
            .from('cursive-assets')
            .upload(filePath, file);

        if (error) {
            alert('Upload failed: ' + error.message);
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('cursive-assets')
            .getPublicUrl(filePath);

        if (type === 'image') {
            setImageUrl(publicUrl);
            setImageFile(file);
        } else {
            setAudioUrl(publicUrl);
            setAudioFile(file);
        }
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
            is_published: true
        };

        let error;
        if (exerciseId) {
            const { error: e } = await supabase
                .from('cursive_exercises')
                .update(payload)
                .eq('id', exerciseId);
            error = e;
        } else {
            const { error: e } = await supabase
                .from('cursive_exercises')
                .insert([payload]);
            error = e;
        }

        if (error) alert('Save failed: ' + error.message);
        else onSave();
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
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleAssetUpload(e, 'image')} />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                        <Music size={18} />
                        <span>{audioFile ? 'Change Audio' : 'Upload Audio'}</span>
                        <input type="file" accept="audio/*" className="hidden" onChange={e => handleAssetUpload(e, 'audio')} />
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
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                        />
                    </div>
                </div>

                {/* Sidebar Controls */}
                <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col gap-6">
                    <div>
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Mic size={18} className="text-blue-500" />
                            Recording Controls
                        </h3>

                        <div className="flex items-center gap-2 mb-4">
                            <button
                                onClick={toggleRecording}
                                disabled={!imageUrl}
                                className={`flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${isRecording
                                        ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                                        : 'bg-slate-900 text-white hover:bg-slate-800'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isRecording ? (
                                    <>
                                        <Square size={20} fill="currentColor" />
                                        Stop Recording
                                    </>
                                ) : (
                                    <>
                                        <div className="w-3 h-3 rounded-full bg-red-500" />
                                        Record Trace
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                            <input
                                type="checkbox"
                                id="magnetic"
                                checked={isMagnetic}
                                onChange={e => setIsMagnetic(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="magnetic" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                                Enable Magnetic Snapping
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <div>
                        <h3 className="font-bold text-slate-800 mb-2">Stats</h3>
                        <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex justify-between">
                                <span>Recorded Points:</span>
                                <span className="font-mono">{steps.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Duration:</span>
                                <span className="font-mono">
                                    {steps.length > 0 ? (steps[steps.length - 1].time / 1000).toFixed(1) : '0.0'}s
                                </span>
                            </div>
                        </div>
                    </div>

                    {audioUrl && (
                        <div className="mt-auto">
                            <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
