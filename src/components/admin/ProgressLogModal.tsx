import { ProgressLog } from './ProgressLog';

interface ProgressLogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProgressLogModal({ isOpen, onClose }: ProgressLogModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] border border-white/20">
                <ProgressLog onClose={onClose} />
            </div>
        </div>
    );
}
