import React from 'react';
import { X } from 'lucide-react';
import { ReadingChallenge } from '../reading/ReadingChallenge';
import { useAuth } from '@/context/AuthContext';

interface ReadingPracticePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string;
}

export const ReadingPracticePreviewModal: React.FC<ReadingPracticePreviewModalProps> = ({
  isOpen,
  onClose,
  practiceId
}) => {
  const { user } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in duration-300">
        {/* Close Button at top right */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-[110] p-2 bg-white/80 hover:bg-slate-100 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 transition-all shadow-sm"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Challenge Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {user && (
            <ReadingChallenge 
              practiceId={practiceId}
              studentId={user.id}
              onComplete={() => {
                // For preview, we don't necessarily need to do anything special on complete
                // except maybe show a "Preview Complete" message or just close
                setTimeout(onClose, 2000);
              }}
              onExit={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};
