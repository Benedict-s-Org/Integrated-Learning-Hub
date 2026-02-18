import React, { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import type { PhonicsMapping, SoundWallCategory } from '@/types/phonicsSoundWall';
import { CATEGORY_STYLES, SOUND_WALL_LEVELS } from '@/types/phonicsSoundWall';
import { usePhonicsMappings } from '@/hooks/usePhonicsMappings';

interface SoundWallChartViewProps {
    activeCategory: SoundWallCategory;
}

export const SoundWallChartView: React.FC<SoundWallChartViewProps> = ({
    activeCategory,
}) => {
    const { mappings, isLoading, error, fetchAllMappings } = usePhonicsMappings();

    useEffect(() => {
        fetchAllMappings(activeCategory);
    }, [activeCategory, fetchAllMappings]);

    // Group by phoneme
    const groupedByPhoneme = useMemo(() => {
        const map = new Map<string, PhonicsMapping[]>();
        for (const m of mappings) {
            const key = m.plain_label || m.phoneme;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(m);
        }
        // Sort entries: keep them in the order they first appear (stable by sort_order)
        return Array.from(map.entries());
    }, [mappings]);

    const categoryStyle = CATEGORY_STYLES[activeCategory];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-400">Loading chart...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12 text-red-500">
                <p>{error}</p>
            </div>
        );
    }

    if (groupedByPhoneme.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                No data available for this category.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">
                All Levels · Sound → Spellings
            </p>

            {groupedByPhoneme.map(([phonemeLabel, items]) => (
                <div
                    key={phonemeLabel}
                    className="bg-white rounded-xl border border-slate-100 overflow-hidden"
                >
                    {/* Phoneme header */}
                    <div
                        className="px-4 py-2.5 font-bold text-sm flex items-center gap-2"
                        style={{ backgroundColor: categoryStyle.bg, borderBottom: `1px solid ${categoryStyle.border}30` }}
                    >
                        <span className="text-slate-700">{phonemeLabel}</span>
                    </div>

                    {/* Grapheme list */}
                    <div className="px-4 py-3 flex flex-wrap gap-2">
                        {items.map((m) => {
                            const levelInfo = SOUND_WALL_LEVELS.find(l => l.id === m.level);
                            return (
                                <span
                                    key={m.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                                    style={{
                                        border: `1.5px solid ${categoryStyle.border}`,
                                        backgroundColor: categoryStyle.bg,
                                    }}
                                >
                                    <span className="font-bold text-slate-800">{m.grapheme}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                                        {levelInfo?.shortLabel || `L${m.level}`}
                                    </span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};
