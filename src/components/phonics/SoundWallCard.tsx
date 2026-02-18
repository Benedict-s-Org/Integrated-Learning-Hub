import React from 'react';
import { Volume2 } from 'lucide-react';
import type { PhonicsMapping } from '@/types/phonicsSoundWall';
import { CATEGORY_STYLES } from '@/types/phonicsSoundWall';

interface SoundWallCardProps {
    mapping: PhonicsMapping;
    isPlaying: boolean;
    isSelected: boolean;
    onPlay: () => void;
    onClick: () => void;
}

export const SoundWallCard: React.FC<SoundWallCardProps> = ({
    mapping,
    isPlaying,
    isSelected,
    onPlay,
    onClick,
}) => {
    const style = CATEGORY_STYLES[mapping.category];
    const displayLabel = mapping.plain_label || mapping.phoneme;

    const handleClick = () => {
        onPlay();
        onClick();
    };

    return (
        <button
            onClick={handleClick}
            aria-label={`${mapping.grapheme} says ${displayLabel}`}
            className={`
        relative flex flex-col items-center justify-center
        w-full aspect-square rounded-xl
        transition-all duration-200 select-none
        hover:shadow-md active:scale-95
        focus:outline-none focus-visible:ring-2
      `}
            style={{
                border: `2px solid ${style.border}`,
                backgroundColor: isSelected ? style.bgHover : style.bg,
                boxShadow: isSelected ? `0 0 0 3px ${style.ring}40` : undefined,
                // focus-visible ring
                // @ts-ignore
                '--tw-ring-color': style.ring,
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = style.bgHover;
            }}
            onMouseLeave={(e) => {
                if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = style.bg;
                }
            }}
        >
            {/* Grapheme (big) */}
            <span className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">
                {mapping.grapheme}
            </span>

            {/* Phoneme (small) */}
            <span className="text-xs sm:text-sm text-slate-500 leading-tight mt-0.5">
                {displayLabel}
            </span>

            {/* Playing indicator */}
            {isPlaying && (
                <Volume2
                    size={12}
                    className="absolute top-1 right-1 text-slate-400 animate-bounce"
                />
            )}
        </button>
    );
};
