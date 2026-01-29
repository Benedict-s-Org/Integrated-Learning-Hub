import React, { useState } from 'react';
import { Upload, FileUp, FileJson, BookOpen, Sheet } from 'lucide-react';

interface ImportSourceSelectorProps {
  onSourceSelect: (source: 'manual' | 'csv' | 'notion' | 'anki' | 'google') => void;
}

export function ImportSourceSelector({ onSourceSelect }: ImportSourceSelectorProps) {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  const sources = [
    {
      id: 'manual',
      label: 'Create Manually',
      icon: Upload,
      description: 'Add questions one by one',
      color: 'blue',
    },
    {
      id: 'csv',
      label: 'Import CSV',
      icon: Sheet,
      description: 'Upload a CSV file with your questions',
      color: 'green',
    },
    {
      id: 'notion',
      label: 'Import from Notion',
      icon: BookOpen,
      description: 'Export your Notion database as JSON',
      color: 'gray',
    },
    {
      id: 'anki',
      label: 'Import from Anki',
      icon: FileJson,
      description: 'Import your Anki deck JSON',
      color: 'purple',
    },
    {
      id: 'google',
      label: 'Google Sheets',
      icon: Sheet,
      description: 'Import from Google Sheets CSV',
      color: 'orange',
    },
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Question Set</h2>
      <p className="text-gray-600 mb-8">Choose how you'd like to add your questions</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {sources.map((source) => {
          const Icon = source.icon;
          const colorClasses = {
            blue: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
            green: 'border-green-200 bg-green-50 hover:bg-green-100',
            gray: 'border-gray-200 bg-gray-50 hover:bg-gray-100',
            purple: 'border-purple-200 bg-purple-50 hover:bg-purple-100',
            orange: 'border-orange-200 bg-orange-50 hover:bg-orange-100',
          };

          return (
            <button
              key={source.id}
              onClick={() => onSourceSelect(source.id as any)}
              onMouseEnter={() => setHoveredSource(source.id)}
              onMouseLeave={() => setHoveredSource(null)}
              className={`p-6 border-2 rounded-lg transition-all duration-200 text-center ${
                hoveredSource === source.id
                  ? `${colorClasses[source.color as keyof typeof colorClasses]} shadow-lg transform scale-105`
                  : `border-gray-200 bg-white hover:${colorClasses[source.color as keyof typeof colorClasses]}`
              }`}
            >
              <Icon className="w-8 h-8 mx-auto mb-3 text-gray-700" />
              <h3 className="font-semibold text-gray-900 mb-1">{source.label}</h3>
              <p className="text-xs text-gray-600">{source.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">CSV Format Guide</h3>
        <p className="text-sm text-gray-700 mb-3">
          Your CSV should have these columns (in order):
        </p>
        <ul className="text-sm text-gray-700 space-y-1 font-mono bg-white p-3 rounded border border-blue-200">
          <li>1. Question text</li>
          <li>2. Choice A</li>
          <li>3. Choice B</li>
          <li>4. Choice C</li>
          <li>5. Choice D</li>
          <li>6. Correct answer index (0-3)</li>
          <li>7. Explanation (optional)</li>
          <li>8. Difficulty (easy/medium/hard, optional)</li>
        </ul>
      </div>
    </div>
  );
}