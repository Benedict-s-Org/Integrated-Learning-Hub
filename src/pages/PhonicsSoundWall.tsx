import { useState, useEffect, useMemo } from 'react';
import { Loader2, LayoutGrid, List, Lock } from 'lucide-react';
import { usePhonicsMappings } from '@/hooks/usePhonicsMappings';
import { SoundWallCard } from '@/components/phonics/SoundWallCard';
import { SoundWallDetailPanel } from '@/components/phonics/SoundWallDetailPanel';
import { SoundWallChartView } from '@/components/phonics/SoundWallChartView';
import type { PhonicsMapping, SoundWallCategory, SoundWallView } from '@/types/phonicsSoundWall';
import {
  SOUND_WALL_LEVELS,
  SOUND_WALL_CATEGORIES,
  CATEGORY_STYLES,
  VOWEL_GROUPS,
} from '@/types/phonicsSoundWall';

export const PhonicsSoundWall = () => {
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [activeCategory, setActiveCategory] = useState<SoundWallCategory>('vowel');
  const [activeView, setActiveView] = useState<SoundWallView>('practice');
  const [selectedMapping, setSelectedMapping] = useState<PhonicsMapping | null>(null);

  const { mappings, isLoading, error, playingId, fetchMappings, playAudio } = usePhonicsMappings();

  // Fetch when level or category changes (practice view)
  useEffect(() => {
    if (activeView === 'practice') {
      fetchMappings({ level: selectedLevel, category: activeCategory });
    }
  }, [selectedLevel, activeCategory, activeView, fetchMappings]);

  // Filter + organize data for practice view
  const organizedMappings = useMemo(() => {
    if (activeCategory === 'vowel') {
      // Sub-group by vowel_group (A, E, I, O, U rows)
      const groups: Record<string, PhonicsMapping[]> = {};
      for (const vg of VOWEL_GROUPS) {
        groups[vg] = [];
      }
      groups['other'] = [];

      for (const m of mappings) {
        const key = m.vowel_group || 'other';
        if (groups[key]) {
          groups[key].push(m);
        } else {
          groups['other'].push(m);
        }
      }
      return groups;
    }
    return { all: mappings };
  }, [mappings, activeCategory]);

  // Level unlock logic (placeholder: all unlocked for now since no progress data yet)
  const isLevelLocked = (_level: number): boolean => {
    // L1 always unlocked. L2+ would check 80% completion of previous level.
    // For now, all levels unlocked since we haven't implemented progress tracking.
    return false;
  };

  return (
    <div className="min-h-[50vh]">
      {/* ─── Level Tabs ─── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {SOUND_WALL_LEVELS.map((level) => {
          const isActive = selectedLevel === level.id;
          const locked = isLevelLocked(level.id);

          return (
            <button
              key={level.id}
              onClick={() => !locked && setSelectedLevel(level.id)}
              disabled={locked}
              className={`
                flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200
                flex items-center gap-1.5
                ${locked
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : isActive
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-slate-200'
                }
              `}
            >
              {locked && <Lock size={12} />}
              {level.label}
            </button>
          );
        })}
      </div>

      {/* ─── Group Buttons + View Switch ─── */}
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        {/* Category group buttons */}
        <div className="flex gap-1.5 flex-wrap">
          {SOUND_WALL_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.value;
            const catStyle = CATEGORY_STYLES[cat.value];

            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                `}
                style={{
                  border: `2px solid ${isActive ? catStyle.border : 'transparent'}`,
                  backgroundColor: isActive ? catStyle.bg : 'transparent',
                  color: isActive ? catStyle.border : '#64748b',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* View switch */}
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setActiveView('practice')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
              ${activeView === 'practice'
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-500'
              }
            `}
          >
            <LayoutGrid size={14} />
            Practice
          </button>
          <button
            onClick={() => setActiveView('chart')}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
              ${activeView === 'chart'
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-500'
              }
            `}
          >
            <List size={14} />
            Chart
          </button>
        </div>
      </div>

      {/* ─── Content Area ─── */}
      {activeView === 'chart' ? (
        <SoundWallChartView activeCategory={activeCategory} />
      ) : (
        <>
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-400">Loading sounds...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-center text-red-500 py-8">
              <p>{error}</p>
              <button
                onClick={() => fetchMappings({ level: selectedLevel, category: activeCategory })}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && mappings.length === 0 && (
            <div className="text-center text-slate-400 py-12">
              <p className="text-lg font-medium">No sounds for this level yet</p>
              <p className="text-sm mt-1">
                Sounds will appear here once they are assigned to L{selectedLevel} {activeCategory}.
              </p>
            </div>
          )}

          {/* Practice Grid */}
          {!isLoading && !error && mappings.length > 0 && (
            <div className="space-y-6">
              {Object.entries(organizedMappings).map(([groupKey, items]) => {
                if (items.length === 0) return null;

                // Show vowel group label for vowels
                const showGroupLabel = activeCategory === 'vowel' && groupKey !== 'all' && groupKey !== 'other';

                return (
                  <div key={groupKey}>
                    {showGroupLabel && (
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                        {groupKey.toUpperCase()} sounds
                      </h3>
                    )}
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3">
                      {items.map((mapping) => (
                        <SoundWallCard
                          key={mapping.id}
                          mapping={mapping}
                          isPlaying={playingId === mapping.id}
                          isSelected={selectedMapping?.id === mapping.id}
                          onPlay={() => playAudio(mapping)}
                          onClick={() => setSelectedMapping(mapping)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── Detail Panel ─── */}
      {selectedMapping && (
        <SoundWallDetailPanel
          mapping={selectedMapping}
          onClose={() => setSelectedMapping(null)}
          onPlayAudio={() => playAudio(selectedMapping)}
          isPlaying={playingId === selectedMapping.id}
        />
      )}
    </div>
  );
};
