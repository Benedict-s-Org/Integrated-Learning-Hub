
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play, Trophy, Zap, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface CursiveExercise {
    id: string;
    title: string;
    image_url: string;
    created_at: string;
    rhythm_config?: {
        difficulty?: 'easy' | 'normal' | 'hard';
    };
}

interface ExerciseStats {
    rank: string | null;
    score: number;
    isGentleWriter: boolean;
    played: boolean;
}

interface CursiveExerciseListProps {
    onSelect: (exerciseId: string) => void;
    onBack: () => void;
}

export const CursiveExerciseList: React.FC<CursiveExerciseListProps> = ({ onSelect, onBack }) => {
    const { user } = useAuth();
    const [exercises, setExercises] = useState<CursiveExercise[]>([]);
    const [stats, setStats] = useState<Record<string, ExerciseStats>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            // 1. Fetch Exercises
            const result = await supabase
                .from('cursive_exercises' as any)
                .select('id, title, image_url, created_at, rhythm_config')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            const exData = result.data as any[];

            if (exData) {
                setExercises(exData as any[]);

                // 2. Fetch User Attempts if logged in
                if (user) {
                    const attemptsResult = await supabase
                        .from('cursive_attempts' as any)
                        .select('exercise_id, score, rhythm_score')
                        .eq('user_id', user.id);

                    const attempts = attemptsResult.data as any[];

                    if (attempts) {
                        const newStats: Record<string, ExerciseStats> = {};

                        attempts.forEach(att => {
                            const exId = att.exercise_id;
                            const rScore = att.rhythm_score as any || {};
                            const currentBest = newStats[exId] || { score: -1 };

                            // Keep best score
                            if (att.score > currentBest.score) {
                                newStats[exId] = {
                                    played: true,
                                    score: att.score,
                                    rank: rScore.rank || 'F',
                                    isGentleWriter: (rScore.gentlePercent || 0) >= 0.8
                                };
                            }
                        });
                        setStats(newStats);
                    }
                }
            }
            setLoading(false);
        };
        fetchData();
    }, [user]);

    const getDifficultyColor = (diff?: string) => {
        switch (diff) {
            case 'hard': return 'bg-red-100 text-red-600 border-red-200';
            case 'normal': return 'bg-blue-100 text-blue-600 border-blue-200';
            default: return 'bg-green-100 text-green-600 border-green-200';
        }
    };

    const getRankBadge = (rank: string) => {
        const colors: Record<string, string> = {
            'S': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'A': 'bg-blue-100 text-blue-700 border-blue-200',
            'B': 'bg-green-100 text-green-700 border-green-200',
            'C': 'bg-orange-100 text-orange-700 border-orange-200',
            'F': 'bg-slate-100 text-slate-500 border-slate-200'
        };
        return colors[rank] || colors['F'];
    };

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Cursive Practice</h1>
                    <p className="text-slate-500">Master your handwriting with rhythm!</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                >
                    Back to Zone
                </button>
            </header>

            {loading ? (
                <div className="text-center py-12 text-slate-400">Loading exercises...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exercises.map((ex) => {
                        const stat = stats[ex.id];
                        const difficulty = ex.rhythm_config?.difficulty || 'easy';

                        return (
                            <button
                                key={ex.id}
                                onClick={() => onSelect(ex.id)}
                                className="group bg-white rounded-3xl p-4 shadow-sm border border-slate-100 hover:shadow-xl hover:border-blue-100 transition-all text-left relative overflow-hidden"
                            >
                                <div className="aspect-video bg-slate-50 rounded-2xl mb-4 overflow-hidden relative">
                                    <img
                                        src={ex.image_url}
                                        alt={ex.title}
                                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                                    />

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                                            <Play size={32} fill="currentColor" className="ml-1" />
                                        </div>
                                    </div>

                                    {/* Difficulty Badge */}
                                    <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${getDifficultyColor(difficulty)}`}>
                                        {difficulty}
                                    </div>
                                </div>

                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                                        {ex.title}
                                    </h3>
                                    {stat?.played && (
                                        <div className={`px-2 py-1 rounded-lg text-xs font-black border ${getRankBadge(stat.rank || 'F')}`}>
                                            RANK {stat.rank}
                                        </div>
                                    )}
                                </div>

                                {stat?.played ? (
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1.5 text-sm text-yellow-600 font-bold bg-yellow-50 px-2.5 py-1 rounded-lg">
                                            <Trophy size={14} />
                                            <span>{stat.score.toLocaleString()}</span>
                                        </div>
                                        {stat.isGentleWriter && (
                                            <div className="flex items-center gap-1.5 text-sm text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-lg" title="Gentle Writer Bonus">
                                                <Zap size={14} fill="currentColor" />
                                                <span>Gentle</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
                                        <Clock size={14} />
                                        <span>Not played yet</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
