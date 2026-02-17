import React, { useState } from 'react';
import { PenLine, FileUp, BookOpen } from 'lucide-react';

interface ImportSourceSelectorProps {
  onSourceSelect: (source: 'manual' | 'file' | 'notion') => void;
}

export function ImportSourceSelector({ onSourceSelect }: ImportSourceSelectorProps) {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  const sources = [
    {
      id: 'manual',
      label: 'Create Manually',
      icon: PenLine,
      description: 'Add questions one by one with full control over each question',
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      id: 'file',
      label: 'Import from File',
      icon: FileUp,
      description: 'Upload a CSV or Excel (.xlsx) file with your questions',
      color: 'emerald',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      id: 'notion',
      label: 'Import from Notion',
      icon: BookOpen,
      description: 'Connect to a Notion database or upload a Notion CSV export',
      color: 'violet',
      gradient: 'from-violet-500 to-violet-600',
    },
  ];

  const colorMap: Record<string, {
    border: string;
    bg: string;
    hoverBg: string;
    iconBg: string;
    iconText: string;
    ring: string;
  }> = {
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50/50',
      hoverBg: 'hover:bg-blue-50',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      iconText: 'text-white',
      ring: 'ring-blue-200',
    },
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/50',
      hoverBg: 'hover:bg-emerald-50',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      iconText: 'text-white',
      ring: 'ring-emerald-200',
    },
    violet: {
      border: 'border-violet-200',
      bg: 'bg-violet-50/50',
      hoverBg: 'hover:bg-violet-50',
      iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
      iconText: 'text-white',
      ring: 'ring-violet-200',
    },
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Create New Question Set</h2>
        <p className="text-gray-500 text-lg">Choose how you'd like to add your questions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {sources.map((source) => {
          const Icon = source.icon;
          const colors = colorMap[source.color];
          const isHovered = hoveredSource === source.id;

          return (
            <button
              key={source.id}
              onClick={() => onSourceSelect(source.id as any)}
              onMouseEnter={() => setHoveredSource(source.id)}
              onMouseLeave={() => setHoveredSource(null)}
              className={`
                relative p-6 border-2 rounded-2xl transition-all duration-300 text-left
                ${isHovered ? `${colors.border} ${colors.bg} shadow-xl ring-2 ${colors.ring} -translate-y-1` : `border-gray-200 bg-white hover:shadow-md`}
              `}
            >
              <div className={`w-14 h-14 rounded-xl ${colors.iconBg} flex items-center justify-center mb-5 shadow-lg transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`}>
                <Icon className={`w-7 h-7 ${colors.iconText}`} />
              </div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{source.label}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{source.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-10 bg-gray-50 border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">📋 CSV / Excel Format Guide</h3>
        <p className="text-sm text-gray-600 mb-3">
          Your file should have these columns (in order):
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {[
            { num: '1', label: 'Question text', required: true },
            { num: '2', label: 'Choice A', required: true },
            { num: '3', label: 'Choice B', required: true },
            { num: '4', label: 'Choice C', required: true },
            { num: '5', label: 'Choice D', required: true },
            { num: '6', label: 'Correct index (0-3)', required: true },
            { num: '7', label: 'Explanation', required: false },
            { num: '8', label: 'Difficulty', required: false },
          ].map((col) => (
            <div
              key={col.num}
              className={`px-3 py-2 rounded-lg ${col.required ? 'bg-blue-50 text-blue-800 border border-blue-100' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}
            >
              <span className="font-mono font-bold mr-1">{col.num}.</span>
              {col.label}
              {!col.required && <span className="text-xs ml-1 opacity-60">(optional)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}