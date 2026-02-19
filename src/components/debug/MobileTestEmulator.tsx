import React, { useEffect } from 'react';
import { X, Smartphone } from 'lucide-react';

interface MobileTestEmulatorProps {
    children: React.ReactNode;
    onExit: () => void;
    isActive: boolean;
}

export const MobileTestEmulator: React.FC<MobileTestEmulatorProps> = ({ children, onExit, isActive }) => {
    // Prevent body scrolling when emulator is active
    useEffect(() => {
        if (isActive) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isActive]);

    if (!isActive) return <>{children}</>;

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[9999] p-4 font-sans select-none overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-10 left-10 text-white/10 select-none">
                <Smartphone size={200} strokeWidth={0.5} />
            </div>

            {/* Controller / Header */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur rounded-full px-6 py-2.5 border border-white/20 shadow-xl">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-white font-semibold text-sm">Mobile Preview Mode</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                <button
                    onClick={onExit}
                    className="flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10 px-3 py-1 rounded-lg transition-all text-sm font-medium"
                >
                    <X size={16} />
                    <span>Exit Test</span>
                </button>
            </div>

            {/* Device Frame */}
            <div className="relative group transition-all duration-500 scale-90 sm:scale-100 h-full max-h-[900px]">
                {/* Shadow floor */}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[120%] h-4 bg-black/40 blur-2xl rounded-[100%]" />

                {/* Physical Frame */}
                <div className="relative w-[390px] h-[844px] bg-slate-950 rounded-[3.5rem] p-3 border-[4px] border-slate-800 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] ring-1 ring-white/10 overflow-hidden flex flex-col">

                    {/* Inner Display Area */}
                    <div className="relative flex-1 bg-white rounded-[2.8rem] overflow-hidden flex flex-col pointer-events-auto">
                        {/* dynamic notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-950 rounded-b-2xl z-50 flex items-center justify-center gap-2">
                            <div className="w-8 h-1 bg-white/10 rounded-full" />
                            <div className="w-2 h-2 rounded-full bg-slate-900" />
                        </div>

                        {/* Application Content Wrapper */}
                        <div className="flex-1 w-full relative overflow-hidden flex flex-col pt-6 bg-white safe-mobile-container">
                            {children}
                        </div>

                        {/* Home Indicator */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-black/10 rounded-full z-50 group-hover:bg-black/20 transition-colors" />
                    </div>
                </div>

                {/* Side physical buttons (visual only) */}
                <div className="absolute top-24 -left-1.5 w-1.5 h-12 bg-slate-800 rounded-l-md" />
                <div className="absolute top-40 -left-1.5 w-1.5 h-16 bg-slate-800 rounded-l-md" />
                <div className="absolute top-60 -left-1.5 w-1.5 h-16 bg-slate-800 rounded-l-md" />
                <div className="absolute top-32 -right-1.5 w-1.5 h-20 bg-slate-800 rounded-r-md" />
            </div>

            {/* Info tooltips */}
            <div className="absolute bottom-8 text-white/40 text-xs text-center">
                <p>Emulated Resolution: 390 × 844 px (iPhone 14 Pro Layout)</p>
                <p className="mt-1 opacity-50 italic">Forces mobile-specific navigation and safe areas</p>
            </div>
        </div>
    );
};
