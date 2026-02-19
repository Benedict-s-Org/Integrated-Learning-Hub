
import React, { useEffect, useState } from 'react';
import { List, RefreshCw, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RhythmResultsProps {
    score: number;
    maxCombo: number;
    perfect: number;
    great: number;
    good: number;
    miss: number;
    gentlePercent: number; // 0-1
    isHighscore: boolean;
    onRetry: () => void;
    onBack: () => void;
    rank: 'S' | 'A' | 'B' | 'C' | 'F';
    coinsEarned: number;
}

export const RhythmResults: React.FC<RhythmResultsProps> = ({
    score, maxCombo, perfect, great, good, miss, gentlePercent,
    onRetry, onBack, rank, coinsEarned
}) => {
    const [showCoins, setShowCoins] = useState(false);

    useEffect(() => {
        // Trigger confetti for good ranks
        if (rank === 'S' || rank === 'A') {
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 2,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#fbbf24', '#3b82f6', '#f472b6']
                });
                confetti({
                    particleCount: 2,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#fbbf24', '#3b82f6', '#f472b6']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        }

        // Delay coin animation
        setTimeout(() => setShowCoins(true), 1000);

        // Award Coins Logic (Should be handled by parent or here?)
        // Let's assume parent handles DB save, but we show the animation
        // Actually, let's do the coin generic award here if passed? 
        // No, `coinsEarned` is passed in, meaning it's already calculated.

    }, [rank]);

    return (
        <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl relative">
                {/* Header Banner */}
                <div className={`h-32 bg-gradient-to-br ${rank === 'S' ? 'from-yellow-400 to-orange-500' :
                    rank === 'A' ? 'from-blue-400 to-indigo-500' :
                        rank === 'B' ? 'from-green-400 to-emerald-500' :
                            'from-slate-700 to-slate-800'} 
                                flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <h1 className="text-8xl font-black text-white drop-shadow-lg tracking-tighter italic transform -rotate-6 scale-110">
                        {rank}
                    </h1>
                </div>

                <div className="p-8">
                    {/* Score & Combo */}
                    <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-6">
                        <div>
                            <div className="text-sm text-slate-400 font-bold uppercase tracking-wider">Total Score</div>
                            <div className="text-4xl font-black text-slate-800 tabular-nums">{score.toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-slate-400 font-bold uppercase tracking-wider">Max Combo</div>
                            <div className="text-3xl font-bold text-blue-600 tabular-nums">{maxCombo}x</div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                            <span className="font-bold text-slate-600">Perfect</span>
                            <span className="font-bold text-yellow-600">{perfect}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                            <span className="font-bold text-slate-600">Great</span>
                            <span className="font-bold text-blue-600">{great}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                            <span className="font-bold text-slate-600">Good</span>
                            <span className="font-bold text-slate-600">{good}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                            <span className="font-bold text-slate-600">Miss</span>
                            <span className="font-bold text-red-500">{miss}</span>
                        </div>
                    </div>

                    {/* Pressure Report */}
                    <div className="bg-blue-50 p-4 rounded-2xl mb-8 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                            <Zap size={24} fill="currentColor" />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between mb-1">
                                <span className="font-bold text-blue-900">Gentle Touch</span>
                                <span className="font-bold text-blue-600">{Math.round(gentlePercent * 100)}%</span>
                            </div>
                            <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: `${gentlePercent * 100}%` }}
                                />
                            </div>
                            <div className="text-xs text-blue-400 mt-1">Target: 80% for bonus coins</div>
                        </div>
                    </div>

                    {/* Coin Reward */}
                    {coinsEarned > 0 && showCoins && (
                        <div className="mb-8 text-center animate-in zoom-in duration-300">
                            <div className="inline-flex items-center gap-3 bg-yellow-100 text-yellow-800 px-6 py-3 rounded-2xl shadow-sm border border-yellow-200">
                                <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shadow-inner text-yellow-900 font-bold border-2 border-yellow-300">
                                    $
                                </div>
                                <span className="font-bold text-lg">+{coinsEarned} Coins Earned!</span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            onClick={onBack}
                            className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
                        >
                            <List size={20} />
                            Menu
                        </button>
                        <button
                            onClick={onRetry}
                            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={20} />
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
