import React from 'react';
import { X, Volume2 } from 'lucide-react';
import type { PhonicsMapping } from '@/types/phonicsSoundWall';
import { CATEGORY_STYLES } from '@/types/phonicsSoundWall';

interface SoundWallDetailPanelProps {
    mapping: PhonicsMapping;
    onClose: () => void;
    onPlayAudio: () => void;
    isPlaying: boolean;
}

export const SoundWallDetailPanel: React.FC<SoundWallDetailPanelProps> = ({
    mapping,
    onClose,
    onPlayAudio,
    isPlaying,
}) => {
    const style = CATEGORY_STYLES[mapping.category];
    const displayLabel = mapping.plain_label || mapping.phoneme;

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                style={{ borderTop: `4px solid ${style.border}` }}
            >
                {/* Header */}
                <div className="p-5 flex items-start justify-between">
                    <div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-4xl font-bold text-slate-800">{mapping.grapheme}</span>
                            <span className="text-lg text-slate-500">{displayLabel}</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: style.bg, color: style.border, border: `1px solid ${style.border}` }}
                            >
                                {mapping.category}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                                L{mapping.level}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Audio Button */}
                {mapping.audio_url && (
                    <div className="px-5 pb-3">
                        <button
                            onClick={onPlayAudio}
                            className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${isPlaying
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }
              `}
                        >
                            <Volume2 size={16} className={isPlaying ? 'animate-bounce' : ''} />
                            {isPlaying ? 'Playing...' : 'Play Sound'}
                        </button>
                    </div>
                )}

                {/* Examples */}
                <div className="px-5 pb-5 space-y-3">
                    {mapping.examples_real && mapping.examples_real.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Example Words
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {mapping.examples_real.map((word, i) => (
                                    <span
                                        key={i}
                                        className="px-2.5 py-1 rounded-lg text-sm font-medium text-slate-700"
                                        style={{ backgroundColor: style.bg }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {mapping.examples_nonsense && mapping.examples_nonsense.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Nonsense Words
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                                {mapping.examples_nonsense.map((word, i) => (
                                    <span
                                        key={i}
                                        className="px-2.5 py-1 rounded-lg text-sm font-medium text-slate-500 bg-slate-50 italic"
                                    >
                                        {word}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
