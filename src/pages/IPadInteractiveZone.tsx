import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FingerTraining } from '../components/ipad/FingerTraining';
import { CursiveExerciseList } from '../components/ipad/CursivePractice/CursiveExerciseList';
import { CursivePlayer } from '../components/ipad/CursivePractice/CursivePlayer';
import { CursiveSetupHub } from '../components/ipad/CursiveSetup/CursiveSetupHub';
import { Hand, PenTool, ArrowRight, Tablet, Settings } from 'lucide-react';

type ZoneMode = 'home' | 'finger' | 'cursive-list' | 'cursive-play' | 'admin-setup';

export const IPadInteractiveZone: React.FC = () => {
    const { isAdmin } = useAuth();
    const [mode, setMode] = useState<ZoneMode>('home');
    const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

    if (mode === 'finger') {
        return <FingerTraining onBack={() => setMode('home')} />;
    }

    if (mode === 'cursive-list') {
        return (
            <CursiveExerciseList
                onSelect={(id) => {
                    setSelectedExerciseId(id);
                    setMode('cursive-play');
                }}
                onBack={() => setMode('home')}
            />
        );
    }

    if (mode === 'cursive-play' && selectedExerciseId) {
        return (
            <CursivePlayer
                exerciseId={selectedExerciseId}
                onBack={() => setMode('cursive-list')}
            />
        );
    }

    if (mode === 'admin-setup') {
        return <CursiveSetupHub />; // Includes its own back navigation usually, or we wrap it
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans relative">
            {/* Admin Entry Point */}
            {isAdmin && (
                <button
                    onClick={() => setMode('admin-setup')}
                    className="absolute top-6 right-6 p-3 bg-slate-800 text-white rounded-full hover:bg-slate-700 hover:scale-110 transition-all shadow-lg z-10"
                    title="Admin Setup"
                >
                    <Settings size={24} />
                </button>
            )}

            <header className="mb-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-4 shadow-sm">
                    <Tablet size={32} />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
                    iPad Interactive Zone
                </h1>
                <p className="text-slate-500 max-w-lg mx-auto">
                    Master your digital handwriting skills with pressure sensitivity training and cursive practice.
                </p>
            </header>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {/* Finger Strength Card */}
                <button
                    onClick={() => setMode('finger')}
                    className="group relative bg-white rounded-3xl p-8 text-left shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-blue-100 overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                        <Hand size={120} />
                    </div>

                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <Hand size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                            Finger Strength
                        </h3>
                        <p className="text-slate-500 mb-6 leading-relaxed">
                            Train your pressure control. Learn to write with a light touch to protect your wrist and screen.
                        </p>
                        <div className="flex items-center text-blue-600 font-bold text-sm tracking-wide uppercase">
                            Start Training <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </button>

                {/* Cursive Writing Card */}
                <button
                    onClick={() => setMode('cursive-list')}
                    className="group relative bg-white rounded-3xl p-8 text-left shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-purple-100 overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                        <PenTool size={120} />
                    </div>

                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                            <PenTool size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2 group-hover:text-purple-600 transition-colors">
                            Cursive Practice
                        </h3>
                        <p className="text-slate-500 mb-6 leading-relaxed">
                            Trace classic cursive letters. Perfect your loops and connections with guided templates.
                        </p>
                        <div className="flex items-center text-purple-600 font-bold text-sm tracking-wide uppercase">
                            Start Writing <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
};
