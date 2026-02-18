import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Eraser } from 'lucide-react';

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

export const CursiveWriting: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentLetter, setCurrentLetter] = useState('A');
    const [isDrawing, setIsDrawing] = useState(false);

    // Draw the template whenever the letter changes or canvas resizes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // Only set dimensions if they haven't been set to avoid clearing on re-renders if not needed
        // but here we do want to clear/redraw when letter changes.
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            drawTemplate(ctx, rect.width, rect.height, currentLetter);
        }
    }, [currentLetter]);

    const drawTemplate = (ctx: CanvasRenderingContext2D, width: number, height: number, letter: string) => {
        ctx.clearRect(0, 0, width, height);

        // Draw Guide Lines
        const midY = height / 2;
        const lineHeight = 100; // Space between top and bottom line

        ctx.strokeStyle = '#e2e8f0'; // slate-200
        ctx.lineWidth = 2;

        // Middle dashed line
        ctx.beginPath();
        ctx.setLineDash([10, 10]);
        ctx.moveTo(20, midY);
        ctx.lineTo(width - 20, midY);
        ctx.stroke();

        // Top and Bottom solid lines
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(20, midY - lineHeight / 2);
        ctx.lineTo(width - 20, midY - lineHeight / 2);
        ctx.moveTo(20, midY + lineHeight / 2);
        ctx.lineTo(width - 20, midY + lineHeight / 2);
        ctx.stroke();

        // Draw Letter Template
        ctx.font = '250px "Dancing Script", "Brush Script MT", cursive';
        ctx.fillStyle = '#cbd5e1'; // slate-300 (light gray for tracing)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, width / 2, midY);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDrawing(true);
        e.currentTarget.setPointerCapture(e.pointerId);

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const rect = canvas.getBoundingClientRect();
            ctx.beginPath();
            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
            ctx.strokeStyle = '#2563eb'; // blue-600
            ctx.lineWidth = 12; // Thick brush for tracing
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const rect = canvas.getBoundingClientRect();
            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            ctx.stroke();
        }
    };

    const handlePointerUp = () => {
        setIsDrawing(false);
    };

    const nextLetter = () => {
        const idx = LETTERS.indexOf(currentLetter);
        setCurrentLetter(LETTERS[(idx + 1) % LETTERS.length]);
    };

    const prevLetter = () => {
        const idx = LETTERS.indexOf(currentLetter);
        setCurrentLetter(LETTERS[(idx - 1 + LETTERS.length) % LETTERS.length]); // Handle negative mod
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Re-draw template (clears everything first)
        const rect = canvas.getBoundingClientRect();
        drawTemplate(ctx, rect.width, rect.height, currentLetter);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span className="font-bold">Back to Zone</span>
                </button>

                <div className="flex items-center gap-4">
                    <button
                        onClick={prevLetter}
                        className="p-2 rounded-full hover:bg-slate-100"
                    >
                        <ChevronLeft />
                    </button>
                    <span className="text-3xl font-bold font-serif w-12 text-center">{currentLetter}</span>
                    <button
                        onClick={nextLetter}
                        className="p-2 rounded-full hover:bg-slate-100"
                    >
                        <ChevronRight />
                    </button>
                </div>

                <button
                    onClick={clearCanvas}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                    <Eraser size={18} />
                    <span>Clear</span>
                </button>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative cursor-crosshair touch-none m-4 bg-white rounded-2xl shadow-inner border border-slate-200 overflow-hidden">
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    style={{ touchAction: 'none' }}
                />
            </div>

            <div className="text-center p-2 text-slate-400 text-sm">
                Tip: Follow the gray lines to practice your cursive!
            </div>
        </div>
    );
};
