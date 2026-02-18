import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PhonicsMapping, SoundWallCategory } from '@/types/phonicsSoundWall';

export function usePhonicsMappings() {
    const [mappings, setMappings] = useState<PhonicsMapping[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);

    const fetchMappings = useCallback(async (options?: {
        level?: number;
        category?: SoundWallCategory;
    }) => {
        setIsLoading(true);
        setError(null);

        try {
            let query = supabase
                .from('phonics_mappings')
                .select('*')
                .order('sort_order', { ascending: true });

            if (options?.level) {
                query = query.eq('level', options.level);
            }
            if (options?.category) {
                query = query.eq('category', options.category);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;
            setMappings((data as unknown as PhonicsMapping[]) || []);
        } catch (err) {
            console.error('Failed to fetch phonics mappings:', err);
            setError('Unable to load phonics data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchAllMappings = useCallback(async (category?: SoundWallCategory) => {
        setIsLoading(true);
        setError(null);

        try {
            let query = supabase
                .from('phonics_mappings')
                .select('*')
                .order('phoneme')
                .order('level')
                .order('sort_order', { ascending: true });

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;
            setMappings((data as unknown as PhonicsMapping[]) || []);
        } catch (err) {
            console.error('Failed to fetch all phonics mappings:', err);
            setError('Unable to load phonics data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const playAudio = useCallback((mapping: PhonicsMapping) => {
        // Stop current audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        // Toggle off if same
        if (playingId === mapping.id) {
            setPlayingId(null);
            return;
        }

        if (!mapping.audio_url) {
            // No audio available — just do nothing silently
            return;
        }

        const audio = new Audio(mapping.audio_url);
        audioRef.current = audio;
        setPlayingId(mapping.id);

        audio.play().catch(() => setPlayingId(null));
        audio.onended = () => {
            setPlayingId(null);
            audioRef.current = null;
        };
        audio.onerror = () => {
            setPlayingId(null);
            audioRef.current = null;
        };
    }, [playingId]);

    return {
        mappings,
        isLoading,
        error,
        playingId,
        fetchMappings,
        fetchAllMappings,
        playAudio,
    };
}
