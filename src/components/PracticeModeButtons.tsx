import React from 'react';
import { Layers, Play, RotateCcw } from 'lucide-react';
import { PracticeMode, practiceModeLabel } from '../utils/practiceModes';

const MODE_CLASS: Record<PracticeMode, string> = {
  memorization: 'bg-blue-600 hover:bg-blue-700',
  shuffledGame: 'bg-purple-600 hover:bg-purple-700',
  dictation: 'bg-indigo-600 hover:bg-indigo-700',
};

const MODE_ICON: Record<PracticeMode, typeof Play> = {
  memorization: Play,
  shuffledGame: RotateCcw,
  dictation: Layers,
};

export const PracticeModeButtons: React.FC<{
  modes: PracticeMode[];
  onSelect: (mode: PracticeMode) => void;
}> = ({ modes, onSelect }) => (
  <div className="flex flex-wrap items-center gap-2">
    {modes.map((mode) => {
      const Icon = MODE_ICON[mode];
      return (
        <button
          key={mode}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(mode);
          }}
          className={`flex items-center space-x-1 px-3 py-2 text-white text-sm rounded-lg transition-colors ${MODE_CLASS[mode]}`}
          title={`Open ${practiceModeLabel(mode)} Mode`}
        >
          <Icon size={14} />
          <span>{practiceModeLabel(mode)}</span>
        </button>
      );
    })}
  </div>
);
