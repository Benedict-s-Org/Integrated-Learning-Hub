import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play } from 'lucide-react';

interface CursiveExercise {
    id: string;
    title: string;
    image_url: string;
    created_at: string;
}

interface CursiveExerciseListProps {
    onSelect: (exerciseId: string) => void;
    onBack: () => void;
}

export const CursiveExerciseList: React.FC<CursiveExerciseListProps> = ({ onSelect, onBack }) => {
    const [exercises, setExercises] = useState<CursiveExercise[]>([]);

    useEffect(() => {
        const fetchExercises = async () => {
            const { data } = await supabase
                .from('cursive_exercises')
                .select('id, title, image_url, created_at')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (data) setExercises(data);
        };
        fetchExercises();
    }, []);

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Cursive Practice</h1>
                    <p className="text-slate-500">Choose an exercise to start practicing</p>
                </div>
                <button
                    onClick={onBack}
                    className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                >
                    Back to Zone
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exercises.map((ex) => (
                    <button
                        key={ex.id}
                        onClick={() => onSelect(ex.id)}
                        className="group bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-xl hover:border-blue-100 transition-all text-left"
                    >
                        <div className="aspect-video bg-slate-50 rounded-xl mb-4 overflow-hidden relative">
                            <img
                                src={ex.image_url}
                                alt={ex.title}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300 delay-100">
                                    <Play size={24} fill="currentColor" className="ml-1" />
                                </div>
                            </div>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                            {ex.title}
                        </h3>
                    </button>
                ))}
            </div>
        </div>
    );
};
