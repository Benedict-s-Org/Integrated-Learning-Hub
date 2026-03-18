import React, { useState, useEffect } from 'react';
import { Globe, Volume2, CheckCircle, AlertCircle, Smartphone, Info, Crown, ChevronDown, ChevronRight } from 'lucide-react';
import { groupVoicesByLanguage, createUtterance, ACCENT_OPTIONS, PREMIUM_VOICES, type VoiceInfo, type PremiumVoice } from '../../utils/voiceManager';
import { supabase } from '../../lib/supabase';
import VoiceHelpModal from './VoiceHelpModal';

// Moved ACCENT_OPTIONS to voiceManager.ts to resolve Vite HMR conflicts

interface AccentSelectorProps {
  currentAccent: string;
  currentVoiceURI?: string;
  onChange: (accent: string, voiceName: string, voiceLang: string, voiceURI: string) => void;
  className?: string;
  showVoiceSelection?: boolean;
}

interface RecommendedVoice {
  voice_name: string;
  voice_uri: string | null;
  is_ios_native: boolean;
}

const AccentSelector: React.FC<AccentSelectorProps> = ({
  currentAccent,
  currentVoiceURI,
  onChange,
  className = '',
  showVoiceSelection = true
}) => {
  const [selectedAccent, setSelectedAccent] = useState(currentAccent);
  const [voicesByLang, setVoicesByLang] = useState<Record<string, VoiceInfo[]>>({});
  const [selectedVoice, setSelectedVoice] = useState<VoiceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [recommendedVoices, setRecommendedVoices] = useState<Record<string, RecommendedVoice>>({});
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLegacyVoices, setShowLegacyVoices] = useState(false);

  const selectedOption = ACCENT_OPTIONS.find(opt => opt.code === selectedAccent) || ACCENT_OPTIONS[0];
  const availableVoices = voicesByLang[selectedAccent] || [];

  useEffect(() => {
    loadVoicesAndRecommendations();
  }, []);

  useEffect(() => {
    if (availableVoices.length > 0 && !selectedVoice) {
      selectInitialVoice();
    }
  }, [availableVoices, selectedAccent]);

  const loadVoicesAndRecommendations = async () => {
    try {
      setLoading(true);

      const [grouped, recommendationsResponse] = await Promise.all([
        groupVoicesByLanguage(),
        supabase
          .from('recommended_voices' as any)
          .select('accent_code, voice_name, voice_uri, is_ios_native')
          .order('priority', { ascending: false })
      ]);

      setVoicesByLang(grouped);

      if (recommendationsResponse.error) {
        // Log but don't break the UI if table is missing or query fails
        console.warn('[AccentSelector] Could not load recommended voices (this is expected if the table hasn\'t been created yet):', recommendationsResponse.error);
      } else if (recommendationsResponse.data) {
        const recMap: Record<string, RecommendedVoice> = {};
        recommendationsResponse.data.forEach((rec: any) => {
          if (!recMap[rec.accent_code]) {
            recMap[rec.accent_code] = {
              voice_name: rec.voice_name,
              voice_uri: rec.voice_uri,
              is_ios_native: rec.is_ios_native,
            };
          }
        });
        setRecommendedVoices(recMap);
      }
    } catch (error) {
      console.error('Error loading voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectInitialVoice = () => {
    const voices = voicesByLang[selectedAccent] || [];
    if (voices.length === 0) return;

    if (currentVoiceURI) {
      const matchingVoice = voices.find(v => v.uri === currentVoiceURI);
      if (matchingVoice) {
        setSelectedVoice(matchingVoice);
        return;
      }
    }

    const recommended = recommendedVoices[selectedAccent];
    if (recommended) {
      const recVoice = voices.find(v =>
        v.name.includes(recommended.voice_name)
      );
      if (recVoice) {
        setSelectedVoice(recVoice);
        return;
      }
    }

    const iosVoice = voices.find(v => v.isIOSNative);
    if (iosVoice) {
      setSelectedVoice(iosVoice);
      return;
    }

    setSelectedVoice(voices[0]);
  };

  const handleAccentChange = (newAccent: string) => {
    setSelectedAccent(newAccent);
    setSelectedVoice(null);

    const voices = voicesByLang[newAccent] || [];
    if (voices.length > 0) {
      const recommended = recommendedVoices[newAccent];
      if (recommended) {
        const recVoice = voices.find(v => v.name.includes(recommended.voice_name));
        if (recVoice) {
          handleVoiceSelect(recVoice);
          return;
        }
      }

      const iosVoice = voices.find(v => v.isIOSNative);
      if (iosVoice) {
        handleVoiceSelect(iosVoice);
      } else {
        handleVoiceSelect(voices[0]);
      }
    }
  };

  const handleVoiceSelect = (voiceInfo: VoiceInfo) => {
    setSelectedVoice(voiceInfo);
    onChange(selectedAccent, voiceInfo.name, voiceInfo.lang, voiceInfo.uri);
  };

  const handlePremiumVoiceSelect = (premiumVoice: PremiumVoice) => {
    setSelectedVoice(null); // Clear browser voice
    onChange(selectedAccent, premiumVoice.name, selectedAccent, premiumVoice.id);
  };

  const handleTestVoice = async (voiceInfo: VoiceInfo) => {
    if (testingVoice) {
      window.speechSynthesis.cancel();
    }

    setTestingVoice(voiceInfo.uri);

    const utterance = createUtterance('Hello, this is a test of this voice.', voiceInfo.voice);

    utterance.onend = () => {
      setTestingVoice(null);
    };

    utterance.onerror = () => {
      setTestingVoice(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const isRecommendedVoice = (voiceInfo: VoiceInfo): boolean => {
    const recommended = recommendedVoices[selectedAccent];
    return recommended ? voiceInfo.name.includes(recommended.voice_name) : false;
  };

  if (!showVoiceSelection) {
    return (
      <div className={`relative ${className}`}>
        <label htmlFor="accent-select" className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-1">
          <Globe size={16} />
          <span>Voice Accent</span>
        </label>
        <select
          id="accent-select"
          value={selectedAccent}
          onChange={(e) => handleAccentChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 cursor-pointer hover:border-gray-400 transition-colors"
        >
          {ACCENT_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.flag} {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Current: {selectedOption.flag} {selectedOption.label}
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="mb-4">
        <label htmlFor="accent-select" className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
          <Globe size={16} />
          <span>Select Accent</span>
        </label>
        <select
          id="accent-select"
          value={selectedAccent}
          onChange={(e) => handleAccentChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 cursor-pointer hover:border-gray-400 transition-colors"
        >
          {ACCENT_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>
              {option.flag} {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-600">
          Loading voices...
        </div>
      ) : availableVoices.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start space-x-3">
          <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800 font-medium">
              No voices available for this accent on this device.
            </p>
            <button 
              onClick={() => setShowHelpModal(true)}
              className="mt-2 text-xs text-blue-600 font-bold flex items-center hover:underline bg-white/50 px-2 py-1 rounded"
            >
              <Info size={12} className="mr-1" />
              How to download voices?
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Premium Google Voices Section */}
          <div className="mb-4">
            <label className="flex items-center space-x-2 text-sm font-semibold text-indigo-700 mb-3">
              <Crown size={16} className="text-amber-500" />
              <span>Premium Voices (Google Cloud)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(PREMIUM_VOICES[selectedAccent] || []).map((pv) => {
                const isSelected = currentVoiceURI === pv.id;
                return (
                  <button
                    key={pv.id}
                    onClick={() => handlePremiumVoiceSelect(pv)}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 shadow-sm'
                        : 'bg-white border-gray-100 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                        {pv.gender === 'MALE' ? '♂' : '♀'}
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-gray-800">{pv.name}</div>
                        <div className="text-[10px] text-indigo-500 font-medium uppercase tracking-wider">{pv.type}</div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle size={18} className="text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legacy Browser Voices Section */}
          <div className="mt-6">
            <button 
              onClick={() => setShowLegacyVoices(!showLegacyVoices)}
              className="flex items-center space-x-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors py-2"
            >
              {showLegacyVoices ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Show Offline/Browser Voices (Fallback)</span>
            </button>

            {showLegacyVoices && (
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gray-50/50">
                {availableVoices.map((voiceInfo) => {
                  const isSelected = currentVoiceURI === voiceInfo.uri;
                  const isTesting = testingVoice === voiceInfo.uri;

                  return (
                    <div
                      key={voiceInfo.uri}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 shadow-sm'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleVoiceSelect(voiceInfo)}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {isSelected && (
                          <CheckCircle size={20} className="text-blue-600 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {voiceInfo.name}
                            </span>
                            {voiceInfo.isIOSNative && (
                              <span title="iOS Native">
                                <Smartphone size={14} className="text-green-600 flex-shrink-0" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestVoice(voiceInfo);
                        }}
                        disabled={isTesting}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isTesting
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Volume2 size={12} />
                        <span>{isTesting ? 'Playing...' : 'Test'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Voice Download Help Modal */}
      <VoiceHelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />
    </div>
  );
};

export default AccentSelector;
