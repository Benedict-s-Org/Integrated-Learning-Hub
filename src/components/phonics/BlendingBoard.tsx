import { useState, useEffect } from 'react';
import { Volume2, RefreshCw, ChevronUp, ChevronDown, Shuffle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";

interface PhonicsSound {
    id: string;
    sound_code: string;
    display_name: string;
    audio_url: string;
    category: string;
}

export const BlendingBoard = () => {
    const [loading, setLoading] = useState(true);
    const [onsets, setOnsets] = useState<PhonicsSound[]>([]);
    const [nuclei, setNuclei] = useState<PhonicsSound[]>([]);
    const [codas, setCodas] = useState<PhonicsSound[]>([]);

    // Current selections (indices)
    const [indices, setIndices] = useState([0, 0, 0]); // [Onset, Nucleus, Coda]
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        fetchSounds();
    }, []);

    const fetchSounds = async () => {
        try {
            const { data, error } = await supabase
                .from('phonics_sounds')
                .select('*');

            if (error) throw error;

            if (data) {
                const allSounds = data as unknown as PhonicsSound[];

                // Categorize sounds
                const v = allSounds.filter(s => s.category === 'vowel');
                const c = allSounds.filter(s => s.category === 'consonant');
                const d = allSounds.filter(s => s.category === 'digraph');
                const b = allSounds.filter(s => s.category === 'blend');

                // Onset: Consonants + Blends + Digraphs
                const onsetStack = [...c, ...b, ...d].sort(() => Math.random() - 0.5);
                // Nucleus: Vowels only
                const nucleusStack = [...v].sort(() => Math.random() - 0.5);
                // Coda: Consonants + Digraphs (Blends usually not coda in simple CVC, but we can include)
                const codaStack = [...c, ...d].sort(() => Math.random() - 0.5);

                setOnsets(onsetStack);
                setNuclei(nucleusStack);
                setCodas(codaStack);
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching sounds:', error);
            setLoading(false);
        }
    };

    const playSound = async (sound: PhonicsSound) => {
        const audio = new Audio(sound.audio_url);
        await audio.play();
    };

    const playSequence = async () => {
        if (isPlaying) return;
        setIsPlaying(true);

        const sequence = [
            onsets[indices[0]],
            nuclei[indices[1]],
            codas[indices[2]]
        ];

        for (const sound of sequence) {
            if (sound) {
                await new Promise<void>((resolve) => {
                    const audio = new Audio(sound.audio_url);
                    audio.onended = () => resolve();
                    audio.play();
                });
                // Short pause between sounds
                await new Promise(r => setTimeout(r, 100));
            }
        }
        setIsPlaying(false);
    };

    const cycleCard = (stackIndex: number, direction: 'up' | 'down') => {
        setIndices(prev => {
            const newIndices = [...prev];
            const stacks = [onsets, nuclei, codas];
            const count = stacks[stackIndex].length;

            if (count === 0) return prev;

            if (direction === 'up') {
                newIndices[stackIndex] = (newIndices[stackIndex] + 1) % count;
            } else {
                newIndices[stackIndex] = (newIndices[stackIndex] - 1 + count) % count;
            }

            // Auto-play the new sound? Optional.
            const sound = stacks[stackIndex][newIndices[stackIndex]];
            if (sound) playSound(sound);

            return newIndices;
        });
    };

    const randomize = () => {
        if (onsets.length > 0 && nuclei.length > 0 && codas.length > 0) {
            setIndices([
                Math.floor(Math.random() * onsets.length),
                Math.floor(Math.random() * nuclei.length),
                Math.floor(Math.random() * codas.length)
            ]);
        }
    };

    if (loading) {
        return <div className="text-center py-20 text-amber-600 animate-pulse">Loading Blending Board...</div>;
    }

    const stacks = [
        { data: onsets, color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
        { data: nuclei, color: 'bg-rose-100 text-rose-800 border-rose-300' },
        { data: codas, color: 'bg-blue-100 text-blue-800 border-blue-300' }
    ];

    return (
        <div className="flex flex-col items-center gap-8 max-w-4xl mx-auto">
            <div className="flex justify-between w-full items-center">
                <h2 className="text-2xl font-bold text-amber-800">Blending Board</h2>
                <button
                    onClick={randomize}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-200 text-amber-800 rounded-lg hover:bg-amber-300 transition-colors"
                >
                    <Shuffle className="w-4 h-4" />
                    <span>Shuffle</span>
                </button>
            </div>

            <div className="flex gap-4 sm:gap-8 overflow-x-auto pb-4 w-full justify-center">
                {stacks.map((stack, stackIndex) => {
                    const currentIndex = indices[stackIndex];
                    const currentCard = stack.data[currentIndex];

                    if (!currentCard) return null;

                    return (
                        <div key={stackIndex} className="flex flex-col items-center gap-4">
                            <button
                                onClick={() => cycleCard(stackIndex, 'up')}
                                className="p-2 text-amber-400 hover:text-amber-600 transition-colors hover:bg-amber-50 rounded-full"
                            >
                                <ChevronUp className="w-8 h-8" />
                            </button>

                            <div
                                className={`
                  w-32 h-48 sm:w-48 sm:h-64 rounded-2xl shadow-xl border-4 
                  flex items-center justify-center relative cursor-pointer
                  transition-transform duration-300 hover:scale-[1.02] 
                  ${stack.color}
                `}
                                onClick={() => playSound(currentCard)}
                            >
                                <span className="text-6xl sm:text-8xl font-black">{currentCard.sound_code}</span>
                                <button className="absolute bottom-4 right-4 p-2 bg-white/50 rounded-full hover:bg-white/80 transition-colors">
                                    <Volume2 className="w-6 h-6 opacity-75" />
                                </button>
                            </div>

                            <button
                                onClick={() => cycleCard(stackIndex, 'down')}
                                className="p-2 text-amber-400 hover:text-amber-600 transition-colors hover:bg-amber-50 rounded-full"
                            >
                                <ChevronDown className="w-8 h-8" />
                            </button>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={playSequence}
                disabled={isPlaying}
                className={`
          flex items-center gap-3 px-10 py-4 rounded-full font-bold text-xl shadow-lg transition-all
          ${isPlaying
                        ? 'bg-amber-300 text-white scale-95 cursor-wait'
                        : 'bg-amber-500 text-white hover:bg-amber-600 hover:scale-105 active:scale-95'
                    }
        `}
            >
                {isPlaying ? (
                    <>
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span>Blending...</span>
                    </>
                ) : (
                    <>
                        <span className="text-2xl">✨</span>
                        <span>Blend It!</span>
                    </>
                )}
            </button>

            {/* Hint/Instruction */}
            <p className="text-amber-600/60 text-sm mt-4">
                Tip: Click any card to hear its individual sound
            </p>
        </div>
    );
};
