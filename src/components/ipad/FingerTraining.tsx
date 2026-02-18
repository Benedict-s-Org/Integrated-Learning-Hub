import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export const FingerTraining: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pressure, setPressure] = useState(0);
    const [isDrawing, setIsDrawing] = useState(false);
    const [feedback, setFeedback] = useState("Touch lightly...");

    // Configuration
    const TARGET_PRESSURE_MIN = 0.15;
    const TARGET_PRESSURE_MAX = 0.4;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Handle High DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDrawing(true);
        handlePointerMove(e);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing && e.type !== 'pointerdown') return;

        // Update pressure state
        // Some devices don't support pressure (mouse usually 0.5 or 0)
        // We can simulate pressure with mouse for testing if needed, but for now strict.
        const currentPressure = e.pressure;
        setPressure(currentPressure);

        // Feedback Logic
        if (currentPressure === 0) {
            setFeedback("Touch the screen");
        } else if (currentPressure < TARGET_PRESSURE_MIN) {
            setFeedback("Good! Very light...");
        } else if (currentPressure > TARGET_PRESSURE_MAX) {
            setFeedback("Too hard! lighter!");
        } else {
            setFeedback("Perfect pressure!");
        }

        // Drawing Logic
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Visualizing Pressure
            // Green = Good, Red = Bad, Blue = Too light
            let color = '#3b82f6'; // blue-500
            if (currentPressure > TARGET_PRESSURE_MAX) color = '#ef4444'; // red-500
            else if (currentPressure >= TARGET_PRESSURE_MIN) color = '#22c55e'; // green-500

            const radius = Math.max(2, currentPressure * 20);

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
    };

    const handlePointerUp = () => {
        setIsDrawing(false);
        setPressure(0);
        setFeedback("Lifted");
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
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
                <div className="flex flex-col items-center">
                    <h2 className="font-bold text-lg text-slate-800">Finger Strength Training</h2>
                    <p className={`text-sm font-medium ${pressure > TARGET_PRESSURE_MAX ? 'text-red-500' :
                            pressure >= TARGET_PRESSURE_MIN ? 'text-green-500' : 'text-blue-500'
                        }`}>
                        {feedback} ({pressure.toFixed(2)})
                    </p>
                </div>
                <button
                    onClick={clearCanvas}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Pressure Meter Bar */}
            <div className="h-4 w-full bg-slate-200 relative">
                {/* Zones */}
                <div
                    className="absolute h-full bg-green-200 opacity-50"
                    style={{ left: `${TARGET_PRESSURE_MIN * 100}%`, width: `${(TARGET_PRESSURE_MAX - TARGET_PRESSURE_MIN) * 100}%` }}
                />
                <div
                    className="absolute h-full bg-red-200 opacity-50"
                    style={{ left: `${TARGET_PRESSURE_MAX * 100}%`, right: 0 }}
                />

                {/* Indicator */}
                <div
                    className="absolute top-0 bottom-0 bg-slate-800 w-1 transition-all duration-75"
                    style={{ left: `${Math.min(pressure * 100, 100)}%` }}
                />
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative cursor-crosshair touch-none overflow-hidden m-4 bg-white rounded-2xl shadow-inner border border-slate-200">
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    style={{ touchAction: 'none' }}
                />

                {!isDrawing && pressure === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                        <div className="text-center">
                            <p className="text-4xl font-bold text-slate-400">Draw Here</p>
                            <p className="text-xl text-slate-400 mt-2">Control your pressure to stay in the green zone</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
