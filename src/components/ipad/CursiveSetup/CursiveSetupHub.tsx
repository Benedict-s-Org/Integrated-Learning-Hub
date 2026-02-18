import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { ExerciseRecorder } from './ExerciseRecorder';

interface CursiveExercise {
    id: string;
    title: string;
    image_url: string;
    is_published: boolean;
    created_at: string;
}

interface CursiveSetupHubProps {
    onBack?: () => void;
}

export const CursiveSetupHub: React.FC<CursiveSetupHubProps> = ({ onBack }) => {
    const [exercises, setExercises] = useState<CursiveExercise[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchExercises();
    }, []);

    const fetchExercises = async () => {
        const { data } = await supabase
            .from('cursive_exercises')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setExercises(data);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this exercise?')) return;

        const { error } = await supabase
            .from('cursive_exercises')
            .delete()
            .eq('id', id);

        if (!error) fetchExercises();
    };

    const handleSaveComplete = () => {
        setIsCreating(false);
        setEditingId(null);
        fetchExercises();
    };

    if (isCreating || editingId) {
        return (
            <ExerciseRecorder
                exerciseId={editingId}
                onBack={() => {
                    setIsCreating(false);
                    setEditingId(null);
                }}
                onSave={handleSaveComplete}
            />
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Cursive Practice Setup</h1>
                        <p className="text-slate-500">Manage cursive writing exercises</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium"
                >
                    <Plus size={20} />
                    Create New Exercise
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exercises.map((ex) => (
                    <div key={ex.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <div className="aspect-video bg-slate-50 rounded-xl mb-4 overflow-hidden relative group">
                            <img src={ex.image_url} alt={ex.title} className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setEditingId(ex.id)}
                                    className="p-2 bg-white rounded-full text-slate-800 hover:scale-110 transition-transform"
                                >
                                    <Edit size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(ex.id)}
                                    className="p-2 bg-white rounded-full text-red-600 hover:scale-110 transition-transform"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-1">{ex.title}</h3>
                        <div className="flex justify-between items-center text-sm text-slate-400">
                            <span>{new Date(ex.created_at).toLocaleDateString()}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${ex.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                {ex.is_published ? 'Published' : 'Draft'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
