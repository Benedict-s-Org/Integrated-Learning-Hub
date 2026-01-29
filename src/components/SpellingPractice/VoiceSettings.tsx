import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import AccentSelector from '../AccentSelector/AccentSelector';

interface VoiceSettingsProps {
  currentAccent: string;
  currentVoiceURI?: string;
  onVoiceChange: (accent: string, voiceName: string, voiceLang: string, voiceURI: string) => void;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({
  currentAccent,
  currentVoiceURI,
  onVoiceChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-6 border-2 border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <Settings size={20} className="text-gray-600" />
          <span className="font-medium text-gray-800">Voice Settings</span>
        </div>
        {isExpanded ? (
          <ChevronUp size={20} className="text-gray-600" />
        ) : (
          <ChevronDown size={20} className="text-gray-600" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 bg-white border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-4">
            Change the voice anytime during practice. Your progress will be saved.
          </p>
          <AccentSelector
            currentAccent={currentAccent}
            currentVoiceURI={currentVoiceURI}
            onChange={onVoiceChange}
            showVoiceSelection={true}
          />
        </div>
      )}
    </div>
  );
};

export default VoiceSettings;
