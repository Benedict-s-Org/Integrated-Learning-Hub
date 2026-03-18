import { X, Smartphone, Info, Apple, Laptop, Settings } from 'lucide-react';

interface VoiceHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VoiceHelpModal: React.FC<VoiceHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const getPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('ipad') || ua.includes('iphone')) return 'ios';
    if (ua.includes('macintosh')) return 'macos';
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('android')) return 'android';
    return 'other';
  };

  const platform = getPlatform();

  const sections = [
    {
      id: 'macos',
      name: 'macOS',
      icon: <Apple size={20} />,
      active: platform === 'macos',
      steps: [
        'Open System Settings ( menu)',
        'Go to Accessibility > Spoken Content',
        'Click the "i" or "Manage Voices..." next to System Voice',
        'Search for "Samantha" or "Karen" and click the download icon',
        'Restart your browser after download finishes'
      ]
    },
    {
      id: 'ios',
      name: 'iPhone / iPad',
      icon: <Smartphone size={20} />,
      active: platform === 'ios',
      steps: [
        'Open Settings app',
        'Go to Accessibility > Spoken Content > Voices',
        'Select "English" and look for "Samantha" or "Karen"',
        'Tap the download icon next to the voice name',
        'Refresh this app once the download is complete'
      ]
    },
    {
      id: 'windows',
      name: 'Windows',
      icon: <Laptop size={20} />,
      active: platform === 'windows',
      steps: [
        'Open Settings (Win + I)',
        'Go to Time & Language > Speech',
        'Under "Manage voices", click "Add voices"',
        'Search for "English" and install the desired package',
        'Ensure the voice is installed and restart browser'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Settings size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Voice Setup Guide</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/50 transition-colors text-gray-500 hover:text-gray-800"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start space-x-3">
            <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 leading-relaxed">
              High-quality voices like <span className="font-semibold">Samantha</span> or <span className="font-semibold">Karen</span> provide the best learning experience but may need to be downloaded to your device settings first.
            </p>
          </div>

          <div className="space-y-6">
            {sections.map((section) => (
              <div 
                key={section.id}
                className={`transition-all duration-300 ${section.active ? 'opacity-100' : 'opacity-60 grayscale-[0.5]'}`}
              >
                <div className="flex items-center space-x-2 mb-3">
                  <span className={`p-1.5 rounded-md ${section.active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                    {section.icon}
                  </span>
                  <h3 className="font-bold text-gray-800 flex items-center">
                    {section.name}
                    {section.active && (
                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase tracking-wider rounded-full font-bold">
                        Detected
                      </span>
                    )}
                  </h3>
                </div>
                <ul className="space-y-3 ml-1">
                  {section.steps.map((step, idx) => (
                    <li key={idx} className="flex items-start space-x-3 group">
                      <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${section.active ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {idx + 1}
                      </div>
                      <span className="text-sm text-gray-600 leading-tight group-hover:text-gray-900 transition-colors">
                        {step}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceHelpModal;
